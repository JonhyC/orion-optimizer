import { bearerToken, nowSeconds, userFromToken } from "@/lib/auth";
import { audit } from "@/lib/repo/audit";
import { allPlans, findPlanByCode } from "@/lib/repo/plans";
import { revokeAllTokens, revokeClientTokens } from "@/lib/repo/tokens";
import { findById, findProfileById, listProfiles, updateProfile } from "@/lib/repo/users";
import { queueDiscordRoleSync } from "@/lib/plan-expiry";
import { ROLES } from "@/lib/session";
import { fail, ok } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Accoes sobre contas, para o Centro da Equipa da aplicacao.
 *
 * A aplicacao tinha oito botoes - alterar plano, alterar cargo, suspender,
 * banir, revogar e renovar licenca, acesso beta, reset de acesso - que
 * eram <button> sem onClick nenhum. Nao havia nada do lado do servidor
 * que a aplicacao pudesse chamar: so existia /api/internal/overview, e e
 * de leitura.
 *
 * As REGRAS aqui sao as mesmas que o painel do site ja usa. Nao ha
 * autorizacao nova inventada para este caminho: quem pode fazer o que
 * esta num sitio so, mais abaixo, e as duas travas que o site tem
 * continuam de pe - ninguem se despromove nem se suspende a si proprio, e
 * nao se mexe em quem tem cargo igual ou superior ao nosso.
 */

const INTERNAL_ROLES = new Set(["staff", "developer", "owner"]);

/** Accao -> cargo minimo. Nivel unico de decisao sobre quem pode o que. */
const PERMISSAO: Record<string, "staff" | "developer" | "owner"> = {
  reset_hardware: "staff",
  suspender: "developer",
  reativar: "developer",
  banir: "owner",
  alterar_cargo: "owner",
  alterar_plano: "owner",
  revogar_licenca: "owner",
  renovar_licenca: "owner",
};

const nivel = (papel: string) => ROLES.indexOf(papel as (typeof ROLES)[number]);

export async function GET(req: Request) {
  const actor = await userFromToken(bearerToken(req));
  if (!actor) return fail("Sessao invalida ou expirada.", 401, "invalid_token");
  if (!INTERNAL_ROLES.has(actor.role)) {
    return fail("Sem permissao para consultar contas.", 403, "forbidden");
  }

  const [perfis, planos] = await Promise.all([listProfiles(500), allPlans()]);
  return ok({
    users: perfis.map((p) => ({
      id: p.id,
      username: p.username,
      discord_username: p.discord_username,
      role: p.role,
      tier: p.tier,
      status: p.status,
      hwid: p.hwid,
      expires_at: p.expires_at,
      client_seen_at: p.client_seen_at,
      client_version: p.client_version,
    })),
    // O que o cliente pode oferecer nos menus, para nao ter listas
    // escritas a mao que ficam desactualizadas quando se cria um plano.
    plans: planos.filter((p) => p.active === 1).map((p) => ({ code: p.code, name: p.name })),
    roles: [...ROLES],
    // Assim a aplicacao pode desactivar o que este utilizador nao pode
    // fazer, em vez de o deixar clicar e apanhar 403.
    allowed: Object.entries(PERMISSAO)
      .filter(([, minimo]) => nivel(actor.role) >= nivel(minimo))
      .map(([accao]) => accao),
  });
}

export async function POST(req: Request) {
  const actor = await userFromToken(bearerToken(req));
  if (!actor) return fail("Sessao invalida ou expirada.", 401, "invalid_token");

  const corpo = (await req.json().catch(() => null)) as
    | { action?: string; userId?: number; value?: string | number }
    | null;
  if (!corpo?.action || !Number.isFinite(corpo.userId)) {
    return fail("Pedido incompleto.", 400, "bad_request");
  }

  const accao = String(corpo.action);
  const minimo = PERMISSAO[accao];
  if (!minimo) return fail("Accao desconhecida.", 400, "unknown_action");
  if (nivel(actor.role) < nivel(minimo)) {
    return fail("Sem permissao para esta accao.", 403, "forbidden");
  }

  const alvoId = Number(corpo.userId);
  const alvo = await findProfileById(alvoId);
  if (!alvo) return fail("Conta nao encontrada.", 404, "not_found");

  // As duas travas do painel do site, palavra por palavra.
  //
  // A primeira evita o tiro no pe: sem ela, um clique distraido deixa o
  // painel sem ninguem que lhe aceda. A segunda evita escalada lateral:
  // um developer nao pode suspender um owner.
  if (alvoId === actor.id && accao !== "reset_hardware") {
    return fail("Nao podes aplicar esta accao a ti proprio.", 400, "self");
  }
  if (nivel(alvo.role) >= nivel(actor.role) && alvoId !== actor.id) {
    return fail("Nao podes mexer numa conta de cargo igual ou superior ao teu.", 403, "hierarchy");
  }

  const agora = nowSeconds();

  switch (accao) {
    case "suspender":
    case "banir": {
      const estado = accao === "banir" ? "banned" : "suspended";
      await updateProfile(alvoId, { status: estado });
      await revokeAllTokens(alvoId);
      audit(actor.id, `internal_${estado}`, `user #${alvoId}`);
      return ok({ status: estado });
    }

    case "reativar": {
      await updateProfile(alvoId, { status: "active" });
      audit(actor.id, "internal_reactivated", `user #${alvoId}`);
      return ok({ status: "active" });
    }

    case "reset_hardware": {
      await updateProfile(alvoId, { hwid: null });
      await revokeClientTokens(alvoId);
      audit(actor.id, "internal_reset_hwid", `user #${alvoId}`);
      return ok({ hwid: null });
    }

    case "alterar_cargo": {
      const papel = String(corpo.value ?? "");
      if (!ROLES.includes(papel as (typeof ROLES)[number])) {
        return fail("Cargo invalido.", 400, "bad_role");
      }
      // Nao se pode promover alguem acima de nos: sem isto, um owner
      // podia ser criado por quem nao devia poder cria-lo.
      if (nivel(papel) >= nivel(actor.role)) {
        return fail("Nao podes atribuir um cargo igual ou superior ao teu.", 403, "hierarchy");
      }
      await updateProfile(alvoId, { role: papel as (typeof ROLES)[number], role_source: "manual" });
      audit(actor.id, "internal_role_changed", `user #${alvoId} -> ${papel}`);
      return ok({ role: papel });
    }

    case "alterar_plano": {
      const codigo = String(corpo.value ?? "");
      const plano = await findPlanByCode(codigo);
      if (!plano) return fail("Plano nao encontrado.", 404, "no_plan");

      const expira = plano.days === 0 ? null : agora + plano.days * 86400;
      await updateProfile(alvoId, {
        tier: plano.code,
        tier_source: "manual",
        expires_at: expira,
        role: alvo.role === "member" ? "client" : alvo.role,
      });
      await queueDiscordRoleSync(alvoId, plano.code, "internal_plan_set");
      audit(actor.id, "internal_plan_changed", `user #${alvoId} -> ${plano.code}`);
      return ok({ tier: plano.code, expires_at: expira });
    }

    case "revogar_licenca": {
      await updateProfile(alvoId, {
        tier: null,
        tier_source: "manual",
        expires_at: null,
        support_started_at: null,
        support_expires_at: null,
        support_lifetime: 0,
        role: alvo.role === "client" ? "member" : alvo.role,
      });
      await revokeClientTokens(alvoId);
      await queueDiscordRoleSync(alvoId, null, "internal_plan_cleared");
      audit(actor.id, "internal_license_revoked", `user #${alvoId}`);
      return ok({ tier: null });
    }

    case "renovar_licenca": {
      const dias = Number(corpo.value ?? 30);
      if (!Number.isFinite(dias) || dias <= 0 || dias > 3650) {
        return fail("Numero de dias invalido.", 400, "bad_days");
      }
      // Soma ao que resta, nao ao dia de hoje: renovar uma licenca com 20
      // dias por gastar nao pode encurta-la.
      const base = alvo.expires_at && alvo.expires_at > agora ? alvo.expires_at : agora;
      const expira = base + dias * 86400;
      await updateProfile(alvoId, { expires_at: expira });
      audit(actor.id, "internal_license_renewed", `user #${alvoId} +${dias}d`);
      return ok({ expires_at: expira });
    }

    default:
      return fail("Accao desconhecida.", 400, "unknown_action");
  }
}
