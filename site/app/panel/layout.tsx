import Link from "next/link";
import { LogOut } from "lucide-react";
import { currentUser, roleAtLeast } from "@/lib/session";
import { logoutAction } from "./actions";
import { OrionGlyph } from "@/components/ui/PageLoader";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const hasDashboard = Boolean(user?.tier) || roleAtLeast(user, "staff");

  return (
    <div className="min-h-screen bg-[var(--panel-bg)]">
      {user && (
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[var(--panel-surface)]/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1180px] min-w-0 flex-wrap items-center gap-x-7 gap-y-3 px-6 py-3.5">
            <Link href="/panel" className="flex items-center gap-2.5">
              <OrionGlyph className="h-7 w-7" />
              <span className="text-[13px] font-bold tracking-[0.2em] text-white">ORION</span>
            </Link>

            <nav className="order-3 flex w-full min-w-0 items-center gap-5 overflow-x-auto whitespace-nowrap pb-1 text-[13.5px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:order-none lg:w-auto lg:gap-6 lg:overflow-visible lg:pb-0">
              {hasDashboard && (
                <Link href="/panel/dashboard" className="text-white/55 transition-colors hover:text-white">
                  Área Pessoal
                </Link>
              )}
              <Link href="/panel" className="text-white/55 transition-colors hover:text-white">
                A minha conta
              </Link>

              {/* staff: suporte - contas, avaliacoes, metricas sem financeiro */}
              {roleAtLeast(user, "staff") && (
                <>
                  <Link href="/panel/admin" className="text-white/55 transition-colors hover:text-white">
                    Painel
                  </Link>
                  <Link href="/panel/admin/users" className="text-white/55 transition-colors hover:text-white">
                    Contas
                  </Link>
                  <Link href="/panel/admin/reviews" className="text-white/55 transition-colors hover:text-white">
                    Avaliacoes
                  </Link>
                </>
              )}

              {/* developer: catalogo de optimizacoes */}
              {roleAtLeast(user, "developer") && (
                <>
                  <Link href="/panel/admin/catalog" className="text-white/55 transition-colors hover:text-white">
                    Catalogo
                  </Link>
                </>
              )}

              {/* owner: vendas e planos comerciais */}
              {roleAtLeast(user, "owner") && (
                <>
                  <Link href="/panel/admin/plans" className="text-white/55 transition-colors hover:text-white">
                    Planos
                  </Link>
                  <Link href="/panel/admin/orders" className="text-white/55 transition-colors hover:text-white">
                    Vendas
                  </Link>
                </>
              )}

              <Link href="/" className="text-white/30 transition-colors hover:text-white/70">
                Ver site
              </Link>
            </nav>

            <div className="ml-auto flex items-center gap-3">
              <span className="text-[12.5px] text-white/35">{user.username}</span>
              <RoleChip role={user.role} />
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
      )}

      <main className="mx-auto max-w-[1180px] px-6 py-10">{children}</main>
    </div>
  );
}

function RoleChip({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: "bg-[var(--chart-1)]/15 text-[var(--chart-1)]",
    developer: "bg-[var(--warning)]/15 text-[var(--warning)]",
    staff: "bg-[var(--serious)]/15 text-[var(--serious)]",
    client: "bg-[var(--good)]/15 text-[var(--good)]",
    member: "bg-white/[0.07] text-white/45",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
        styles[role] ?? styles.client
      }`}
    >
      {role}
    </span>
  );
}
