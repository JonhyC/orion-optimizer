"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { hasFinePointer, prefersReducedMotion } from "@/lib/utils";

/**
 * Cursor proprio: um ponto que segue o rato de imediato e um anel que o
 * persegue com atraso. Cresce sobre elementos interativos.
 *
 * So aparece em dispositivos com rato. Em ecra tatil, ou com movimento
 * reduzido, o cursor do sistema fica como esta.
 */
export default function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [down, setDown] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);

  const ringX = useSpring(x, { stiffness: 260, damping: 26, mass: 0.45 });
  const ringY = useSpring(y, { stiffness: 260, damping: 26, mass: 0.45 });

  useEffect(() => {
    if (!hasFinePointer() || prefersReducedMotion()) return;

    setEnabled(true);
    document.body.classList.add("has-custom-cursor");

    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);

      const el = e.target as HTMLElement | null;
      setHovering(
        !!el?.closest?.(
          'a, button, [role="button"], input, select, textarea, summary, [data-cursor="hover"]',
        ),
      );
    };

    const onDown = () => setDown(true);
    const onUp = () => setDown(false);
    const onLeave = () => x.set(-100);

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      document.body.classList.remove("has-custom-cursor");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [x, y]);

  if (!enabled) return null;

  return (
    <>
      {/* x/y posicionam a caixa; a centragem fica no filho, em CSS.
          Misturar x com translateX no mesmo elemento faz o framer-motion
          escrever duas vezes na mesma propriedade transform. */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[9999]"
        style={{ x, y }}
      >
        <motion.span
          className="block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon-bright"
          animate={{ scale: down ? 0.5 : 1 }}
          transition={{ duration: 0.15 }}
        />
      </motion.div>

      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[9998]"
        style={{ x: ringX, y: ringY }}
      >
        <motion.span
          className="block -translate-x-1/2 -translate-y-1/2 rounded-full border border-neon/60"
          animate={{
            width: hovering ? 46 : 26,
            height: hovering ? 46 : 26,
            opacity: hovering ? 1 : 0.55,
            backgroundColor: hovering ? "rgba(214,167,91,0.10)" : "rgba(214,167,91,0)",
          }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
        />
      </motion.div>
    </>
  );
}
