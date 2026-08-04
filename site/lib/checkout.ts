import { redirect } from "next/navigation";
import { audit, nowSeconds } from "./db.ts";
import { applicationUrl } from "./discord.ts";
import { couponDiscount, findCouponByCode, redeemCoupon } from "./repo/coupons.ts";
import { createOrder, findOrder, updateOrder } from "./repo/orders.ts";
import { findPlanByCode, findPlanById } from "./repo/plans.ts";
import { findById, updateProfile } from "./repo/users.ts";
import type { Order, User } from "./repo/types.ts";

export type CheckoutMethod = "card" | "apple_pay" | "paypal";

export async function createCheckout(params: {
  user: User;
  planCode: string;
  couponCode: string;
  method: CheckoutMethod;
}): Promise<{ error?: string }> {
  const plan = await findPlanByCode(params.planCode);
  if (!plan || plan.active !== 1) return { error: "Plano indisponivel." };

  const coupon = params.couponCode ? await findCouponByCode(params.couponCode) : null;
  const discount = couponDiscount(coupon, plan.price_cents, plan.currency);
  if (params.couponCode && !discount.ok) return { error: discount.reason ?? "Cupao invalido." };

  const amount = Math.max(0, plan.price_cents - discount.discount);
  const order = await createOrder({
    user_id: params.user.id,
    plan_id: plan.id,
    amount_cents: amount,
    currency: plan.currency,
    status: amount === 0 ? "paid" : "pending",
    provider: amount === 0 ? "coupon" : params.method,
    created_at: nowSeconds(),
    paid_at: amount === 0 ? nowSeconds() : null,
    username: params.user.username,
    plan_name: plan.name,
    coupon_id: coupon?.id ?? null,
    coupon_code: coupon?.code ?? null,
    discount_cents: discount.discount,
  });

  if (amount === 0) {
    await completePaidOrder(order.id);
    redirect(`/checkout/success?order=${order.id}`);
  }

  if (params.method === "paypal") {
    const url = await createPaypalOrder(order);
    if (!url) return { error: "PayPal nao esta configurado." };
    redirect(url);
  }

  const url = await createStripeSession(order, plan.name);
  if (!url) return { error: "Stripe nao esta configurado para cartao/Apple Pay." };
  redirect(url);
}

export async function completePaidOrder(orderId: number): Promise<void> {
  const order = await findOrder(orderId);
  if (!order) return;
  const [plan, user] = await Promise.all([findPlanById(order.plan_id), findById(order.user_id)]);
  if (!plan || !user) return;

  const paidAt = nowSeconds();
  if (order.status !== "paid") {
    await updateOrder(order.id, { status: "paid", paid_at: paidAt });
  }

  const support =
    plan.support_days === null
      ? { support_started_at: null, support_expires_at: null, support_lifetime: 0 }
      : {
          support_started_at: paidAt,
          support_expires_at: plan.support_days === 0 ? null : paidAt + plan.support_days * 86400,
          support_lifetime: plan.support_days === 0 ? 1 : 0,
        };

  await updateProfile(user.id, {
    tier: plan.code,
    tier_source: "manual",
    role: user.role === "member" ? "client" : user.role,
    status: "active",
    expires_at: plan.days === 0 ? null : paidAt + plan.days * 86400,
    ...support,
  });
  if (order.coupon_id) await redeemCoupon(order.coupon_id);
  audit(user.id, "checkout_paid", `${order.provider} #${order.id}`);
}

async function createStripeSession(order: Order, planName: string): Promise<string | null> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;

  const appUrl = applicationUrl();
  const body = new URLSearchParams({
    mode: "payment",
    success_url: `${appUrl}/checkout/success?order=${order.id}`,
    cancel_url: `${appUrl}/checkout/cancel?order=${order.id}`,
    client_reference_id: String(order.id),
    "metadata[order_id]": String(order.id),
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": order.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(order.amount_cents),
    "line_items[0][price_data][product_data][name]": planName,
    // Sem `payment_method_types`, de proposito.
    //
    // Estava fixo em "card", o que fazia a sessao do Stripe oferecer SO
    // cartao - escolher Apple Pay no nosso checkout levava a uma pagina
    // onde o Apple Pay nem aparecia. Omitir o campo activa os "automatic
    // payment methods": o Stripe mostra o que estiver ligado no painel e
    // for suportado pelo dispositivo, incluindo Apple Pay no Safari e no
    // iPhone. E tambem o que evita ter de mexer aqui sempre que se
    // active um metodo novo no Stripe.
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { url?: string; id?: string };
  if (data.id) await updateOrder(order.id, { provider_ref: data.id });
  return data.url ?? null;
}

async function paypalToken(): Promise<string | null> {
  const id = process.env.PAYPAL_CLIENT_ID?.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!id || !secret) return null;
  const base = paypalBaseUrl();
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { access_token?: string };
  return data.access_token ?? null;
}

async function createPaypalOrder(order: Order): Promise<string | null> {
  const token = await paypalToken();
  if (!token) return null;
  const appUrl = applicationUrl();
  const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: String(order.id),
        amount: {
          currency_code: order.currency,
          value: (order.amount_cents / 100).toFixed(2),
        },
      }],
      application_context: {
        return_url: `${appUrl}/checkout/paypal/return?order=${order.id}`,
        cancel_url: `${appUrl}/checkout/cancel?order=${order.id}`,
      },
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { id?: string; links?: Array<{ rel: string; href: string }> };
  if (data.id) await updateOrder(order.id, { provider_ref: data.id });
  return data.links?.find((link) => link.rel === "approve")?.href ?? null;
}

export async function capturePaypalOrder(orderId: number, token: string | null): Promise<boolean> {
  const accessToken = await paypalToken();
  if (!accessToken || !token) return false;
  const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${token}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) return false;
  await completePaidOrder(orderId);
  return true;
}

function paypalBaseUrl(): string {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}
