"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import type { OptimizerRelease } from "@/lib/optimizer-release";
import { compareVersions, formatBytes, timeAgo, updateState } from "@/lib/version";

/**
 * Cartao de actualizacao do Optimizer.
 *
 * O painel e uma pagina web e a aplicacao e um processo separado: o botao
 * abre `orion-optimizer://update`, o Electron trata do resto e o painel
 * nao ve o progresso do download. Nao da para inventar uma percentagem
 * que nao se conhece, por isso o que se mostra e uma barra indeterminada
 * e o tempo decorrido - honesto sobre o que se sabe.
 *
 * Como o painel nao recebe eventos, deteta o fim pelo unico sinal que tem:
 * a versao instalada, que o servidor volta a enviar a cada refresh. Quando
 * essa versao alcanca a publicada, a actualizacao terminou.
 */

/** Ao fim disto propoe-se o instalador manual: algo correu mal em silencio. */
const SEGUNDOS_ATE_ALTERNATIVA = 45;
const SEGUNDOS_ENTRE_VERIFICACOES = 8;
// A 1.1.1 foi distribuida com o atualizador antigo em alguns ambientes.
// Ate a 1.1.2 estar instalada, usar sempre o setup publicado na Release.
const VERSAO_COM_FEED_DE_UPDATE = "1.1.2";

type Fase = "parado" | "a-atualizar" | "concluida";

export default function OptimizerActions({
  installedVersion,
  release,
  dismissible = false,
}: {
  installedVersion: string | null;
  release: OptimizerRelease;
  dismissible?: boolean;
}) {
  const router = useRouter();
  const reduzirMovimento = useReducedMotion();
  const [origin, setOrigin] = useState("");
  const [quando, setQuando] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>("parado");
  const [segundos, setSegundos] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const versaoAoIniciar = useRef<string | null>(null);

  const estado = updateState(release, installedVersion);
  const desactualizado = estado === "disponivel" || estado === "obrigatoria" || estado === "desconhecida";
  const obrigatoria = estado === "obrigatoria";

  // Versoes antigas ignoram o feed enviado pelo site e podem tentar ir buscar
  // o instalador ao servidor guardado localmente. Nelas, o caminho fiavel e o
  // instalador direto.
  const suportaAuto = Boolean(
    installedVersion && compareVersions(installedVersion, VERSAO_COM_FEED_DE_UPDATE) >= 0,
  );

  useEffect(() => {
    setOrigin(window.location.origin);
    setQuando(timeAgo(release.releasedAt));
    setDismissed(false);
  }, [release.releasedAt, release.version]);

  // O manifesto e as regras por plano/cargo podem mudar no painel admin
  // enquanto o cliente tem o dashboard aberto. Refrescar os dados de servidor
  // mantem o popup sincronizado sem obrigar a recarregar a pagina.
  useEffect(() => {
    if (fase === "a-atualizar") return;
    const timer = window.setInterval(() => router.refresh(), SEGUNDOS_ENTRE_VERIFICACOES * 1000);
    const aoFocar = () => router.refresh();
    const aoVisivel = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoVisivel);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", aoFocar);
      document.removeEventListener("visibilitychange", aoVisivel);
    };
  }, [fase, router]);

  // Enquanto atualiza: refrescar para o servidor dizer a versao instalada,
  // e contar o tempo para poder oferecer alternativa se encravar.
  useEffect(() => {
    if (fase !== "a-atualizar") return;
    const t = window.setInterval(() => {
      setSegundos((s) => s + 1);
      router.refresh();
    }, 1000);
    const aoFocar = () => router.refresh();
    window.addEventListener("focus", aoFocar);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", aoFocar);
    };
  }, [fase, router]);

  // A versao instalada subiu depois de termos comecado: acabou.
  useEffect(() => {
    if (fase !== "a-atualizar" || !installedVersion) return;
    const antes = versaoAoIniciar.current;
    if (antes && compareVersions(installedVersion, antes) > 0) {
      setFase("concluida");
      const t = window.setTimeout(() => setFase("parado"), 6000);
      return () => window.clearTimeout(t);
    }
  }, [fase, installedVersion]);

  const hrefAtualizar = useMemo(() => {
    if (!origin) return release.downloadPath;
    const url = new URL(release.downloadPath, origin).toString();
    const feed = new URL("/downloads/windows/", origin).toString();
    const p = new URLSearchParams({ version: release.version, url, feed, sha256: release.sha256 });
    return `orion-optimizer://update?${p.toString()}`;
  }, [origin, release]);

  const tamanho = formatBytes(release.sizeBytes);
  const anim = reduzirMovimento ? {} : undefined;

  if (dismissible && dismissed && fase === "parado") return null;

  // --- Actualizada: nao roubar espaco a quem nao tem nada a fazer -------
  if (!desactualizado && fase === "parado") {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <a
          href="orion-optimizer://open"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--chart-1)] px-4 py-2.5 text-[13px] font-semibold text-[#16082c] transition-opacity hover:opacity-90"
        >
          <ExternalLink size={15} />
          Abrir Optimizer
        </a>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--good)]">
          <Check size={13} />
          Versão {installedVersion} · atualizada
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={reduzirMovimento ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`update-popup relative w-full max-w-md overflow-hidden rounded-2xl border bg-[var(--panel-surface)] ${
        obrigatoria
          ? "border-[var(--warning)]/40"
          : "border-[var(--chart-1)]/25"
      }`}
    >
      {dismissible && fase === "parado" && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-black/30 text-white/40 backdrop-blur transition-colors hover:border-[var(--chart-1)]/35 hover:bg-[var(--chart-1)]/10 hover:text-white"
          aria-label="Fechar pop-up de atualização"
          title="Fechar"
        >
          <X size={15} />
        </button>
      )}

      {/* Faixa superior: da cor ao cartao sem pintar o fundo todo. */}
      <div
        className={`h-[3px] w-full ${
          obrigatoria
            ? "bg-gradient-to-r from-[var(--warning)] to-[var(--warning)]/30"
            : "bg-gradient-to-r from-[var(--chart-1)] to-[var(--chart-1)]/20"
        }`}
      />

      <div className={dismissible ? "p-5 pr-12" : "p-5"}>
        <AnimatePresence mode="wait" initial={false}>
          {fase === "concluida" ? (
            <Concluida key="ok" versao={installedVersion ?? release.version} reduzir={!!reduzirMovimento} />
          ) : fase === "a-atualizar" ? (
            <AAtualizar
              key="a-atualizar"
              segundos={segundos}
              alternativa={release.downloadPath}
              reduzir={!!reduzirMovimento}
            />
          ) : (
            <motion.div key="disponivel" exit={anim ?? { opacity: 0 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      obrigatoria
                        ? "bg-[var(--warning)]/12 text-[var(--warning)]"
                        : "bg-[var(--chart-1)]/12 text-[var(--chart-1)]"
                    }`}
                  >
                    {obrigatoria ? <AlertTriangle size={17} /> : <Sparkles size={17} />}
                  </span>
                  <div>
                    <h3 className="text-[14px] font-semibold text-white">
                      {obrigatoria ? "Atualização necessária" : "Nova versão disponível"}
                    </h3>
                    <VersaoParaVersao
                      de={installedVersion}
                      para={release.version}
                      reduzir={!!reduzirMovimento}
                    />
                  </div>
                </div>
                {obrigatoria && (
                  <motion.span
                    animate={reduzirMovimento ? {} : { opacity: [1, 0.55, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    className="shrink-0 rounded-full bg-[var(--warning)]/12 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--warning)]"
                  >
                    Obrigatória
                  </motion.span>
                )}
              </div>

              {obrigatoria && (
                <p className="mt-3 text-[12px] leading-relaxed text-[var(--warning)]/90">
                  A versão instalada tem um problema conhecido e deixou de ser
                  suportada. Atualiza antes de voltares a otimizar.
                </p>
              )}

              {release.notes && release.notes.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {release.notes.slice(0, 6).map((nota, i) => (
                    <motion.li
                      key={nota}
                      initial={reduzirMovimento ? false : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.12 + i * 0.055, duration: 0.3 }}
                      className="flex gap-2 text-[12.5px] leading-relaxed text-white/55"
                    >
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--chart-1)]/70" />
                      {nota}
                    </motion.li>
                  ))}
                </ul>
              )}

              {(tamanho || quando) && (
                <p className="mt-3.5 text-[11px] text-white/25">
                  {[tamanho, quando].filter(Boolean).join(" · ")}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2.5">
                <a
                  href={suportaAuto ? hrefAtualizar : release.downloadPath}
                  download={suportaAuto ? undefined : true}
                  onClick={() => {
                    if (!suportaAuto) return;
                    versaoAoIniciar.current = installedVersion;
                    setSegundos(0);
                    setFase("a-atualizar");
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-opacity hover:opacity-90 ${
                    obrigatoria
                      ? "bg-[var(--warning)] text-[#2a1c00]"
                      : "bg-[var(--chart-1)] text-[#16082c]"
                  }`}
                >
                  <RefreshCw size={15} />
                  {suportaAuto ? "Atualizar agora" : "Descarregar instalador"}
                </a>
                {suportaAuto && (
                  <a
                    href={release.downloadPath}
                    download
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[var(--panel-surface-2)] px-4 py-2.5 text-[13px] font-semibold text-white/70 transition-colors hover:border-[var(--chart-1)]/50 hover:text-white"
                  >
                    <Download size={15} />
                    Instalador
                  </a>
                )}
              </div>

              {!installedVersion && (
                <p className="mt-3 text-[11px] leading-relaxed text-white/25">
                  Ainda não sabemos que versão tens instalada — abre o Optimizer
                  uma vez para o painel a registar.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** `1.0.5 → 1.0.6`, com a seta a deslizar para sugerir a passagem. */
function VersaoParaVersao({
  de,
  para,
  reduzir,
}: {
  de: string | null;
  para: string;
  reduzir: boolean;
}) {
  return (
    <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11.5px]">
      <span className="text-white/30">{de ?? "desconhecida"}</span>
      <motion.span
        animate={reduzir ? {} : { x: [0, 3, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="text-[var(--chart-1)]"
      >
        <ArrowRight size={12} />
      </motion.span>
      <span className="font-semibold text-white/80">{para}</span>
    </div>
  );
}

function AAtualizar({
  segundos,
  alternativa,
  reduzir,
}: {
  segundos: number;
  alternativa: string;
  reduzir: boolean;
}) {
  const demorado = segundos >= SEGUNDOS_ATE_ALTERNATIVA;

  return (
    <motion.div
      initial={reduzir ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex items-center gap-2.5">
        <motion.span
          animate={reduzir ? {} : { rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--chart-1)]/12 text-[var(--chart-1)]"
        >
          <RefreshCw size={17} />
        </motion.span>
        <div>
          <h3 className="text-[14px] font-semibold text-white">A atualizar…</h3>
          <p className="mt-0.5 text-[11.5px] text-white/35">
            A aplicação fecha e reabre sozinha quando terminar.
          </p>
        </div>
      </div>

      {/* Barra indeterminada: o painel nao recebe o progresso real do
          download, e desenhar uma percentagem inventada seria mentir. */}
      <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          animate={reduzir ? { opacity: 0.6 } : { x: ["-60%", "160%"] }}
          transition={
            reduzir
              ? {}
              : { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
          }
          className="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-transparent via-[var(--chart-1)] to-transparent"
        />
      </div>

      <p className="mt-3 text-[11px] tabular-nums text-white/25">
        {segundos}s decorridos
      </p>

      <AnimatePresence>
        {demorado && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 overflow-hidden"
          >
            <p className="text-[11.5px] leading-relaxed text-white/45">
              Está a demorar mais do que o normal. Se não aconteceu nada, a
              aplicação pode não ter recebido o pedido —{" "}
              <a href={alternativa} download className="text-[var(--chart-1)] hover:underline">
                instala manualmente
              </a>
              .
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Concluida({ versao, reduzir }: { versao: string; reduzir: boolean }) {
  return (
    <motion.div
      initial={reduzir ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2.5"
    >
      <motion.span
        initial={reduzir ? false : { scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 16 }}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--good)]/12 text-[var(--good)]"
      >
        <Check size={18} />
      </motion.span>
      <div>
        <h3 className="text-[14px] font-semibold text-white">Atualizada</h3>
        <p className="mt-0.5 font-mono text-[11.5px] text-[var(--good)]">versão {versao}</p>
      </div>
    </motion.div>
  );
}
