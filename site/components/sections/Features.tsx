"use client";

import { features } from "@/lib/data";
import Reveal, { RevealGroup, RevealItem } from "../ui/Reveal";
import TiltCard from "../ui/TiltCard";

export default function Features() {
  return (
    <section id="features" className="section">
      <Reveal>
        <span className="eyebrow">What changes</span>
      </Reveal>

      <Reveal delay={0.08}>
        <h2 className="mt-7 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-gradient md:text-6xl">
          Six things your machine
          <br />
          gets back.
        </h2>
      </Reveal>

      <Reveal delay={0.14}>
        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/45">
          We are not going to print a gain figure here — it depends entirely on
          your hardware and how loaded your Windows install is. We measure yours
          before and after, and if a change does nothing for you, we skip it.
        </p>
      </Reveal>

      <RevealGroup className="perspective mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <RevealItem key={f.title}>
              <TiltCard className="h-full">
                <article className="glass glow-border h-full overflow-hidden p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-2xl bg-neon/20 blur-xl" />
                      <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-neon/25 bg-neon/[0.07]">
                        <Icon size={21} className="text-neon-soft" />
                      </div>
                    </div>

                    <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-[11px] tracking-tight text-neon-soft">
                      {f.tag}
                    </span>
                  </div>

                  <h3 className="mt-7 text-lg font-bold tracking-tight text-white">
                    {f.title}
                  </h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-white/45">
                    {f.body}
                  </p>

                  {/* linha que preenche no hover */}
                  <div className="mt-7 h-px w-full overflow-hidden bg-white/[0.06]">
                    <div className="h-full w-0 bg-gradient-to-r from-neon to-transparent transition-all duration-700 group-hover:w-full" />
                  </div>
                </article>
              </TiltCard>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </section>
  );
}
