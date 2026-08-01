"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * Ecra de entrada. Conta ate 100 e sai com um corte vertical.
 *
 * Nunca fica preso: sai por temporizador mesmo que 'load' nao dispare, e
 * e ignorado por completo com movimento reduzido.
 */
export default function PageLoader() {
  const [done, setDone] = useState(true);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    setDone(false);
    const start = performance.now();
    const DURATION = 1500;

    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / DURATION, 1);
      // desacelera no fim
      const eased = 1 - Math.pow(1 - t, 3);
      setPct(Math.round(eased * 100));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };
    frame = requestAnimationFrame(tick);

    // rede de seguranca
    const bail = setTimeout(() => setDone(true), 3200);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(bail);
    };
  }, []);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-void"
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.85, ease: [0.76, 0, 0.24, 1] }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute inset-0 -z-10 blur-3xl">
              <div className="h-full w-full rounded-full bg-neon/25" />
            </div>
            <OrionGlyph className="h-24 w-24" />
          </motion.div>

          <div className="mt-10 h-px w-56 overflow-hidden bg-white/10">
            <motion.div
              className="h-full bg-gradient-to-r from-neon-deep to-neon-bright"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="mt-4 font-mono text-[11px] tracking-[0.35em] text-neon-soft">
            {String(pct).padStart(3, "0")}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Marca Orion: orbita segmentada + raio. Usada no loader e na navegacao. */
export function OrionGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Orion Optimizer">
      <defs>
        <linearGradient id="og-metal" x1="0.1" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="52%" stopColor="#D8D9E0" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="og-violet" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#6422C7" />
          <stop offset="52%" stopColor="#8B3DFF" />
          <stop offset="100%" stopColor="#B78AFF" />
        </linearGradient>
      </defs>

      <circle
        cx="98" cy="101" r="55" fill="none" stroke="url(#og-metal)" strokeWidth="18"
        strokeDasharray="245 101" transform="rotate(36 98 101)"
      />
      <path
        d="M151 122 A57 57 0 0 1 112 157"
        fill="none" stroke="url(#og-violet)" strokeWidth="18" strokeLinecap="butt"
      />
      <ellipse
        cx="99" cy="107" rx="82" ry="25" fill="none"
        stroke="url(#og-violet)" strokeWidth="5" transform="rotate(-14 99 107)"
      />
      <path
        d="M163 22 L108 81 L122 92 L83 129 L105 94 L91 84 Z"
        fill="url(#og-violet)"
      />
    </svg>
  );
}
