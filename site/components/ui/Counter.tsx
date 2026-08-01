"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * Contador que arranca quando entra no ecra.
 *
 * A saida usa tabular-nums para os digitos nao dancarem de largura enquanto
 * o numero sobe - sem isso o layout treme.
 */
export default function Counter({
  to,
  from = 0,
  duration = 1900,
  decimals = 0,
  suffix = "",
  prefix = "",
  className = "",
}: {
  to: number;
  from?: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  // Arranca no valor FINAL, nao em zero. O HTML gerado no servidor tem de
  // conter o numero verdadeiro: caso contrario os precos sao servidos como
  // "0.00" a quem tem JavaScript desligado e aos motores de busca.
  const [value, setValue] = useState(to);
  const [armed, setArmed] = useState(false);

  // Ja no cliente, recua para o inicio para que a contagem tenha de onde subir.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    setValue(from);
    setArmed(true);
  }, [from]);

  useEffect(() => {
    if (!inView || !armed) return;

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, armed, to, from, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
