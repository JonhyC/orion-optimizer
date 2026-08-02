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
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      announcePageReady();
      return;
    }

    setStarted(true);
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
    <AnimatePresence onExitComplete={() => started && announcePageReady()}>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-void"
          style={{ backgroundColor: "#000000" }}
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
              <div className="h-full w-full rounded-full bg-neon/20" />
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

function announcePageReady() {
  document.body.dataset.orionPageReady = "true";
  window.dispatchEvent(new Event("orion:page-ready"));
}

/** Marca Orion Optimizer 2.0: usa o mesmo asset da app desktop. */
export function OrionGlyph({ className = "" }: { className?: string }) {
  return (
    <img
      src="/orion.svg"
      width={96}
      height={96}
      className={className}
      alt="Orion Optimizer 2.0"
      style={{ display: "block", maxWidth: "100%", height: "auto" }}
    />
  );
}
