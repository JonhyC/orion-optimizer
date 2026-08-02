"use client";

import { ArrowRight, MessageCircle } from "lucide-react";
import MagneticButton from "../ui/MagneticButton";
import Reveal from "../ui/Reveal";
import { DISCORD_URL } from "@/lib/data";

export default function Cta() {
  return (
    <section id="contact" className="relative overflow-hidden">
      <div className="section">
        <Reveal>
          <div className="glow-border is-active orion-banner-surface relative overflow-hidden rounded-3xl border border-neon/[0.16] px-8 py-20 text-center backdrop-blur-xl md:px-16">
            <div aria-hidden className="orion-rings -left-40 -top-36 h-[360px] w-[360px] opacity-55" />
            <div aria-hidden className="orion-rings -right-52 bottom-[-210px] h-[520px] w-[520px] rotate-12 opacity-60" />
            <div aria-hidden className="orion-dots bottom-8 left-8" />
            <div aria-hidden className="orion-sheen left-1/2 top-0 w-[520px] -translate-x-1/2" />

            <div className="relative">
              <h2 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-gradient md:text-6xl">
                Your hardware is already
                <br />
                faster than this.
              </h2>

              <p className="mx-auto mt-7 max-w-lg text-[15.5px] leading-relaxed text-white/45">
                Tell us your specs and what you play. We&rsquo;ll give you an honest
                estimate of what we can recover — before you pay anything.
              </p>

              <div className="mt-12 flex flex-wrap items-center justify-center gap-5">
                <MagneticButton href="#packages">
                  BUY NOW
                  <ArrowRight size={17} />
                </MagneticButton>
                <MagneticButton href={DISCORD_URL} variant="ghost" strength={0.2}>
                  <MessageCircle size={16} />
                  Join the Discord
                </MagneticButton>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
