import path from "node:path";
import fs from "node:fs";
import { bearerToken, clientIp, userFromToken } from "@/lib/auth";
import { audit } from "@/lib/db";
import { fail, ok } from "../_lib/respond";
import { processExpiredPlans } from "@/lib/plan-expiry";
import { filterTweaksForUser, isTweakEnabled } from "@/lib/optimizer-access";
import type { Tweak } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrega do catalogo de tweaks, so com token valido.
 *
 * E este ponto que faz o login valer alguma coisa: sem sessao o cliente nao
 * recebe catalogo, logo nao tem nada para aplicar. Uma verificacao feita do
 * lado do cliente seria contornavel editando uma linha do .ps1.
 *
 * O ficheiro vive fora de site/ e nunca e servido como estatico.
 */
const CATALOG_PATH =
  process.env.ORION_CATALOG_PATH ??
  path.join(process.cwd(), "..", "catalog", "tweaks.json");

export async function GET(req: Request) {
  await processExpiredPlans();
  const user = await userFromToken(bearerToken(req));

  if (!user) {
    return fail("Sessao invalida ou expirada. Faz login outra vez.", 401, "invalid_token");
  }

  if (!fs.existsSync(CATALOG_PATH)) {
    console.error("[orion] catalogo em falta:", CATALOG_PATH);
    return fail("Catalogo indisponivel.", 503, "catalog_unavailable");
  }

  let catalog: { schemaVersion?: number; tweaks?: Tweak[] };
  try {
    catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  } catch (e) {
    console.error("[orion] catalogo malformado:", e);
    return fail("Catalogo malformado.", 500, "catalog_invalid");
  }

  if (!Array.isArray(catalog.tweaks)) {
    return fail("Catalogo malformado.", 500, "catalog_invalid");
  }

  // Suspensos saem antes do filtro de plano: um tweak retirado de circulacao
  // nao e servido a ninguem, nem sequer aos cargos internos.
  const liveTweaks = catalog.tweaks.filter(isTweakEnabled);
  const allowedTweaks = filterTweaksForUser(user, liveTweaks);
  audit(user.id, "catalog_served", `${allowedTweaks.length} tweaks`, clientIp(req));

  return ok({
    catalog: {
      schemaVersion: catalog.schemaVersion ?? 2,
      tweaks: allowedTweaks,
    },
  });
}
