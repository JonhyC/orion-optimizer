"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Gauge,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Shield,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { OrionGlyph } from "@/components/ui/PageLoader";
import {
  SCROLL_PARA_COMPACTAR,
  estaAtivo,
  itensDeNavegacao,
  quantosCabem,
  separarItens,
  type ItemNav,
} from "@/lib/navbar";
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

/** Icone por item. A lista em si vive em lib/navbar, para ser testavel. */
const ICONE: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  dashboard: LayoutDashboard,
  conta: UserRound,
  otimizacoes: Gauge,
  suporte: LifeBuoy,
  site: Globe,
};

/** Curva usada em toda a barra. Uma so, para o movimento parecer do mesmo sitio. */
const SUAVE = [0.22, 1, 0.36, 1] as const;

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
  const [maisOpen, setMaisOpen] = useState(false);
  const [supportCounts, setSupportCounts] = useState({ mine: supportUnread, staff: staffSupportUnread });
  const [compacta, setCompacta] = useState(false);
  const isAdmin = adminLinks.length > 0;
  const caminho = usePathname();
  const reduzirMovimento = useReducedMotion();

  const itens = itensDeNavegacao({ temDashboard: hasDashboard });
  const { visiveis, escondidos, reguaRef, navRef } = useOverflowDaNavegacao(itens);

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

  // A barra encolhe assim que a pagina sai do topo. O listener e passivo
  // porque nao cancela o scroll - sem isso o browser espera por ele antes
  // de desenhar cada frame.
  useEffect(() => {
    const aoRolar = () => setCompacta(window.scrollY > SCROLL_PARA_COMPACTAR);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  // Mudar de pagina fecha o que estiver aberto: ficar um dropdown aberto
  // por cima de conteudo novo parece que a navegacao falhou.
  useEffect(() => {
    setMaisOpen(false);
    setAdminOpen(false);
  }, [caminho]);


  return (
    <>
      <header
        data-compacta={compacta ? "sim" : "nao"}
        className="orion-navbar sticky top-0 z-30"
      >
        {/* A linha dourada e um elemento proprio e nao um border: assim
            pode ter gradiente e desvanecer nas pontas em vez de cortar. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(214,167,91,0.22) 18%, rgba(214,167,91,0.30) 50%, rgba(214,167,91,0.22) 82%, transparent)",
          }}
        />

        <div className="orion-navbar-inner orion-container flex min-w-0 items-center">
          {/* ------------------------------------------------------ logo */}
          <Link
            href="/panel"
            className="group mr-9 flex shrink-0 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-neon/40 rounded-lg"
            aria-label="Orion 2.0 — início do painel"
          >
            <motion.span
              className="grid place-items-center"
              whileHover={reduzirMovimento ? undefined : { scale: 1.06, rotate: -3 }}
              whileTap={reduzirMovimento ? undefined : { scale: 0.97 }}
              transition={{ duration: 0.25, ease: SUAVE }}
            >
              <OrionGlyph className="h-[30px] w-[30px]" />
            </motion.span>
            <span className="text-[14.5px] font-extrabold tracking-[0.16em] text-white/92 transition-colors duration-200 group-hover:text-white">
              ORION 2.0
            </span>
          </Link>

          {/* ------------------------------------------------------ menu */}
          <nav
            ref={navRef}
            className="relative flex min-w-0 flex-1 items-center gap-1.5"
            aria-label="Navegação do painel"
          >
            {/* Regua: todos os itens montados so para medir. Vive dentro
                de uma caixa de dimensao zero com overflow escondido - sem
                isso, os 659px da regua faziam a PAGINA ganhar scroll
                horizontal em ecras estreitos. O `w-max` garante que os
                itens sao medidos a largura natural apesar da caixa ter
                largura zero. */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 h-0 w-0 overflow-hidden"
            >
              <div ref={reguaRef} className="flex w-max gap-1.5">
                {itens.map((item) => (
                  <ItemDeMenu
                    key={item.id}
                    item={item}
                    activo={false}
                    contador={item.id === "suporte" ? supportCounts.mine : 0}
                    reduzirMovimento
                    tabIndex={-1}
                  />
                ))}
              </div>
            </div>

            {visiveis.map((item) => (
              <ItemDeMenu
                key={item.id}
                item={item}
                activo={estaAtivo(caminho, item.href)}
                contador={item.id === "suporte" ? supportCounts.mine : 0}
                reduzirMovimento={Boolean(reduzirMovimento)}
              />
            ))}

            {escondidos.length > 0 && (
              <BotaoMais
                itens={escondidos}
                caminho={caminho}
                aberto={maisOpen}
                alternar={() => setMaisOpen((v) => !v)}
                fechar={() => setMaisOpen(false)}
                contadorSuporte={supportCounts.mine}
                reduzirMovimento={Boolean(reduzirMovimento)}
              />
            )}
          </nav>

          {/* ------------------------------------------------------ direita */}
          <div className="ml-6 flex shrink-0 items-center gap-2.5">
            {isAdmin && (
              <BotaoAdmin
                onClick={() => setAdminOpen(true)}
                reduzirMovimento={Boolean(reduzirMovimento)}
              />
            )}

            <BlocoPerfil user={user} reduzirMovimento={Boolean(reduzirMovimento)} />

            <form action={logoutAction}>
              <motion.button
                type="submit"
                className="group grid h-10 w-10 place-items-center rounded-[10px] border border-white/[0.08] bg-white/[0.02] text-white/45 transition-colors duration-200 hover:border-critical/40 hover:bg-critical/[0.10] hover:text-[var(--critical)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-critical/35"
                aria-label="Terminar sessão"
                title="Terminar sessão"
                whileHover={reduzirMovimento ? undefined : { y: -1 }}
                whileTap={reduzirMovimento ? undefined : { scale: 0.94 }}
                transition={{ duration: 0.18, ease: SUAVE }}
              >
                <LogOut size={17} />
              </motion.button>
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
              className="orion-banner-surface absolute right-0 top-0 h-full w-full max-w-[360px] overflow-y-auto border-l border-neon/20 p-5 shadow-2xl"
              initial={{ x: 380, opacity: 0.75 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0.75 }}
              transition={{ type: "spring", stiffness: 360, damping: 34, mass: 0.9 }}
            >
              <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--chart-1)]">Admin</p>
                <h2 className="mt-1 text-lg font-bold text-white">Páginas administrativas</h2>
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
                    className="group flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] p-3 text-left transition-colors hover:border-neon/35 hover:bg-neon/[0.06]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-neon/20 bg-neon/[0.08] text-[var(--chart-1)]">
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

/**
 * Mede a barra e decide quantos itens cabem.
 *
 * As larguras sao medidas uma vez, com todos os itens montados, num
 * contentor fora do ecra. Medir os visiveis daria larguras que mudam a
 * cada recalculo - esconder um item alarga os outros, o que voltava a
 * mudar a conta e entrava em ciclo.
 */
function useOverflowDaNavegacao(itens: ItemNav[]) {
  const [visiveisN, setVisiveisN] = useState(itens.length);
  const navRef = useRef<HTMLElement | null>(null);
  const reguaRef = useRef<HTMLDivElement | null>(null);
  const larguras = useRef<number[]>([]);

  const recalcular = useCallback(() => {
    const regua = reguaRef.current;
    const barra = navRef.current;
    if (!regua || !barra) return;

    if (larguras.current.length !== itens.length) {
      larguras.current = [...regua.children].map((filho) => {
        const rect = (filho as HTMLElement).getBoundingClientRect();
        return rect.width + 6; // 6 = o gap entre itens
      });
    }

    const disponivel = barra.getBoundingClientRect().width;
    setVisiveisN(quantosCabem(larguras.current, disponivel, 96));
  }, [itens.length]);

  // useLayoutEffect e nao useEffect: com useEffect a barra chegava a
  // pintar um frame com todos os itens antes de esconder os que nao
  // cabem, e via-se o salto.
  useLayoutEffect(() => {
    larguras.current = [];
    recalcular();

    const observador = new ResizeObserver(recalcular);
    if (navRef.current) observador.observe(navRef.current);

    // O ResizeObserver chega em qualquer browser moderno; o listener de
    // resize e uma rede de seguranca barata para ambientes onde o
    // observador nao e notificado (emulacao de viewport, por exemplo).
    window.addEventListener("resize", recalcular);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", recalcular);
    };
  }, [recalcular]);

  const { visiveis, escondidos } = separarItens(itens, visiveisN);
  return { visiveis, escondidos, reguaRef, navRef };
}

function ItemDeMenu({
  item,
  activo,
  contador,
  reduzirMovimento,
  tabIndex,
}: {
  item: ItemNav;
  activo: boolean;
  contador: number;
  reduzirMovimento: boolean;
  /** -1 na regua, para os itens medidos nao entrarem na ordem do teclado. */
  tabIndex?: number;
}) {
  const Icone = ICONE[item.id] ?? Globe;

  return (
    <Link
      href={item.href}
      tabIndex={tabIndex}
      aria-current={activo ? "page" : undefined}
      className={`group relative inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13.5px] font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-neon/40 ${
        activo
          ? "bg-neon/[0.10] text-white"
          : "text-white/52 hover:bg-white/[0.045] hover:text-white/90"
      }`}
    >
      <Icone
        size={15}
        className={`shrink-0 transition-colors duration-200 ${
          activo ? "text-[var(--chart-1)]" : "text-white/35 group-hover:text-white/60"
        }`}
      />
      <span className="whitespace-nowrap">{item.label}</span>

      {contador > 0 && (
        <span className="ml-0.5 rounded-full bg-[var(--chart-1)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-black">
          {contador}
        </span>
      )}

      {/* A linha por baixo desliza entre itens em vez de aparecer do
          nada: e o layoutId que faz a ligacao entre os dois elementos. */}
      {activo && (
        <motion.span
          layoutId={reduzirMovimento ? undefined : "nav-linha-activa"}
          className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-[var(--chart-1)]"
          transition={{ duration: 0.3, ease: SUAVE }}
        />
      )}
    </Link>
  );
}

function BotaoMais({
  itens,
  caminho,
  aberto,
  alternar,
  fechar,
  contadorSuporte,
  reduzirMovimento,
}: {
  itens: ItemNav[];
  caminho: string;
  aberto: boolean;
  alternar: () => void;
  fechar: () => void;
  contadorSuporte: number;
  reduzirMovimento: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const temActivo = itens.some((i) => estaAtivo(caminho, i.href));

  // Fecha ao clicar fora e no Escape - um dropdown que so fecha ao clicar
  // outra vez no botao e das coisas que mais denunciam um menu improvisado.
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (evento: MouseEvent) => {
      if (!ref.current?.contains(evento.target as Node)) fechar();
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") fechar();
    };
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto, fechar]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13.5px] font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-neon/40 ${
          aberto || temActivo
            ? "bg-neon/[0.10] text-white"
            : "text-white/52 hover:bg-white/[0.045] hover:text-white/90"
        }`}
      >
        Mais
        <motion.span
          className="grid place-items-center"
          animate={{ rotate: aberto ? 180 : 0 }}
          transition={{ duration: reduzirMovimento ? 0 : 0.22, ease: SUAVE }}
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            role="menu"
            className="absolute left-0 top-[calc(100%+8px)] z-40 w-[228px] overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--navbar-bg)]/95 p-1.5 shadow-2xl backdrop-blur-xl"
            initial={reduzirMovimento ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduzirMovimento ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: SUAVE }}
          >
            {itens.map((item) => {
              const Icone = ICONE[item.id] ?? Globe;
              const activo = estaAtivo(caminho, item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  role="menuitem"
                  onClick={fechar}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] transition-colors duration-200 ${
                    activo
                      ? "bg-neon/[0.10] text-white"
                      : "text-white/55 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <Icone size={15} className={activo ? "text-[var(--chart-1)]" : "text-white/35"} />
                  <span className="flex-1 whitespace-nowrap">{item.label}</span>
                  {item.id === "suporte" && contadorSuporte > 0 && (
                    <span className="rounded-full bg-[var(--chart-1)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-black">
                      {contadorSuporte}
                    </span>
                  )}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BotaoAdmin({
  onClick,
  reduzirMovimento,
}: {
  onClick: () => void;
  reduzirMovimento: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-[10px] border border-neon/35 bg-neon/[0.09] px-3.5 text-[12.5px] font-bold tracking-wide text-[var(--chart-1)] outline-none transition-colors duration-200 hover:border-neon/60 hover:bg-neon/[0.16] focus-visible:ring-2 focus-visible:ring-neon/45"
      whileHover={reduzirMovimento ? undefined : { y: -1 }}
      whileTap={reduzirMovimento ? undefined : { scale: 0.96 }}
      transition={{ duration: 0.18, ease: SUAVE }}
    >
      {/* Brilho que atravessa o botao ao passar o rato. Fica por baixo do
          conteudo e nao intercepta cliques. */}
      {!reduzirMovimento && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-neon/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
        />
      )}
      <Shield size={15} className="relative shrink-0" />
      <span className="relative">Admin</span>
    </motion.button>
  );
}

function BlocoPerfil({
  user,
  reduzirMovimento,
}: {
  user: PanelHeaderUser;
  reduzirMovimento: boolean;
}) {
  return (
    <motion.div
      className="flex min-w-0 items-center gap-2.5 rounded-[10px] border border-transparent px-2 py-1.5 transition-colors duration-200 hover:border-white/[0.08] hover:bg-white/[0.035]"
      whileHover={reduzirMovimento ? undefined : { y: -1 }}
      transition={{ duration: 0.18, ease: SUAVE }}
    >
      <span className="relative shrink-0">
        <Avatar user={user} />
        {/* Ponto de presenca: quem esta a ver a pagina esta, por
            definicao, com sessao aberta. */}
        <span
          className="absolute -bottom-0.5 -right-0.5 h-[11px] w-[11px] rounded-full border-2 border-[var(--navbar-bg)] bg-[var(--good)]"
          title="Sessão ativa"
        />
      </span>
      <div className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
        <span className="max-w-[150px] truncate text-[12.5px] font-semibold text-white/85">
          {user.displayName}
        </span>
        <span className="mt-[3px] text-[9.5px] font-bold uppercase tracking-[0.14em] text-neon/85">
          {user.role}
        </span>
      </div>
    </motion.div>
  );
}

function Avatar({ user, large = false }: { user: PanelHeaderUser; large?: boolean }) {
  const size = large ? "h-11 w-11" : "h-[34px] w-[34px]";
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className={`${size} shrink-0 rounded-full border border-neon/25 object-cover`}
      />
    );
  }

  return (
    <span className={`${size} grid shrink-0 place-items-center rounded-full border border-neon/25 bg-neon/10 text-xs font-bold text-[var(--chart-1)]`}>
      {user.displayName.charAt(0).toUpperCase()}
    </span>
  );
}
