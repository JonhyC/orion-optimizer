"use client";

import { useState } from "react";
import { Check, Maximize2, X, Zap } from "lucide-react";
import type { PublicPlan } from "@/lib/site-data";
import Reveal, { RevealGroup, RevealItem } from "../ui/Reveal";
import TiltCard from "../ui/TiltCard";
import MagneticButton from "../ui/MagneticButton";
import Counter from "../ui/Counter";

const FEATURES: Record<string, string[]> = {
  basic: [
    "Startup & background cleanup",
    "Windows debloat pass",
    "Power plan tuning",
    "System restore point first",
    "Full rollback included",
  ],
  pro: [
    "Everything in Basic",
    "CPU scheduling & core parking",
    "GPU driver-level tuning",
    "Network latency pass",
    "Per-game profile setup",
  ],
  ultimate: [
    "Everything in Pro",
    "Full 1-on-1 remote session",
    "Frame-time analysis with PresentMon",
    "Before / after benchmark report",
    "Peripheral & monitor calibration",
    "Free re-optimization after upgrades",
  ],
};

export default function Packages({ plans }: { plans: PublicPlan[] }) {
  const [openCover, setOpenCover] = useState<{ url: string; name: string } | null>(null);
  if (plans.length === 0) return null;

  return (
    <>
    <section id="packages" className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full blur-[150px]"
        style={{ background: "radial-gradient(circle, rgba(139,61,255,0.16), transparent 70%)" }}
      />

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
          {plans.map((plan) => {
            const badge =
              plan.code === "pro"
                ? "Most Popular"
                : plan.code === "ultimate"
                  ? "Maximum Performance"
                  : null;
            const featured = badge !== null;
            const features = [...(FEATURES[plan.code] ?? [
              plan.days === 0 ? "Permanent access" : `${plan.days} days of access`,
              "System restore point first",
              "Full rollback included",
            ])];
            if (plan.support_days !== null) {
              features.push(
                plan.support_days === 0
                  ? "Life-time support"
                  : `${plan.support_days} days of support`,
              );
            }

            return (
              <RevealItem key={plan.id} className="h-full">
                <TiltCard max={6} className="h-full">
                  <div
                    className={`glow-border relative flex h-full flex-col rounded-2xl border p-8 backdrop-blur-xl ${
                      featured
                        ? "is-active border-neon/35 bg-gradient-to-b from-neon/[0.09] to-white/[0.02]"
                        : "border-white/[0.07] bg-white/[0.02]"
                    }`}
                  >
                    {badge && (
                      <div className="pointer-events-none absolute -top-3.5 left-1/2 z-30 -translate-x-1/2">
                        <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full bg-gradient-to-r from-neon-deep to-neon px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-void shadow-neon">
                          <Zap size={11} />
                          {badge}
                        </span>
                      </div>
                    )}

                    {plan.cover_url && (
                      <button
                        type="button"
                        onClick={() => setOpenCover({ url: plan.cover_url!, name: plan.name })}
                        title="View cover"
                        className="group/cover relative z-0 -mx-8 -mt-8 mb-7 block aspect-[16/9] overflow-hidden rounded-t-[15px] border-b border-white/[0.07] bg-white/[0.02] text-left"
                      >
                        <img
                          src={plan.cover_url}
                          alt={`Cover for ${plan.name}`}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover/cover:scale-[1.03]"
                        />
                        <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md border border-white/15 bg-black/55 text-white/70 opacity-0 backdrop-blur-md transition-opacity group-hover/cover:opacity-100">
                          <Maximize2 size={14} />
                        </span>
                      </button>
                    )}

                    <h3 className="text-xl font-bold tracking-tight text-white">{plan.name}</h3>
                    <p className="mt-1.5 text-[13.5px] text-white/40">
                      {plan.description ?? "Orion Optimizer access."}
                    </p>

                    <div className="mt-8 flex items-baseline gap-1">
                      <span className="text-2xl font-semibold text-white/50">EUR</span>
                      <span
                        className={`font-mono text-6xl font-extrabold tracking-tighter ${
                          featured ? "text-neon" : "text-white"
                        }`}
                      >
                        <Counter to={plan.price_cents / 100} decimals={2} />
                      </span>
                    </div>
                    <div className="mt-1.5 text-[12.5px] text-white/35">
                      {plan.days === 0 ? "permanent" : `${plan.days} days`} - no subscription
                    </div>
                    <div className="mt-1 text-[12.5px] text-white/35">
                      Support: {plan.support_days === null
                        ? "not included"
                        : plan.support_days === 0
                          ? "life-time"
                          : `${plan.support_days} days`}
                    </div>

                    <div className="my-8 hairline" />

                    <ul className="flex-1 space-y-3.5">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-3 text-[14px] text-white/60">
                          <span
                            className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full ${
                              featured ? "bg-neon/20 text-neon" : "bg-white/[0.07] text-white/50"
                            }`}
                          >
                            <Check size={11} strokeWidth={3} />
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-10">
                      <MagneticButton
                        href="#contact"
                        variant={featured ? "primary" : "ghost"}
                        strength={0.22}
                        className="w-full"
                      >
                        Get {plan.name}
                      </MagneticButton>
                    </div>
                  </div>
                </TiltCard>
              </RevealItem>
            );
          })}
        </RevealGroup>

        <Reveal delay={0.1}>
          <p className="mt-10 text-center text-[13px] text-white/30">
            No measurable improvement on your machine? Full refund, and we roll
            everything back.
          </p>
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
