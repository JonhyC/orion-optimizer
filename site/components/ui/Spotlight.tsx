"use client";

import { useEffect } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { hasFinePointer, prefersReducedMotion } from "@/lib/utils";

/**
 * Foco de luz que segue o rato por cima de toda a pagina.
 *
 * Fica em mix-blend-mode: screen e com opacidade baixa - a intencao e
 * insinuar profundidade, nao iluminar. Passar disto suja o texto.
 */
export default function Spotlight() {
  const x = useMotionValue(-500);
  const y = useMotionValue(-500);

  const sx = useSpring(x, { stiffness: 60, damping: 22, mass: 0.7 });
  const sy = useSpring(y, { stiffness: 60, damping: 22, mass: 0.7 });

  const background = useMotionTemplate`radial-gradient(560px circle at ${sx}px ${sy}px, rgba(139,61,255,0.09), transparent 72%)`;

  useEffect(() => {
    if (!hasFinePointer() || prefersReducedMotion()) return;

    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, [x, y]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[5] mix-blend-screen"
      style={{ background }}
    />
  );
}
