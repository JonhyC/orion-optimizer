"use client";

import { RotateCcw, ShieldCheck, FileSearch, Ban } from "lucide-react";
import type { PublicStats } from "@/lib/site-data";
import Counter from "../ui/Counter";
import Reveal, { RevealGroup, RevealItem } from "../ui/Reveal";

/**
 * Prova social real.
 *
 * Enquanto nao houver clientes nem avaliacoes, esta seccao NAO inventa
 * numeros: mostra as garantias, que sao verificaveis hoje. Assim que a base
 * de dados tiver dados, os numeros aparecem sozinhos.
 */

const GUARANTEES = [
  {
    icon: ShieldCheck,
    title: "Restore point first",
    body: "A system restore point is taken before anything is touched. Every time, no exceptions.",
  },
  {
    icon: RotateCcw,
    title: "One-click rollback",
    body: "Every value we change is recorded with its original state — including whether it existed at all.",
  },
  {
    icon: Ban,
    title: "No snake oil",
    body: "No RAM cleaners, no registry cleaners, no SSD defrag. We will talk you out of them.",
  },
  {
    icon: FileSearch,
    title: "Written numbers",
    body: "Benchmarks before and after, in writing. No improvement on your machine means a refund.",
  },
];

export default function Stats({ stats }: { stats: PublicStats }) {
  if (stats.empty) {
    return (
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 hairline" />

        <div className="section !py-24">
          <Reveal>
            <span className="eyebrow">Why choose us</span>
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="mt-7 max-w-2xl text-3xl font-extrabold leading-[1.1] tracking-tight text-gradient md:text-5xl">
              We are new. Here is what
              <br />
              you can hold us to.
            </h2>
          </Reveal>

          <Reveal delay={0.14}>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/45">
              No customer counts yet, because there are none to count. Plenty of
              sites in this space would put a number here anyway.
            </p>
          </Reveal>

          <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2" stagger={0.09}>
            {GUARANTEES.map((g) => {
              const Icon = g.icon;
              return (
                <RevealItem key={g.title}>
                  <div className="group h-full rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl transition-colors duration-500 hover:border-neon/30">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl border border-neon/25 bg-neon/[0.07]">
                      <Icon size={19} className="text-neon-soft" />
                    </div>
                    <h3 className="mt-6 text-[16px] font-bold tracking-tight text-white">
                      {g.title}
                    </h3>
                    <p className="mt-2.5 text-[14px] leading-relaxed text-white/45">{g.body}</p>
                  </div>
                </RevealItem>
              );
            })}
          </RevealGroup>
        </div>
      </section>
    );
  }

  // Um tile a zero nao acrescenta nada e ainda chama a atencao para o que
  // falta: melhor mostrar tres numeros verdadeiros do que quatro com um zero.
  const tiles = [
    { value: stats.clients, suffix: "", label: "Clients", decimals: 0 },
    { value: stats.optimizedPCs, suffix: "", label: "Optimized PCs", decimals: 0 },
    { value: stats.reviewCount, suffix: "", label: "Reviews", decimals: 0 },
    ...(stats.averageRating !== null
      ? [{ value: stats.averageRating, suffix: "★", label: "Average rating", decimals: 1 }]
      : []),
  ].filter((t) => t.value > 0);

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 hairline" />

      <div className="section !py-24">
        <Reveal>
          <span className="eyebrow">Why choose us</span>
        </Reveal>

        <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" stagger={0.1}>
          {tiles.map((s) => (
            <RevealItem key={s.label}>
              <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center backdrop-blur-xl transition-colors duration-500 hover:border-neon/30">
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(300px circle at 50% 0%, rgba(214,167,91,0.14), transparent 70%)",
                  }}
                />
                <div className="relative font-mono text-5xl font-extrabold tracking-tighter text-neon md:text-6xl">
                  <Counter to={s.value} decimals={s.decimals} />
                  {s.suffix && <span className="text-4xl">{s.suffix}</span>}
                </div>
                <div className="relative mt-3 text-[12.5px] font-medium uppercase tracking-[0.14em] text-white/40">
                  {s.label}
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
