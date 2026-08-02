"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * Cartao com inclinacao 3D e foco de luz que segue o rato.
 *
 * O foco e um radial-gradient posicionado pelas coordenadas locais do rato:
 * e o mesmo mecanismo do Spotlight, mas por cartao, o que da a cada um a sua
 * propria fonte de luz.
 */
export default function TiltCard({
  children,
  className = "",
  max = 8,
  glow = true,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  glow?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const px = useMotionValue(50);
  const py = useMotionValue(50);

  const spring = { stiffness: 220, damping: 20, mass: 0.4 };
  const rotateX = useSpring(rx, spring);
  const rotateY = useSpring(ry, spring);

  const spotlight = useMotionTemplate`radial-gradient(420px circle at ${px}% ${py}%, rgba(214,167,91,0.14), transparent 65%)`;

  const onMove = (e: React.MouseEvent) => {
    if (prefersReducedMotion() || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;

    px.set(nx * 100);
    py.set(ny * 100);
    ry.set((nx - 0.5) * max * 2);
    rx.set(-(ny - 0.5) * max * 2);
  };

  const reset = () => {
    rx.set(0);
    ry.set(0);
    setHover(false);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={reset}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      animate={{ y: hover ? -6 : 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative ${className}`}
    >
      {glow && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: spotlight }}
        />
      )}
      <div style={{ transform: "translateZ(28px)" }} className="relative h-full">
        {children}
      </div>
    </motion.div>
  );
}
