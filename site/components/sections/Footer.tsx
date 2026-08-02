"use client";

import { MessageCircle, ShieldCheck, FileText, LifeBuoy, LogIn } from "lucide-react";
import { OrionGlyph } from "../ui/PageLoader";
import { DISCORD_URL } from "@/lib/data";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Results", href: "#results" },
      { label: "Packages", href: "#packages" },
      { label: "Process", href: "#process" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Sign in", href: "/panel/login", icon: LogIn },
      { label: "Discord Community", href: DISCORD_URL, icon: MessageCircle },
      { label: "Support", href: "#contact", icon: LifeBuoy },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms", icon: FileText },
      { label: "Privacy Policy", href: "/privacy", icon: ShieldCheck },
      { label: "Refund Policy", href: "/refunds" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06] bg-ink-950">
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-10">
        <div className="grid gap-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-3">
              <OrionGlyph className="h-11 w-11" />
              <div>
                <div className="text-[15px] font-bold tracking-[0.22em] text-white">
                  ORION
                </div>
                <div className="text-[10.5px] font-semibold tracking-[0.3em] text-neon">
                  OPTIMIZER
                </div>
              </div>
            </div>

            <p className="mt-6 max-w-xs text-[13.5px] leading-relaxed text-white/35">
              Professional Windows optimization. Every change measured, logged and
              reversible — including the ones we talk you out of.
            </p>

            <div className="mt-7 font-mono text-[11px] tracking-[0.2em] text-white/25">
              OTIMIZA. MELHORA. DOMINA.
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                {col.title}
              </h3>
              <ul className="mt-5 space-y-3.5">
                {col.links.map((l) => {
                  const Icon = "icon" in l ? l.icon : undefined;
                  return (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="group inline-flex items-center gap-2 text-[13.5px] text-white/40 transition-colors hover:text-neon"
                      >
                        {Icon && <Icon size={14} className="opacity-60" />}
                        {l.label}
                        <span className="h-px w-0 bg-neon transition-all duration-300 group-hover:w-3" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 text-[12.5px] text-white/25 sm:flex-row">
          <span>&copy; {new Date().getFullYear()} Orion Optimizer 2.0. All rights reserved.</span>
          <span>
            Not affiliated with Microsoft. Windows is a trademark of Microsoft
            Corporation.
          </span>
        </div>
      </div>
    </footer>
  );
}
