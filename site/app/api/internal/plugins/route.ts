import { bearerToken, userFromToken } from "@/lib/auth";
import { audit } from "@/lib/repo/audit";
import {
  allPlugins,
  deletePlugin,
  pluginsForRole,
  savePlugin,
  type BlocoPlugin,
  type Plugin,
} from "@/lib/repo/plugins";
import { ROLES } from "@/lib/session";
import { fail, ok } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Plugins.
 *
 * GET  - o que este utilizador pode ver. Quem e da equipa recebe tambem a
 *        lista completa, para poder editar.
 * POST - criar ou alterar. So owner.
 * DELETE - apagar. So owner.
 *
 * A validacao do manifesto acontece AQUI e nao na aplicacao: a aplicacao
 * desenha o que lhe chega, portanto e deste lado que se garante que nao
 * chega lixo. Um bloco de tipo desconhecido e recusado em vez de ser
 * guardado e depois ignorado em silencio - assim quem escreve o manifesto
 * sabe logo que se enganou.
 */

const TIPOS = new Set(["texto", "ligacao", "jogos-instalados", "loja"]);
const INTERNAL_ROLES = new Set(["staff", "developer", "owner"]);

/** Devolve a razao pela qual o manifesto nao serve, ou null. */
function validar(dados: Partial<Plugin>): string | null {
  if (!dados.name || String(dados.name).trim().length < 2) {
    return "O plugin precisa de um nome com pelo menos 2 caracteres.";
  }
  if (dados.roles && !Array.isArray(dados.roles)) return "Os cargos tem de ser uma lista.";
  if (dados.roles?.some((r) => !ROLES.includes(r as (typeof ROLES)[number]))) {
    return "A lista de cargos tem um valor que nao existe.";
  }
  if (!Array.isArray(dados.blocks) || dados.blocks.length === 0) {
    return "O plugin precisa de pelo menos um bloco.";
  }

  for (const [i, bloco] of (dados.blocks as BlocoPlugin[]).entries()) {
    const posicao = `Bloco ${i + 1}`;
    if (!bloco || !TIPOS.has(bloco.kind)) {
      return `${posicao}: tipo desconhecido. Aceita texto, ligacao, jogos-instalados ou loja.`;
    }
    if (bloco.kind === "texto" && !bloco.body) return `${posicao}: falta o texto.`;
    if (bloco.kind === "ligacao") {
      if (!bloco.label || !bloco.url) return `${posicao}: a ligacao precisa de label e url.`;
      // So http(s). Sem isto, um manifesto podia por file:// ou
      // javascript: num link que a aplicacao abre.
      if (!/^https?:\/\//i.test(bloco.url)) return `${posicao}: o url tem de comecar por http:// ou https://`;
    }
    if (bloco.kind === "loja") {
      if (!Array.isArray(bloco.items) || bloco.items.length === 0) {
        return `${posicao}: a loja precisa de pelo menos um item.`;
      }
      for (const [j, item] of bloco.items.entries()) {
        if (!item.name || !item.price || !item.url) {
          return `${posicao}, item ${j + 1}: precisa de name, price e url.`;
        }
        if (!/^https?:\/\//i.test(item.url)) {
          return `${posicao}, item ${j + 1}: o url tem de comecar por http:// ou https://`;
        }
      }
    }
  }
  return null;
}

export async function GET(req: Request) {
  const actor = await userFromToken(bearerToken(req));
  if (!actor) return fail("Sessao invalida ou expirada.", 401, "invalid_token");

  const visiveis = await pluginsForRole(actor.role);
  const equipa = INTERNAL_ROLES.has(actor.role);
  return ok({
    plugins: visiveis,
    // Editaveis so para quem os pode editar. O cliente comum nem recebe a
    // lista completa.
    all: actor.role === "owner" ? await allPlugins() : [],
    canEdit: actor.role === "owner",
    roles: equipa ? [...ROLES] : [],
  });
}

export async function POST(req: Request) {
  const actor = await userFromToken(bearerToken(req));
  if (!actor) return fail("Sessao invalida ou expirada.", 401, "invalid_token");
  if (actor.role !== "owner") return fail("So o owner pode criar plugins.", 403, "forbidden");

  const corpo = (await req.json().catch(() => null)) as (Partial<Plugin> & { id?: string }) | null;
  if (!corpo) return fail("Pedido invalido.", 400, "bad_request");

  const id = String(corpo.id ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,40}$/.test(id)) {
    return fail("O id so aceita minusculas, numeros, ponto, hifen e underscore (2 a 40).", 400, "bad_id");
  }

  const erro = validar(corpo);
  if (erro) return fail(erro, 400, "invalid_manifest");

  await savePlugin(id, {
    name: String(corpo.name).trim(),
    description: corpo.description ? String(corpo.description).trim() : null,
    icon: String(corpo.icon ?? "puzzle"),
    roles: corpo.roles ?? [],
    active: corpo.active === 1 ? 1 : 0,
    sort_order: Number(corpo.sort_order ?? 0),
    blocks: corpo.blocks as BlocoPlugin[],
  });

  audit(actor.id, "plugin_saved", id);
  return ok({ id });
}

export async function DELETE(req: Request) {
  const actor = await userFromToken(bearerToken(req));
  if (!actor) return fail("Sessao invalida ou expirada.", 401, "invalid_token");
  if (actor.role !== "owner") return fail("So o owner pode apagar plugins.", 403, "forbidden");

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[a-z0-9._-]{2,40}$/.test(id)) return fail("Id invalido.", 400, "bad_id");

  await deletePlugin(id);
  audit(actor.id, "plugin_deleted", id);
  return ok({ id });
}
