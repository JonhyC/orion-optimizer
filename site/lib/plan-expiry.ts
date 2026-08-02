import { audit } from "./repo/audit.ts";
import { discordConfig, syncDiscordPlanRoles } from "./discord.ts";
import { expiredPlanUsers, findProfileById, updateProfile } from "./repo/users.ts";
import { revokeClientTokens } from "./repo/tokens.ts";
import {
  clearRoleSync,
  countPendingRoleSyncs,
  pendingRoleSyncs,
  queueRoleSync,
  recordRoleSyncFailure,
} from "./repo/role-sync.ts";

export type ExpiryResult = {
  expired: number;
  discordSynced: number;
  discordPending: number;
};

const agora = () => Math.floor(Date.now() / 1000);

/** Regista o estado desejado; uma nova alteracao substitui uma tentativa antiga. */
export async function queueDiscordRoleSync(
  userId: number,
  tier: string | null,
  reason: string,
  removeRoleId: string | null = null,
): Promise<void> {
  // Sem conta Discord ligada nao ha cargo nenhum para sincronizar.
  const perfil = await findProfileById(userId);
  if (!perfil?.discord_id) return;

  await queueRoleSync({ userId, tier, reason, removeRoleId });
}

export async function flushDiscordRoleSync(limit = 25): Promise<{
  synced: number;
  pending: number;
}> {
  if (!discordConfig()?.botToken) {
    return { synced: 0, pending: await countPendingRoleSyncs() };
  }

  const now = agora();
  const fila = await pendingRoleSyncs(limit);

  let synced = 0;
  for (const entrada of fila) {
    // Espera exponencial entre tentativas, ate uma hora. Sem isto, uma
    // conta que falha sempre seria repetida a cada pedido ao site.
    const atraso = Math.min(3600, 60 * 2 ** Math.min(entrada.attempts, 6));
    if (entrada.attempts > 0 && entrada.updated_at + atraso > now) continue;

    // O discord_id vive no perfil, nao na fila: o SQLite fazia JOIN, aqui
    // e uma leitura por entrada. A fila e curta (25 no maximo).
    const perfil = await findProfileById(entrada.user_id);
    if (!perfil?.discord_id) {
      // A conta perdeu a ligacao ao Discord: nao ha nada a sincronizar e
      // deixar a entrada na fila fazia-a ser tentada para sempre.
      await clearRoleSync(entrada.user_id);
      continue;
    }

    try {
      await syncDiscordPlanRoles(
        perfil.discord_id,
        entrada.tier,
        entrada.remove_role_id ? [entrada.remove_role_id] : [],
      );
      await clearRoleSync(entrada.user_id);
      audit(entrada.user_id, "discord_plan_roles_synced", entrada.tier ?? "member");
      synced++;
    } catch (error) {
      await recordRoleSyncFailure(entrada.user_id, (error as Error).message);
    }
  }

  return { synced, pending: await countPendingRoleSyncs() };
}

/**
 * Expira primeiro na base de dados e so depois contacta o Discord. Assim uma
 * falha externa nunca prolonga o acesso ao optimizer.
 */
export async function processExpiredPlans(): Promise<ExpiryResult> {
  const now = agora();
  const expirados = await expiredPlanUsers(now);

  for (const user of expirados) {
    // Cada conta e tratada por si. O SQLite envolvia tudo numa transaccao,
    // mas aqui sao documentos independentes: falhar numa nao pode impedir
    // que as outras percam o plano, que e o que protege o acesso.
    try {
      await updateProfile(user.id, {
        tier: null,
        tier_source: "manual",
        // Quem era cliente por ter plano volta a ser membro. Cargos
        // internos (staff, developer, owner) nao sao tocados.
        role: user.role === "client" ? "member" : user.role,
      });

      // Corta o cliente Windows de imediato; a sessao do site sobrevive,
      // para a pessoa poder entrar e renovar.
      await revokeClientTokens(user.id);

      if (user.discord_id) {
        await queueRoleSync({
          userId: user.id,
          tier: null,
          reason: "plan_expired",
          removeRoleId: null,
        });
      }
      audit(user.id, "plan_expired", `${user.tier} / ${user.username}`);
    } catch (error) {
      console.error(
        `[orion] falha a expirar o plano do utilizador ${user.id}:`,
        (error as Error).message,
      );
    }
  }

  const discord = await flushDiscordRoleSync();
  return {
    expired: expirados.length,
    discordSynced: discord.synced,
    discordPending: discord.pending,
  };
}
