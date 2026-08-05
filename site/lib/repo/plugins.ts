import { firestore } from "../firebase-admin.ts";
import { cached, invalidateCache } from "../cache.ts";

/**
 * Plugins do Orion.
 *
 * Um plugin e um MANIFESTO, nao codigo. Descreve blocos que a aplicacao
 * sabe desenhar; a aplicacao nunca executa nada que venha daqui.
 *
 * A alternativa - carregar JavaScript do servidor - daria plugins capazes
 * de tudo, mas transformava qualquer acesso indevido a esta coleccao em
 * execucao de codigo no PC de todos os clientes, com o registo e o disco
 * ao alcance, porque e isso que o Orion ja faz. Enquanto os blocos
 * bastarem, ficam blocos.
 *
 * Acrescentar um tipo de bloco novo e trabalho de codigo dos dois lados,
 * de proposito: e a fronteira que mantem isto seguro.
 */

const COLECCAO = "plugins";

export type BlocoPlugin =
  | { kind: "texto"; title?: string; body: string }
  | { kind: "ligacao"; label: string; url: string; note?: string }
  | { kind: "jogos-instalados"; title?: string; note?: string }
  | {
      kind: "loja";
      title?: string;
      note?: string;
      items: Array<{
        name: string;
        price: string;
        url: string;
        store?: string;
        /** Texto a procurar no nome dos jogos instalados, para marcar "tens". */
        match?: string;
      }>;
    };

export type Plugin = {
  id: string;
  name: string;
  description: string | null;
  /** Nome do icone Lucide. A aplicacao mapeia; desconhecido cai no default. */
  icon: string;
  /** Cargos que veem este plugin. Vazio = todos os que entram na app. */
  roles: string[];
  active: number;
  sort_order: number;
  blocks: BlocoPlugin[];
  updated_at: number;
};

const col = () => firestore().collection(COLECCAO);
const agora = () => Math.floor(Date.now() / 1000);

function normalizar(dados: Partial<Plugin>, id: string): Plugin {
  return {
    id,
    name: dados.name ?? id,
    description: dados.description ?? null,
    icon: dados.icon ?? "puzzle",
    roles: Array.isArray(dados.roles) ? dados.roles : [],
    active: dados.active ?? 0,
    sort_order: dados.sort_order ?? 0,
    blocks: Array.isArray(dados.blocks) ? dados.blocks : [],
    updated_at: dados.updated_at ?? 0,
  };
}

/**
 * Todos os plugins, com cache.
 *
 * 5 minutos: sao lidos a cada abertura da aba na aplicacao e mudam
 * raramente. Guardar/apagar limpa a cache, portanto o autor ve a
 * alteracao de imediato.
 */
export async function allPlugins(): Promise<Plugin[]> {
  return cached("plugins:all", 300_000, async () => {
    const snap = await col().get();
    return snap.docs
      .map((d) => normalizar(d.data() as Partial<Plugin>, d.id))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pt"));
  });
}

/** Os que este cargo pode ver. Filtra em memoria: sao poucos documentos. */
export async function pluginsForRole(role: string): Promise<Plugin[]> {
  const todos = await allPlugins();
  return todos.filter((p) => p.active === 1 && (p.roles.length === 0 || p.roles.includes(role)));
}

export async function savePlugin(id: string, dados: Partial<Plugin>): Promise<void> {
  await col().doc(id).set({ ...dados, updated_at: agora() }, { merge: true });
  invalidateCache("plugins:");
}

export async function deletePlugin(id: string): Promise<void> {
  await col().doc(id).delete();
  invalidateCache("plugins:");
}
