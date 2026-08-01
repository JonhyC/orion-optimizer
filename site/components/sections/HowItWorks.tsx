"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { steps } from "@/lib/data";
import Reveal from "../ui/Reveal";

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);

  // A linha vertical desenha-se conforme a seccao atravessa o ecra.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 70%", "end 60%"],
  });
  const height = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section id="process" className="relative overflow-hidden">
      <div className="section">
        <Reveal>
          <span className="eyebrow">How it works</span>
        </Reveal>

        <Reveal delay={0.08}>
          <h2 className="mt-7 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-gradient md:text-6xl">
            Four steps. No mystery.
          </h2>
        </Reveal>

        <div ref={ref} className="relative mt-20 pl-8 md:pl-0">
          {/* carril */}
          <div className="absolute left-0 top-0 h-full w-px bg-white/[0.07] md:left-1/2 md:-translate-x-1/2">
            <motion.div
              style={{ height }}
              className="w-full bg-gradient-to-b from-neon via-neon to-neon-deep shadow-neon"
            />
          </div>

          <ol className="space-y-16 md:space-y-24">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const right = i % 2 === 1;

              return (
                <li key={step.title} className="relative md:grid md:grid-cols-2 md:gap-16">
                  {/* no */}
                  <div className="absolute -left-8 top-1 md:left-1/2 md:-translate-x-1/2">
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      className="relative grid h-4 w-4 place-items-center"
                    >
                      <span className="absolute h-4 w-4 animate-ping rounded-full bg-neon/40" />
                      <span className="relative h-3 w-3 rounded-full bg-neon shadow-neon ring-4 ring-void" />
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, x: right ? 40 : -40, filter: "blur(6px)" }}
                    whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                    className={
                      right
                        ? "md:col-start-2 md:pl-4"
                        : "md:col-start-1 md:row-start-1 md:pr-4 md:text-right"
                    }
                  >
                    <div className="glass inline-block w-full p-7">
                      <div
                        className={`flex items-center gap-4 ${
                          right ? "" : "md:flex-row-reverse"
                        }`}
                      >
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-neon/25 bg-neon/[0.07]">
                          <Icon size={19} className="text-neon-soft" />
                        </div>
                        <div className={right ? "" : "md:text-right"}>
                          <div className="font-mono text-[11px] tracking-[0.2em] text-neon/70">
                            STEP {String(i + 1).padStart(2, "0")}
                          </div>
                          <h3 className="text-lg font-bold tracking-tight text-white">
                            {step.title}
                          </h3>
                        </div>
                      </div>
                      <p className="mt-5 text-[14px] leading-relaxed text-white/45">
                        {step.body}
                      </p>
                    </div>
                  </motion.div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
