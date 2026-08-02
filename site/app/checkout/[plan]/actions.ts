"use server";

import { createCheckout, type CheckoutMethod } from "@/lib/checkout";
import { requireUser } from "@/lib/session";

type CheckoutState = { error?: string } | null;

export async function checkoutAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await requireUser();
  const method = String(formData.get("method") ?? "") as CheckoutMethod;
  if (!["card", "apple_pay", "paypal"].includes(method)) {
    return { error: "Escolhe um metodo de pagamento." };
  }

  return createCheckout({
    user,
    planCode: String(formData.get("plan") ?? ""),
    couponCode: String(formData.get("coupon") ?? ""),
    method,
  });
}
