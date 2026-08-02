"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CreditCard, BadgePercent } from "lucide-react";
import { checkoutAction } from "./actions";

export default function CheckoutForm({ planCode }: { planCode: string }) {
  const [state, formAction] = useActionState(checkoutAction, null);
  const [method, setMethod] = useState("");
  const reduce = useReducedMotion();

  return (
    <motion.form
      action={formAction}
      className="mt-6 space-y-5"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <input type="hidden" name="plan" value={planCode} />

      <AnimatePresence>
        {state?.error && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={reduce ? undefined : { opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-lg border border-[var(--critical)]/35 bg-[var(--critical)]/10 px-4 py-3 text-[13px] text-[#ff9a9a]"
          >
            {state.error}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
      >
        <label className="block text-[12px] font-medium text-white/45">Cupao</label>
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2">
          <BadgePercent size={16} className="text-white/30" />
          <input
            name="coupon"
            placeholder="CODIGO"
            className="min-w-0 flex-1 bg-transparent text-[14px] uppercase text-white outline-none placeholder:text-white/20"
          />
        </div>
      </motion.div>

      <div className="grid gap-3">
        {[
          ["card", "Cartao credito/debito"],
          ["apple_pay", "Apple Pay"],
          ["paypal", "PayPal"],
        ].map(([value, label], index) => (
          <PaymentOption
            key={value}
            value={value}
            label={label}
            selected={method === value}
            onSelect={() => setMethod(value)}
            index={index}
          />
        ))}
      </div>

      <Submit />
    </motion.form>
  );
}

function PaymentOption({
  value,
  label,
  selected,
  onSelect,
  index,
}: {
  value: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.label
      initial={reduce ? false : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: 0.1 + index * 0.045, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { x: 3, borderColor: "rgba(214,167,91,0.45)" }}
      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-[13.5px] transition-colors ${
        selected
          ? "border-[var(--chart-1)] bg-[var(--chart-1)]/[0.08] text-white"
          : "border-white/[0.08] bg-white/[0.025] text-white/70 hover:border-[var(--chart-1)]"
      }`}
    >
      <input type="radio" name="method" value={value} required checked={selected} onChange={onSelect} className="accent-[var(--chart-1)]" />
      <CreditCard size={16} className="text-white/35" />
      <span>{label}</span>
    </motion.label>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  const reduce = useReducedMotion();
  return (
    <motion.button
      disabled={pending}
      whileHover={reduce || pending ? undefined : { y: -2 }}
      whileTap={reduce || pending ? undefined : { scale: 0.985 }}
      className="w-full rounded-lg bg-[var(--chart-1)] py-3 text-[13.5px] font-semibold text-[#16082c] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "A abrir pagamento..." : "Pagar agora"}
    </motion.button>
  );
}
