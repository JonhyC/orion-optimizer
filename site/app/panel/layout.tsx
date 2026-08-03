import { currentUser, roleAtLeast } from "@/lib/session";
import { avatarUrl } from "@/lib/discord";
import { countUnreadSupport } from "@/lib/repo/support";
import { motivoDeIndisponibilidade, textoIndisponivel } from "@/lib/indisponivel";
import PanelHeader, { type AdminLink } from "./PanelHeader";
import PainelIndisponivel from "./PainelIndisponivel";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  /**
   * A leitura da sessao pode falhar por causas que nada tem a ver com
   * quem esta a navegar - quota esgotada, ligacao em baixo. Sem este
   * try/catch o erro subia ate ao topo e o painel inteiro respondia com
   * um ecra branco a dizer "Application error", sem sequer mostrar o
   * login.
   *
   * NAO se trata a falha como "sessao invalida": deitar alguem fora por
   * causa de um problema de infraestrutura fa-lo-ia perder o que estava a
   * fazer e mandava-o para um login que tambem nao ia funcionar.
   */
  let user: Awaited<ReturnType<typeof currentUser>> = null;
  try {
    user = await currentUser();
  } catch (erro) {
    const motivo = motivoDeIndisponibilidade(erro);
    if (!motivo) throw erro;
    console.error("[orion] painel indisponivel:", (erro as Error)?.message ?? erro);
    return <PainelIndisponivel {...textoIndisponivel(motivo)} />;
  }

  const hasDashboard = Boolean(user?.tier) || roleAtLeast(user, "staff");
  const adminLinks = user ? adminLinksFor(user) : [];
  // O contador do suporte e um enfeite: se falhar, o painel abre a zero
  // em vez de nao abrir de todo.
  let supportUnread = { mine: 0, staff: 0 };
  if (user) {
    try {
      supportUnread = await countUnreadSupport(user);
    } catch (erro) {
      console.error("[orion] contador de suporte indisponivel:", (erro as Error)?.message ?? erro);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--panel-bg)]">
      {user && (
        <PanelHeader
          user={{
            username: user.username,
            displayName: user.discord_username ?? user.username,
            role: user.role,
            avatarUrl: user.discord_id ? avatarUrl(user.discord_id, user.discord_avatar) : null,
          }}
          hasDashboard={hasDashboard}
          adminLinks={adminLinks}
          supportUnread={supportUnread.mine}
          staffSupportUnread={supportUnread.staff}
        />
      )}

      <main className="orion-container py-8 lg:py-10">{children}</main>
    </div>
  );
}

function adminLinksFor(user: NonNullable<Awaited<ReturnType<typeof currentUser>>>): AdminLink[] {
  const links: AdminLink[] = [];

  if (roleAtLeast(user, "staff")) {
    links.push(
      { href: "/panel/admin", label: "Painel", detail: "Resumo interno e estado do sistema" },
      { href: "/panel/admin/support", label: "Suporte", detail: "Tickets, respostas e avaliacoes" },
      { href: "/panel/admin/users", label: "Contas", detail: "Clientes, staff, licencas e acessos" },
      { href: "/panel/admin/reviews", label: "Avaliacoes", detail: "Moderacao de reviews publicas" },
    );
  }

  if (roleAtLeast(user, "developer")) {
    links.push({
      href: "/panel/admin/catalog",
      label: "Catalogo",
      detail: "Otimizacoes e compatibilidade tecnica",
    });
  }

  if (roleAtLeast(user, "owner")) {
    links.push(
      { href: "/panel/admin/plans", label: "Planos", detail: "Precos, duracoes, imagens e cargos Discord" },
      { href: "/panel/admin/versions", label: "Versoes", detail: "Versao da aplicacao liberada por plano" },
      { href: "/panel/admin/orders", label: "Vendas", detail: "Encomendas, pagamentos e estado comercial" },
      { href: "/panel/admin/coupons", label: "Cupoes", detail: "Codigos de desconto e validade" },
    );
  }

  return links;
}
