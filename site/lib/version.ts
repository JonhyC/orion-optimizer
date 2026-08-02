/**
 * Comparacao de versoes e estado de actualizacao.
 *
 * Vive num modulo proprio, sem imports de Node, porque isto e preciso dos
 * DOIS lados: o servidor decide o que mostrar, o componente do painel
 * decide o que fazer quando a versao muda debaixo dele. Antes havia uma
 * copia do compareVersions dentro do componente - duas implementacoes da
 * mesma regra acabam sempre por divergir, e a que decide se alguem esta
 * desactualizado nao e sitio para isso acontecer.
 */

export const SEMVER = /^\d+\.\d+\.\d+$/;

/** Negativo se `left` for anterior, zero se igual, positivo se posterior. */
export function compareVersions(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

export type ReleaseInfo = {
  version: string;
  minSupported?: string;
};

export type UpdateState =
  /** Versao instalada desconhecida: ainda nao abriu a aplicacao. */
  | "desconhecida"
  | "actualizada"
  | "disponivel"
  /** Abaixo do minSupported: a versao actual nao deve continuar em uso. */
  | "obrigatoria";

export function updateState(release: ReleaseInfo, installed: string | null): UpdateState {
  if (!installed || !SEMVER.test(installed)) return "desconhecida";
  if (release.minSupported && compareVersions(installed, release.minSupported) < 0) {
    return "obrigatoria";
  }
  return compareVersions(installed, release.version) < 0 ? "disponivel" : "actualizada";
}

/** "103,6 MB". Devolve null quando o tamanho nao veio no manifesto. */
export function formatBytes(bytes: number | null | undefined): string | null {
  if (!Number.isFinite(bytes) || !bytes) return null;
  const mb = (bytes as number) / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1).replace(".", ",")} MB`;
  return `${(mb / 1024).toFixed(2).replace(".", ",")} GB`;
}

/** "há 2 minutos", "há 3 dias". Null quando nao ha data. */
export function timeAgo(unixSeconds: number | null | undefined, now = Date.now()): string | null {
  if (!Number.isFinite(unixSeconds) || !unixSeconds) return null;
  const s = Math.max(0, Math.floor(now / 1000) - (unixSeconds as number));
  if (s < 60) return "agora mesmo";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} minuto${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} hora${h === 1 ? "" : "s"}`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} dia${d === 1 ? "" : "s"}`;
  const meses = Math.floor(d / 30);
  return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
}
