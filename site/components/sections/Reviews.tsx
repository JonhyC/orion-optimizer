"use client";

import { MessageCircle, Star } from "lucide-react";
import type { PublicReview } from "@/lib/site-data";
import { DISCORD_URL } from "@/lib/data";
import Reveal from "../ui/Reveal";

function Card({ r }: { r: PublicReview }) {
  return (
    <figure className="group w-[340px] shrink-0 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl transition-all duration-500 hover:border-neon/30 hover:bg-white/[0.04] sm:w-[400px]">
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={13}
              className={i < r.rating ? "fill-neon text-neon" : "text-white/15"}
            />
          ))}
        </div>
        {r.gain && (
          <span className="rounded-full border border-neon/20 bg-neon/[0.07] px-3 py-1 font-mono text-[11px] text-neon-soft">
            {r.gain}
          </span>
        )}
      </div>

      <blockquote className="mt-6 text-[14.5px] leading-relaxed text-white/60">
        &ldquo;{r.body}&rdquo;
      </blockquote>

      <figcaption className="mt-7 flex items-center gap-3.5 border-t border-white/[0.06] pt-5">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-neon-deep to-neon-dark text-[13px] font-bold text-white">
          {r.author_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-white/85">
            {r.author_name}
            {r.handle && <span className="font-normal text-white/30"> {r.handle}</span>}
          </div>
          {r.rig && <div className="truncate font-mono text-[11.5px] text-white/30">{r.rig}</div>}
        </div>
      </figcaption>
    </figure>
  );
}

/**
 * Carrossel infinito: a lista e duplicada e a faixa desloca-se -50%, o que
 * faz a segunda copia chegar onde a primeira comecou. Para ao passar o rato.
 *
 * So faz sentido com material suficiente para encher a faixa; abaixo disso
 * mostramos uma grelha normal, senao ve-se o salto do ciclo.
 */
function Marquee({ items, reverse = false }: { items: PublicReview[]; reverse?: boolean }) {
  const doubled = [...items, ...items];

  return (
    <div className="group/marquee relative overflow-hidden mask-fade-x">
      <div
        className="flex w-max gap-5 animate-marquee group-hover/marquee:[animation-play-state:paused]"
        style={{ animationDirection: reverse ? "reverse" : "normal" }}
      >
        {doubled.map((r, i) => (
          <Card key={`${r.id}-${i}`} r={r} />
        ))}
      </div>
    </div>
  );
}

export default function Reviews({ reviews }: { reviews: PublicReview[] }) {
  const hasEnoughToScroll = reviews.length >= 4;
  const half = Math.ceil(reviews.length / 2);

  return (
    <section id="reviews" className="relative overflow-hidden py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <Reveal>
          <span className="eyebrow">Reviews</span>
        </Reveal>

        <Reveal delay={0.08}>
          <h2 className="mt-7 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-gradient md:text-6xl">
            {reviews.length > 0 ? "What people got back." : "No reviews yet."}
          </h2>
        </Reveal>

        {reviews.length === 0 && (
          <Reveal delay={0.14}>
            <div className="mt-8 max-w-xl">
              <p className="text-[15px] leading-relaxed text-white/45">
                We just launched, so there is nothing here yet — and we would rather
                show you an empty section than invent testimonials. Every review that
                appears here will come from a real customer, with their real hardware
                and their real before/after numbers.
              </p>
              <a
                href={DISCORD_URL}
                className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3 text-[13.5px] font-semibold text-white/80 transition-colors hover:border-neon/50 hover:text-white"
              >
                <MessageCircle size={15} />
                Ask us anything on Discord
              </a>
            </div>
          </Reveal>
        )}
      </div>

      {reviews.length > 0 &&
        (hasEnoughToScroll ? (
          <div className="mt-16 space-y-5">
            <Marquee items={reviews.slice(0, half)} />
            <Marquee items={reviews.slice(half)} reverse />
          </div>
        ) : (
          <div className="mx-auto mt-16 flex max-w-7xl flex-wrap gap-5 px-6 md:px-10">
            {reviews.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </div>
        ))}
    </section>
  );
}
