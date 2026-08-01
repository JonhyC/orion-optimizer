"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/** Barra fina no topo que acompanha a leitura da pagina. */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const width = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 26,
    restDelta: 0.001,
  });

  return (
    <motion.div
      aria-hidden
      style={{ scaleX: width }}
      className="fixed inset-x-0 top-0 z-[70] h-[2px] origin-left bg-gradient-to-r from-neon-deep via-neon to-neon-bright shadow-neon"
    />
  );
}
