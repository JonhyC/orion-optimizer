"use client";

import { Check, Maximize2, Megaphone, Zap } from "lucide-react";
import MagneticButton from "../ui/MagneticButton";

export type PlanCardData = {
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  days: number;
  support_days: number | null;
  cover_url: string | null;
  badge_text: string | null;
  badge_active: number;
  compare_at_cents: number | null;
  discount_active: number;
  promo_text: string | null;
  features: string[];
  cta_text: string;
};

export default function PlanCardDisplay({
  plan,
  preview = false,
  onCoverOpen,
}: {
  plan: PlanCardData;
  preview?: boolean;
  onCoverOpen?: () => void;
}) {
  const badge = plan.badge_active === 1 && plan.badge_text ? plan.badge_text : null;
  const featured = badge !== null;
  const discounted = plan.discount_active === 1 &&
    plan.compare_at_cents !== null &&
    plan.compare_at_cents > plan.price_cents;
  const discountPercent = discounted
    ? Math.round((1 - plan.price_cents / plan.compare_at_cents!) * 100)
    : 0;
  const features = [...plan.features];
  if (plan.support_days !== null) {
    features.push(
      plan.support_days === 0
        ? "Life-time support"
        : `${plan.support_days} days of support`,
    );
  }

  return (
    <div
      className={`glow-border relative flex h-full flex-col rounded-2xl border p-8 backdrop-blur-xl ${
        featured
          ? "is-active border-neon/35 bg-gradient-to-b from-neon/[0.09] to-white/[0.02]"
          : "border-white/[0.07] bg-white/[0.02]"
      }`}
    >
      {badge && (
        <div className="pointer-events-none absolute -top-3.5 left-1/2 z-30 -translate-x-1/2">
          <span className="inline-flex max-w-[min(300px,calc(100vw-3rem))] items-center gap-1.5 rounded-full bg-gradient-to-r from-neon-deep to-neon px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-void shadow-neon">
            <Zap size={11} />
            <span className="truncate">{badge}</span>
          </span>
        </div>
      )}

      {plan.cover_url && (
        <button
          type="button"
          onClick={onCoverOpen}
          disabled={!onCoverOpen}
          title={onCoverOpen ? "View cover" : undefined}
          className="group/cover relative z-0 -mx-8 -mt-8 mb-7 block aspect-[16/9] overflow-hidden rounded-t-[15px] border-b border-white/[0.07] bg-white/[0.02] text-left disabled:cursor-default"
        >
          <img
            src={plan.cover_url}
            alt={`Cover for ${plan.name}`}
            className="h-full w-full object-cover transition-transform duration-700 group-hover/cover:scale-[1.03]"
          />
          {onCoverOpen && (
            <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md border border-white/15 bg-black/55 text-white/70 opacity-0 backdrop-blur-md transition-opacity group-hover/cover:opacity-100">
              <Maximize2 size={14} />
            </span>
          )}
        </button>
      )}

      <h3 className="text-xl font-bold tracking-tight text-white">{plan.name}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/40">
        {plan.description || "Orion Optimizer access."}
      </p>

      {discounted && plan.promo_text && (
        <div className="mt-5 flex items-start gap-2 border-l-2 border-neon bg-neon/[0.06] px-3 py-2.5 text-[12px] font-medium leading-relaxed text-neon">
          <Megaphone size={14} className="mt-0.5 shrink-0" />
          <span>{plan.promo_text}</span>
        </div>
      )}

      <div className={discounted && plan.promo_text ? "mt-5" : "mt-8"}>
        {discounted && (
          <div className="mb-1.5 flex items-center gap-2 text-[13px] text-white/35">
            <span className="line-through decoration-white/45">
              {plan.currency} {(plan.compare_at_cents! / 100).toFixed(2)}
            </span>
            <span className="rounded-sm bg-neon/15 px-1.5 py-0.5 text-[10px] font-bold text-neon">
              -{discountPercent}%
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold text-white/50">{plan.currency}</span>
          <span className={`font-mono text-6xl font-extrabold tracking-tighter ${
            featured || discounted ? "text-neon" : "text-white"
          }`}>
            {(plan.price_cents / 100).toFixed(2)}
          </span>
        </div>
      </div>
      <div className="mt-1.5 text-[12.5px] text-white/35">
        {plan.days === 0 ? "life-time" : `${plan.days} days`} - no subscription
      </div>
      <div className="mt-1 text-[12.5px] text-white/35">
        Support: {plan.support_days === null
          ? "not included"
          : plan.support_days === 0
            ? "life-time"
            : `${plan.support_days} days`}
      </div>

      <div className="my-8 hairline" />

      <ul className="flex-1 space-y-3.5">
        {features.map((feature, index) => (
          <li key={`${feature}-${index}`} className="flex items-start gap-3 text-[14px] text-white/60">
            <span className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full ${
              featured ? "bg-neon/20 text-neon" : "bg-white/[0.07] text-white/50"
            }`}>
              <Check size={11} strokeWidth={3} />
            </span>
            <span className="min-w-0 break-words">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10">
        {preview ? (
          <button
            type="button"
            className={`w-full rounded-full border px-6 py-3 text-[13px] font-semibold ${
              featured
                ? "border-neon bg-neon text-void"
                : "border-white/15 bg-white/[0.03] text-white"
            }`}
          >
            {plan.cta_text}
          </button>
        ) : (
          <MagneticButton
            href="#contact"
            variant={featured ? "primary" : "ghost"}
            strength={0.22}
            className="w-full"
          >
            {plan.cta_text}
          </MagneticButton>
        )}
      </div>
    </div>
  );
}
