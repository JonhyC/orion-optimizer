"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "framer-motion";
import { LogIn, Menu, UserRound, X } from "lucide-react";
import { OrionGlyph } from "./ui/PageLoader";
import MagneticButton from "./ui/MagneticButton";

const links = [
  { href: "#features", label: "Features" },
  { href: "#results", label: "Results" },
  { href: "#packages", label: "Packages" },
  { href: "#process", label: "Process" },
  { href: "#reviews", label: "Reviews" },
  { href: "#faq", label: "FAQ" },
];

/**
 * `signedIn` vem do servidor (a pagina le a cookie de sessao). Sem isso o
 * cabecalho piscava "Sign in" antes de saber que ha sessao aberta.
 */
export default function Nav({ signedIn = false }: { signedIn?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();

  const account = signedIn
    ? { href: "/panel/dashboard", label: "My profile", Icon: UserRound }
    : { href: "/panel/login", label: "Sign in", Icon: LogIn };

  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 40));

  // Trava o scroll de fundo enquanto o menu movel esta aberto.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <motion.header
        initial={false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? "border-b border-white/[0.06] bg-void/70 backdrop-blur-2xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <nav className="mx-auto flex max-w-7xl items-center gap-8 px-6 py-4 md:px-10">
          <a href="#top" className="group flex items-center gap-3">
            <OrionGlyph className="h-9 w-9 transition-transform duration-500 group-hover:rotate-12" />
            <span className="text-[15px] font-bold tracking-[0.14em] text-white">
              ORION 2.0
            </span>
          </a>

          <ul className="ml-auto hidden items-center gap-9 lg:flex">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="group relative text-[13.5px] font-medium text-white/60 transition-colors hover:text-white"
                >
                  {l.label}
                  <span className="absolute -bottom-1.5 left-0 h-px w-full origin-right scale-x-0 bg-neon transition-transform duration-300 group-hover:origin-left group-hover:scale-x-100" />
                </a>
              </li>
            ))}
          </ul>

          <div className="ml-auto hidden items-center gap-5 lg:ml-0 lg:flex">
            <a
              href={account.href}
              className="group inline-flex items-center gap-2 text-[13.5px] font-medium text-white/60 transition-colors hover:text-white"
            >
              <account.Icon size={15} />
              {account.label}
            </a>

            <MagneticButton href="#packages" className="!px-6 !py-3 !text-[13px]">
              BUY NOW
            </MagneticButton>
          </div>

          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="ml-auto rounded-xl border border-white/10 p-2.5 text-white/80 lg:hidden"
          >
            <Menu size={18} />
          </button>
        </nav>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-void/95 backdrop-blur-2xl lg:hidden"
          >
            <div className="flex items-center justify-between px-6 py-4">
              <OrionGlyph className="h-9 w-9" />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-xl border border-white/10 p-2.5 text-white/80"
              >
                <X size={18} />
              </button>
            </div>

            <ul className="mt-10 flex flex-col gap-2 px-8">
              {links.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-white/5 py-5 text-2xl font-semibold text-white/85"
                  >
                    {l.label}
                  </a>
                </motion.li>
              ))}
            </ul>

            <div className="space-y-4 px-8 pt-10">
              <MagneticButton href="#packages" className="w-full">
                BUY NOW
              </MagneticButton>

              <a
                href={account.href}
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 py-3.5 text-[14px] font-semibold text-white/75 transition-colors hover:border-neon/50 hover:text-white"
              >
                <account.Icon size={15} />
                {account.label}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
