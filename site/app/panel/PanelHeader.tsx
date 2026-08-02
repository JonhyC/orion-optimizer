"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, LayoutDashboard, LogOut, ShieldCheck, X } from "lucide-react";
import { OrionGlyph } from "@/components/ui/PageLoader";
import { logoutAction } from "./actions";

export type AdminLink = {
  href: string;
  label: string;
  detail: string;
};

export type PanelHeaderUser = {
  username: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
};

export default function PanelHeader({
  user,
  hasDashboard,
  adminLinks,
  supportUnread = 0,
  staffSupportUnread = 0,
}: {
  user: PanelHeaderUser;
  hasDashboard: boolean;
  adminLinks: AdminLink[];
  supportUnread?: number;
  staffSupportUnread?: number;
}) {
  const [adminOpen, setAdminOpen] = useState(false);
  const [supportCounts, setSupportCounts] = useState({ mine: supportUnread, staff: staffSupportUnread });
  const isAdmin = adminLinks.length > 0;

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/support/unread", { cache: "no-store" });
        const data = await response.json();
        if (!cancelled && data?.ok) setSupportCounts({ mine: Number(data.mine ?? 0), staff: Number(data.staff ?? 0) });
      } catch {
        // Sem ruido visual: o badge inicial continua valido.
      }
    };
    const timer = window.setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.adminDrawer = adminOpen ? "open" : "closed";
    return () => {
      document.documentElement.dataset.adminDrawer = "closed";
    };
  }, [adminOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--chart-1)]/[0.10] bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1180px] min-w-0 flex-wrap items-center gap-x-7 gap-y-3 px-6 py-3.5">
          <Link href="/panel" className="flex items-center gap-2.5">
            <OrionGlyph className="h-7 w-7" />
            <span className="text-[13px] font-bold tracking-[0.14em] text-white">ORION 2.0</span>
          </Link>

          <nav className="order-3 flex w-full min-w-0 items-center gap-5 overflow-x-auto whitespace-nowrap pb-1 text-[13.5px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:order-none lg:w-auto lg:gap-6 lg:overflow-visible lg:pb-0">
            {hasDashboard && (
              <Link href="/panel/dashboard" className="text-white/55 transition-colors hover:text-white">
                Area Pessoal
              </Link>
            )}
            <Link href="/panel" className="text-white/55 transition-colors hover:text-white">
              A minha conta
            </Link>
            {hasDashboard && (
              <Link href="/panel/active-optimizations" className="text-white/55 transition-colors hover:text-white">
                Otimizacoes Ativas
              </Link>
            )}
            <Link href="/panel/support" className="inline-flex items-center gap-1.5 text-white/55 transition-colors hover:text-white">
              Suporte
              {supportCounts.mine > 0 && <span className="rounded-full bg-[var(--chart-1)] px-1.5 py-0.5 text-[10px] font-bold text-black">{supportCounts.mine}</span>}
            </Link>
            <Link href="/" className="text-white/30 transition-colors hover:text-white/70">
              Ver site
            </Link>
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-3">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setAdminOpen(true)}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--chart-1)]/35 bg-[var(--chart-1)]/[0.08] px-3 text-[12px] font-bold text-[var(--chart-1)] transition-colors hover:bg-[var(--chart-1)]/15"
              >
                <ShieldCheck size={14} />
                Admin
              </button>
            )}

            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar user={user} />
              <div className="hidden min-w-0 flex-col leading-tight sm:flex">
                <span className="max-w-[150px] truncate text-[12.5px] font-semibold text-white/70">
                  {user.displayName}
                </span>
                <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--chart-1)]">
                  {user.role}
                </span>
              </div>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/45 transition-colors hover:border-white/25 hover:text-white"
                aria-label="Terminar sessao"
              >
                <LogOut size={14} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {adminOpen && (
          <motion.div
            className="fixed inset-0 z-[80]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <motion.button
              type="button"
              aria-label="Fechar menu admin"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setAdminOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            />
            <motion.aside
              className="orion-banner-surface absolute right-0 top-0 h-full w-full max-w-[360px] overflow-y-auto border-l border-[var(--chart-1)]/20 p-5 shadow-2xl"
              initial={{ x: 380, opacity: 0.75 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0.75 }}
              transition={{ type: "spring", stiffness: 360, damping: 34, mass: 0.9 }}
            >
              <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--chart-1)]">Admin</p>
                <h2 className="mt-1 text-lg font-bold text-white">Paginas administrativas</h2>
              </div>
              <button
                type="button"
                onClick={() => setAdminOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/55 hover:text-white"
                aria-label="Fechar"
              >
                <X size={17} />
              </button>
              </div>

              <motion.div
                className="mt-5 flex items-center gap-3 rounded-lg border border-white/[0.07] bg-black/35 p-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ delay: 0.06, duration: 0.22 }}
              >
              <Avatar user={user} large />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user.displayName}</p>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-[var(--chart-1)]">{user.role}</p>
              </div>
              </motion.div>

              <nav className="mt-6 grid gap-2">
              {adminLinks.map((link) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.22, delay: 0.08 + adminLinks.indexOf(link) * 0.035 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setAdminOpen(false)}
                    className="group flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] p-3 text-left transition-colors hover:border-[var(--chart-1)]/35 hover:bg-[var(--chart-1)]/[0.06]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--chart-1)]/20 bg-[var(--chart-1)]/[0.08] text-[var(--chart-1)]">
                      <LayoutDashboard size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-white">{link.label}</span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-white/35">{link.detail}</span>
                    </span>
                    {link.href === "/panel/admin/support" && supportCounts.staff > 0 && (
                      <span className="rounded-full bg-[var(--chart-1)] px-2 py-1 text-[10px] font-bold text-black">{supportCounts.staff}</span>
                    )}
                    <ChevronRight size={15} className="text-white/25 transition-colors group-hover:text-[var(--chart-1)]" />
                  </Link>
                </motion.div>
              ))}
              </nav>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Avatar({ user, large = false }: { user: PanelHeaderUser; large?: boolean }) {
  const size = large ? "h-11 w-11" : "h-8 w-8";
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className={`${size} shrink-0 rounded-full border border-[var(--chart-1)]/25 object-cover`}
      />
    );
  }

  return (
    <span className={`${size} grid shrink-0 place-items-center rounded-full border border-[var(--chart-1)]/25 bg-[var(--chart-1)]/10 text-xs font-bold text-[var(--chart-1)]`}>
      {user.displayName.charAt(0).toUpperCase()}
    </span>
  );
}
