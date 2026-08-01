"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, RefreshCw } from "lucide-react";
import type { OptimizerRelease } from "@/lib/optimizer-release";

export default function OptimizerActions({
  installedVersion,
  release,
}: {
  installedVersion: string | null;
  release: OptimizerRelease;
}) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [updateStarted, setUpdateStarted] = useState(false);
  const outdated = !installedVersion || compareVersions(installedVersion, release.version) < 0;
  const supportsAutoUpdate = Boolean(
    installedVersion && compareVersions(installedVersion, "1.0.0") >= 0,
  );

  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!updateStarted || !outdated) return;
    const refresh = window.setInterval(() => router.refresh(), 4000);
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(refresh);
      window.removeEventListener("focus", onFocus);
    };
  }, [outdated, router, updateStarted]);

  const updateHref = useMemo(() => {
    if (!origin) return release.downloadPath;
    const downloadUrl = new URL(release.downloadPath, origin).toString();
    const params = new URLSearchParams({
      version: release.version,
      url: downloadUrl,
      sha256: release.sha256,
    });
    return `orion-optimizer://update?${params.toString()}`;
  }, [origin, release]);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <a
        href={outdated ? (supportsAutoUpdate ? updateHref : release.downloadPath) : "orion-optimizer://open"}
        download={outdated && !supportsAutoUpdate ? true : undefined}
        onClick={() => outdated && supportsAutoUpdate && setUpdateStarted(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--chart-1)] px-4 py-2.5 text-[13px] font-semibold text-[#16082c] transition-opacity hover:opacity-90"
      >
        {outdated ? (
          <RefreshCw size={15} className={updateStarted ? "animate-spin" : ""} />
        ) : (
          <ExternalLink size={15} />
        )}
        {outdated ? (updateStarted ? "A atualizar..." : "Atualizar Optimizer") : "Abrir Optimizer"}
      </a>
      {(supportsAutoUpdate || !outdated) && (
        <a
          href={release.downloadPath}
          download
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[var(--panel-surface-2)] px-4 py-2.5 text-[13px] font-semibold text-white/70 transition-colors hover:border-[var(--chart-1)]/50 hover:text-white"
        >
          <Download size={15} />
          {outdated ? "Descarregar instalador" : "Descarregar"}
        </a>
      )}
      <span className="w-full text-[10.5px] text-white/25">
        {installedVersion ? `Instalada ${installedVersion}` : "Versao instalada ainda nao identificada"}
        {outdated ? ` · disponivel ${release.version}` : " · atualizada"}
        {outdated && !supportsAutoUpdate ? " · primeira atualizacao por instalador" : ""}
      </span>
    </div>
  );
}

function compareVersions(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
