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
          <div className="glow-border is-active relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent px-8 py-20 text-center backdrop-blur-xl md:px-16">
            <div
              aria-hidden
              className="absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 rounded-full blur-[120px]"
              style={{ background: "radial-gradient(circle, rgba(139,61,255,0.18), transparent 70%)" }}
            />

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
