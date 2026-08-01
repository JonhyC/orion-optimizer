"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { faqs } from "@/lib/data";
import Reveal from "../ui/Reveal";

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative">
      <div className="absolute inset-x-0 top-0 hairline" />

      <div className="section">
        <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Reveal>
              <span className="eyebrow">FAQ</span>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-7 text-4xl font-extrabold leading-[1.05] tracking-tight text-gradient md:text-5xl">
                The questions
                <br />
                worth asking.
              </h2>
            </Reveal>
            <Reveal delay={0.14}>
              <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-white/45">
                Including the ones most sellers in this space would rather you
                didn&rsquo;t ask.
              </p>
            </Reveal>
          </div>

          <div className="space-y-3">
            {faqs.map((f, i) => {
              const isOpen = open === i;

              return (
                <Reveal key={f.q} delay={i * 0.05}>
                  <div
                    className={`overflow-hidden rounded-2xl border backdrop-blur-xl transition-colors duration-300 ${
                      isOpen
                        ? "border-neon/30 bg-neon/[0.04]"
                        : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"
                    }`}
                  >
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-6 px-7 py-5 text-left"
                    >
                      <span
                        className={`text-[15px] font-semibold transition-colors ${
                          isOpen ? "text-white" : "text-white/70"
                        }`}
                      >
                        {f.q}
                      </span>
                      <motion.span
                        animate={{ rotate: isOpen ? 45 : 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
                          isOpen
                            ? "border-neon/40 bg-neon/15 text-neon"
                            : "border-white/10 text-white/40"
                        }`}
                      >
                        <Plus size={14} />
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            height: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                            opacity: { duration: 0.28 },
                          }}
                        >
                          <p className="px-7 pb-6 text-[14px] leading-relaxed text-white/50">
                            {f.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
