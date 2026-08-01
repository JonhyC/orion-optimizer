"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Activity, FileText, Ruler } from "lucide-react";
import Reveal from "../ui/Reveal";

/**
 * Como medimos.
 *
 * O grafico e uma ILUSTRACAO do conceito de frame-time, gerada por formula -
 * nao e a captura de nenhuma maquina. Esta rotulado como tal na pagina. Os
 * numeros reais de cada cliente vao no relatorio dele, nao aqui.
 */

function framePath(seed: number, base: number, jitter: number, points = 48) {
  let rand = seed;
  const next = () => {
    rand = (rand * 1103515245 + 12345) % 2147483648;
    return rand / 2147483648;
  };

  const w = 560;
  const h = 150;
  const max = 180;

  let d = "";
  for (let i = 0; i < points; i++) {
    const v = base + (next() - 0.5) * jitter;
    const x = (w * i) / (points - 1);
    const y = h - (Math.max(v, 0) / max) * h;
    d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
  }
  return d.trim();
}

const SPIKY = framePath(7, 62, 58);
const FLAT = framePath(23, 118, 13);

const METHOD = [
  {
    icon: Ruler,
    title: "We measure first",
    body: "PresentMon captures your frame times before we touch anything. That baseline is yours to keep.",
  },
  {
    icon: Activity,
    title: "We watch 1% lows",
    body: "Average FPS hides stutter. The bottom 1% of frames is what decides whether a fight feels smooth.",
  },
  {
    icon: FileText,
    title: "You get the numbers",
    body: "Before and after, in writing. If nothing measurably improved, you get a refund and a rollback.",
  },
];

export default function Comparison() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="results" className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 hairline" />

      <div className="section">
        <Reveal>
          <span className="eyebrow">
            <Activity size={13} />
            How we measure
          </span>
        </Reveal>

        <Reveal delay={0.08}>
          <h2 className="mt-7 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-gradient md:text-6xl">
            The flat line is
            <br />
            the whole point.
          </h2>
        </Reveal>

        <Reveal delay={0.14}>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/45">
            Most optimizers sell you a bigger average FPS number. What you actually
            feel is the consistency of the frame times underneath it.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <Reveal className="h-full">
            <div ref={ref} className="glass h-full overflow-hidden p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6 text-[12px]">
                  <span className="inline-flex items-center gap-2 text-white/40">
                    <span className="h-0.5 w-5 rounded bg-white/30" />
                    Stuttering
                  </span>
                  <span className="inline-flex items-center gap-2 text-neon">
                    <span className="h-0.5 w-5 rounded bg-neon shadow-neon" />
                    Consistent
                  </span>
                </div>

                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/35">
                  Illustration
                </span>
              </div>

              <svg viewBox="0 0 560 150" className="mt-7 w-full overflow-visible">
                <defs>
                  <linearGradient id="cmp-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B3DFF" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#8B3DFF" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {[0, 1, 2, 3].map((i) => (
                  <line
                    key={i}
                    x1="0"
                    x2="560"
                    y1={i * 50}
                    y2={i * 50}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="1"
                  />
                ))}

                <motion.path
                  d={SPIKY}
                  fill="none"
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={inView ? { pathLength: 1 } : {}}
                  transition={{ duration: 1.7, ease: [0.22, 1, 0.36, 1] }}
                />

                <motion.path
                  d={`${FLAT} L560 150 L0 150 Z`}
                  fill="url(#cmp-fill)"
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ duration: 1, delay: 1.1 }}
                />

                <motion.path
                  d={FLAT}
                  fill="none"
                  stroke="#8B3DFF"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={inView ? { pathLength: 1 } : {}}
                  transition={{ duration: 1.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  style={{ filter: "drop-shadow(0 0 10px rgba(139,61,255,0.5))" }}
                />
              </svg>

              <p className="mt-6 text-[13px] leading-relaxed text-white/35">
                Both lines can share the same average. The spiky one is what stutter
                looks like. This chart is drawn to explain the idea — it is not a
                capture from anyone&rsquo;s machine. Your own before/after goes in
                your report.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.12} className="h-full">
            <div className="flex h-full flex-col gap-4">
              {METHOD.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.title}
                    className="glass flex-1 p-7 transition-colors duration-500 hover:border-neon/25"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-neon/25 bg-neon/[0.07]">
                        <Icon size={17} className="text-neon-soft" />
                      </div>
                      <h3 className="text-[15.5px] font-bold tracking-tight text-white">
                        {m.title}
                      </h3>
                    </div>
                    <p className="mt-4 text-[13.5px] leading-relaxed text-white/45">{m.body}</p>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
