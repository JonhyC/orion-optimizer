"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import ParticleField from "../three/ParticleField";
import MagneticButton from "../ui/MagneticButton";
import { DISCORD_URL } from "@/lib/data";
import { prefersReducedMotion } from "@/lib/utils";

const TITLE = ["UNLOCK", "YOUR", "PC'S", "TRUE", "PERFORMANCE"];

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const [introReady, setIntroReady] = useState(false);

  useEffect(() => {
    const reveal = () => setIntroReady(true);
    if (document.body.dataset.orionPageReady === "true" || prefersReducedMotion()) {
      reveal();
      return;
    }

    window.addEventListener("orion:page-ready", reveal, { once: true });
    const fallback = window.setTimeout(reveal, 4000);
    return () => {
      window.removeEventListener("orion:page-ready", reveal);
      window.clearTimeout(fallback);
    };
  }, []);

  // Parallax de saida: o conteudo sobe e desvanece enquanto a seccao sai.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const opacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);

  return (
    <section
      id="top"
      ref={ref}
      className="relative flex min-h-[100svh] items-center overflow-hidden"
    >
      {/* fundo */}
      <div className="absolute inset-0 bg-void" />
      <ParticleField />

      {/* gradientes em movimento */}
      <motion.div
        aria-hidden
        className="absolute -left-1/4 top-0 h-[720px] w-[720px] rounded-full blur-[130px]"
        style={{ background: "radial-gradient(circle, rgba(0,120,184,0.30), transparent 68%)" }}
        animate={{ x: [0, 90, 0], y: [0, 60, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -right-1/4 bottom-0 h-[640px] w-[640px] rounded-full blur-[130px]"
        style={{ background: "radial-gradient(circle, rgba(139,61,255,0.22), transparent 68%)" }}
        animate={{ x: [0, -70, 0], y: [0, -50, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* grelha tecnica */}
      <div
        aria-hidden
        className="absolute inset-0 bg-grid-fade opacity-[0.35] mask-fade-b animate-grid-drift"
        style={{ backgroundSize: "64px 64px" }}
      />

      <motion.div
        style={{ y, opacity, scale }}
        className="relative z-10 mx-auto w-full max-w-7xl px-6 py-32 md:px-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={introReady ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay: 0.35, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="eyebrow">
            <Sparkles size={13} />
            Professional Windows Optimization
          </span>
        </motion.div>

        <h1 className="mt-8 max-w-5xl font-display text-[34px] font-extrabold leading-[0.92] tracking-normal min-[370px]:text-[40px] sm:text-[64px] lg:text-[86px]">
          {TITLE.map((word, i) => (
            <span key={word} className="mr-[0.22em] inline-block max-w-full overflow-hidden align-bottom last:mr-0">
              <motion.span
                className={`inline-block ${
                  word === "PERFORMANCE" ? "text-neon-gradient" : "text-gradient"
                }`}
                initial={{ y: "110%", opacity: 0 }}
                animate={introReady ? { y: "0%", opacity: 1 } : undefined}
                transition={{
                  delay: 0.45 + i * 0.085,
                  duration: 0.9,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {word}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={introReady ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay: 0.95, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-col gap-1.5 text-lg font-medium text-white/55 sm:flex-row sm:gap-4 sm:text-xl"
        >
          <span>More FPS.</span>
          <span className="hidden text-neon/40 sm:inline">/</span>
          <span>Less Input Lag.</span>
          <span className="hidden text-neon/40 sm:inline">/</span>
          <span className="text-white/80">Maximum Performance.</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={introReady ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay: 1.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 flex flex-wrap items-center gap-5"
        >
          <MagneticButton href="#packages">
            BUY NOW
            <ArrowRight size={17} />
          </MagneticButton>

          <MagneticButton href={DISCORD_URL} variant="ghost" strength={0.2}>
            Talk to us first
          </MagneticButton>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={introReady ? { opacity: 1 } : undefined}
          transition={{ delay: 1.4, duration: 0.9 }}
          className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px] text-white/40"
        >
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={15} className="text-neon" />
            Restore point before every session
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={15} className="text-neon" />
            Anti-cheat safe
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={15} className="text-neon" />
            One-click full rollback
          </span>
        </motion.div>
      </motion.div>

      {/* indicador de scroll */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={introReady ? { opacity: 1 } : undefined}
        transition={{ delay: 1.8 }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <div className="flex h-10 w-6 items-start justify-center rounded-full border border-white/15 p-1.5">
          <motion.span
            className="h-1.5 w-1 rounded-full bg-neon"
            animate={{ y: [0, 12, 0], opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </section>
  );
}
