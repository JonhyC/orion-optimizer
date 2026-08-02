import fs from "node:fs";
import path from "node:path";
// A comparacao de versoes vive em lib/version.ts, sem imports de Node, para
// o painel a poder usar do lado do cliente sem arrastar o node:fs daqui.
import { SEMVER, compareVersions } from "./version.ts";

export { compareVersions } from "./version.ts";

/**
 * Manifesto da aplicacao Orion.
 *
 * Os tres primeiros campos sao obrigatorios e sao os que a versao 1.0.5 e
 * anteriores ja liam - nao podem mudar de forma nem de nome, senao as
 * aplicacoes ja instaladas deixam de perceber a resposta.
 *
 * O resto e opcional e acrescenta o que faltava: dizer ao utilizador o que
 * mudou, e poder obrigar a actualizar quando uma versao antiga tem um
 * problema que nao se pode deixar em circulacao.
 */
export type OptimizerRelease = {
  version: string;
  downloadPath: string;
  sha256: string;
  /** O que mudou, em linhas curtas. Mostrado no painel antes de actualizar. */
  notes?: string[];
  /** Publicacao, em segundos Unix. */
  releasedAt?: number;
  /**
   * Versao minima que ainda pode ser usada. Quem estiver abaixo disto ve a
   * actualizacao como obrigatoria. Serve para tirar de circulacao uma
   * versao com um defeito serio - nao para forcar toda a gente a saltar
   * para a ultima por rotina.
   */
  minSupported?: string;
  /** Tamanho do instalador em bytes, para o painel avisar antes de descarregar. */
  sizeBytes?: number;
};

export type PlanReleaseOverride = {
  app_version?: string | null;
  app_min_supported?: string | null;
};

const RELEASE_PATH = path.join(process.cwd(), "config", "optimizer-release.json");

export function optimizerRelease(): OptimizerRelease {
  const value: unknown = JSON.parse(fs.readFileSync(RELEASE_PATH, "utf8"));
  if (!isRelease(value)) throw new Error("Manifesto da aplicacao Orion invalido.");
  return value;
}

export function releaseForPlan(
  base: OptimizerRelease,
  plan: PlanReleaseOverride | null | undefined,
): OptimizerRelease {
  const version = plan?.app_version?.trim();
  const minSupported = plan?.app_min_supported?.trim();
  return {
    ...base,
    version: version && SEMVER.test(version) ? version : base.version,
    minSupported: minSupported && SEMVER.test(minSupported) ? minSupported : base.minSupported,
  };
}

function isRelease(value: unknown): value is OptimizerRelease {
  if (!value || typeof value !== "object") return false;
  const release = value as Record<string, unknown>;

  const obrigatorios =
    typeof release.version === "string" && SEMVER.test(release.version) &&
    typeof release.downloadPath === "string" && isSafeDownloadUrl(release.downloadPath) &&
    typeof release.sha256 === "string" && /^[a-f0-9]{64}$/.test(release.sha256);
  if (!obrigatorios) return false;

  // Os opcionais sao validados na mesma: um manifesto mal escrito a mao
  // nao pode passar despercebido ate alguem reparar que o painel mostra
  // "undefined" ou que a actualizacao obrigatoria nunca dispara.
  if (release.notes !== undefined) {
    if (!Array.isArray(release.notes)) return false;
    if (!release.notes.every((n) => typeof n === "string" && n.trim().length > 0)) return false;
  }
  if (release.releasedAt !== undefined && !Number.isFinite(release.releasedAt)) return false;
  if (release.sizeBytes !== undefined && !Number.isFinite(release.sizeBytes)) return false;
  if (release.minSupported !== undefined) {
    if (typeof release.minSupported !== "string" || !SEMVER.test(release.minSupported)) return false;
    // Exigir uma versao minima acima da que se esta a publicar deixava
    // toda a gente bloqueada, incluindo quem acabou de actualizar.
    if (compareVersions(release.minSupported, release.version as string) > 0) return false;
  }
  return true;
}

function isSafeDownloadUrl(value: string): boolean {
  if (/^\/downloads\/[a-zA-Z0-9._-]+\.exe$/.test(value)) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      /^\/JonhyC\/orion-optimizer\/releases\/download\/v\d+\.\d+\.\d+\/.+\.exe$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export type UpdateStatus = {
  release: OptimizerRelease;
  /** Versao que o cliente diz ter. Null quando ainda nao se identificou. */
  installed: string | null;
  outdated: boolean;
  /** Abaixo do minSupported: nao deve continuar a usar a versao actual. */
  mandatory: boolean;
};

/**
 * Compara o que esta instalado com o que esta publicado.
 *
 * Vive aqui e nao no componente porque a mesma decisao e precisa em tres
 * sitios - painel, dashboard e a rota de API que a aplicacao consulta - e
 * tres copias da mesma comparacao acabariam por divergir.
 */
export function updateStatus(release: OptimizerRelease, installed: string | null): UpdateStatus {
  if (!installed || !SEMVER.test(installed)) {
    // Sem versao conhecida assume-se desactualizado: e melhor propor uma
    // actualizacao desnecessaria do que deixar alguem preso numa versao
    // antiga por nao se ter identificado.
    return { release, installed: null, outdated: true, mandatory: false };
  }
  const outdated = compareVersions(installed, release.version) < 0;
  const mandatory = Boolean(
    release.minSupported && compareVersions(installed, release.minSupported) < 0,
  );
  return { release, installed, outdated, mandatory };
}
