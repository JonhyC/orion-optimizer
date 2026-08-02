"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { prefersReducedMotion } from "@/lib/utils";

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  strength?: number;
  className?: string;
};

/**
 * Botao magnetico: aproxima-se do rato quando este entra na zona.
 *
 * O conteudo desloca-se menos do que a caixa (fator 0.35), o que da a
 * sensacao de profundidade em vez de um bloco a escorregar.
 */
export default function MagneticButton({
  children,
  href,
  onClick,
  variant = "primary",
  strength = 0.32,
  className = "",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  // A caixa segue o rato; o conteudo segue mais devagar e menos longe.
  // A diferenca entre os dois e o que da a sensacao de profundidade.
  const x = useSpring(mx, { stiffness: 260, damping: 18, mass: 0.4 });
  const y = useSpring(my, { stiffness: 260, damping: 18, mass: 0.4 });
  const innerX = useSpring(mx, { stiffness: 150, damping: 20, mass: 0.6 });
  const innerY = useSpring(my, { stiffness: 150, damping: 20, mass: 0.6 });

  const handleMove = (e: React.MouseEvent) => {
    if (prefersReducedMotion() || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    mx.set(dx * strength);
    my.set(dy * strength);
  };

  const reset = () => {
    mx.set(0);
    my.set(0);
    setHover(false);
  };

  const base =
    "relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-full px-8 py-4 text-sm font-semibold tracking-wide transition-colors duration-300";

  const styles =
    variant === "primary"
      ? "bg-gradient-to-r from-neon-deep via-neon to-neon-soft text-void shadow-neon-lg"
      : "border border-white/15 bg-white/[0.03] text-white backdrop-blur-xl hover:border-neon/50";

  const Inner = (
    <motion.span
      className="relative z-10 flex items-center gap-2.5"
      style={{ x: innerX, y: innerY }}
    >
      {children}
    </motion.span>
  );

  const content = (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={reset}
      style={{ x, y }}
      className={`${base} ${styles} ${className}`}
    >
      {/* brilho que varre no hover */}
      <motion.span
        aria-hidden
        className="absolute inset-0 z-0"
        initial={false}
        animate={{ opacity: hover ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.span
          className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-white/25 blur-md"
          animate={hover ? { x: ["0%", "420%"] } : { x: "0%" }}
          transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
        />
      </motion.span>

      {/* halo exterior */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-6 z-0 rounded-full"
        animate={{ opacity: hover ? 1 : 0 }}
        transition={{ duration: 0.4 }}
        style={{
          background:
            "radial-gradient(closest-side, rgba(214,167,91,0.35), transparent 70%)",
        }}
      />

      {Inner}
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} onClick={onClick} className="inline-block">
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className="inline-block">
      {content}
    </button>
  );
}
