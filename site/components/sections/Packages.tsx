"use client";

import { useState } from "react";
import { X } from "lucide-react";
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
