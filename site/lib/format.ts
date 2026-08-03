/**
 * Formatadores partilhados entre servidor e cliente.
 *
 * Sem imports nenhuns, de proposito. Viviam em lib/stats.ts, que importa
 * os repositorios e por consequencia o firebase-admin: qualquer componente
 * de cliente que so quisesse formatar um valor arrastava o SDK inteiro
 * para o bundle do browser, e o build rebentava com "Can't resolve 'net'".
 *
 * O comportamento e IGUAL ao que estava em stats.ts - copiado tal e qual,
 * para nao mudar um unico valor no ecra.
 */

export function money(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString("pt-PT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
