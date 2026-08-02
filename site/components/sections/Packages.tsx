"use client";

import { useState } from "react";
import { BadgePercent, CreditCard, ShieldCheck, WalletCards, X } from "lucide-react";
import type { PublicPlan } from "@/lib/site-data";
import PlanCardDisplay from "../plans/PlanCardDisplay";
import Reveal, { RevealGroup, RevealItem } from "../ui/Reveal";
import TiltCard from "../ui/TiltCard";

export default function Packages({ plans }: { plans: PublicPlan[] }) {
  const [openCover, setOpenCover] = useState<{ url: string; name: string } | null>(null);
  if (plans.length === 0) return null;

  return (
    <>
    <section id="packages" className="relative overflow-hidden">
      <div aria-hidden className="orion-rings -right-72 top-8 h-[560px] w-[560px] rotate-12 opacity-50" />
      <div aria-hidden className="orion-dots left-0 top-24" />
      <div aria-hidden className="orion-sheen left-1/2 top-10 w-[360px] -translate-x-1/2" />

      <div className="section">
        <Reveal>
          <span className="eyebrow">Packages</span>
        </Reveal>

        <Reveal delay={0.08}>
          <h2 className="mt-7 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-gradient md:text-6xl">
            Pick your level.
          </h2>
        </Reveal>

        <Reveal delay={0.14}>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/45">
            Every package includes a system restore point, a full change log and
            one-click rollback. That part is never an upsell.
          </p>
        </Reveal>

        <RevealGroup
          className="perspective mt-16 grid items-stretch gap-6 lg:grid-cols-3"
          stagger={0.12}
        >
          {plans.map((plan) => (
              <RevealItem key={plan.id} className="h-full">
                <TiltCard max={6} className="h-full">
                  <PlanCardDisplay
                    plan={plan}
                    onCoverOpen={plan.cover_url
                      ? () => setOpenCover({ url: plan.cover_url!, name: plan.name })
                      : undefined}
                  />
                </TiltCard>
              </RevealItem>
          ))}
        </RevealGroup>

        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-[12.5px] text-white/35">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2"><CreditCard size={14} />Cartao credito/debito</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2"><WalletCards size={14} />Apple Pay</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2"><ShieldCheck size={14} />PayPal</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--chart-1)]/20 bg-[var(--chart-1)]/[0.06] px-3 py-2 text-[var(--chart-1)]"><BadgePercent size={14} />Cupoes ativos no checkout</span>
          </div>
        </Reveal>
      </div>
    </section>

    {openCover && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cover for ${openCover.name}`}
        className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4 backdrop-blur-md"
        onClick={() => setOpenCover(null)}
      >
        <button
          type="button"
          onClick={() => setOpenCover(null)}
          aria-label="Close cover"
          title="Close"
          className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-md border border-white/15 bg-black/50 text-white/70 hover:text-white"
        >
          <X size={19} />
        </button>
        <img
          src={openCover.url}
          alt={`Cover for ${openCover.name}`}
          onClick={(event) => event.stopPropagation()}
          className="max-h-[88vh] max-w-[94vw] object-contain shadow-2xl"
        />
      </div>
    )}
    </>
  );
}
