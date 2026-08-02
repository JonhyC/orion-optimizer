import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { findPlanByCode } from "@/lib/repo/plans";
import { currentUser } from "@/lib/session";
import { money } from "@/lib/stats";
import CheckoutForm from "./CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ plan: string }> }) {
  const [{ plan: code }, user] = await Promise.all([params, currentUser()]);
  const plan = await findPlanByCode(code);
  if (!plan || plan.active !== 1) notFound();
  if (!user) redirect(`/panel/login?next=/checkout/${plan.code}`);

  return (
    <main className="min-h-screen bg-[var(--panel-bg)] px-6 py-10">
      <div className="mx-auto max-w-[760px]">
        <Link href="/#packages" className="text-[13px] text-white/35 hover:text-white">
          Voltar aos planos
        </Link>

        <div className="mt-6 grid gap-5 md:grid-cols-[1fr_0.85fr]">
          <section className="rounded-lg border border-white/[0.08] bg-[var(--panel-surface)] p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--chart-1)]">
              Checkout Orion
            </p>
            <h1 className="mt-3 text-2xl font-bold text-white">{plan.name}</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/45">
              {plan.description ?? "Acesso ao Orion Optimizer 2.0."}
            </p>
            <CheckoutForm planCode={plan.code} />
          </section>

          <aside className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-6">
            <h2 className="text-[14px] font-semibold text-white">Resumo</h2>
            <div className="mt-5 space-y-3 text-[13px]">
              <Row label="Plano" value={plan.name} />
              <Row label="Licenca" value={plan.days === 0 ? "Life-time" : `${plan.days} dias`} />
              <Row
                label="Suporte"
                value={
                  plan.support_days === null
                    ? "Nao incluido"
                    : plan.support_days === 0
                      ? "Life-time"
                      : `${plan.support_days} dias`
                }
              />
            </div>
            <div className="mt-6 border-t border-white/[0.08] pt-5">
              <div className="flex items-end justify-between">
                <span className="text-[13px] text-white/40">Total</span>
                <span className="text-3xl font-bold text-white">{money(plan.price_cents, plan.currency)}</span>
              </div>
            </div>
            <p className="mt-5 text-[11.5px] leading-relaxed text-white/30">
              Cartao e Apple Pay usam Stripe Checkout. PayPal usa PayPal Checkout. O plano e aplicado automaticamente quando o pagamento for confirmado.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/35">{label}</span>
      <span className="text-right text-white/70">{value}</span>
    </div>
  );
}
