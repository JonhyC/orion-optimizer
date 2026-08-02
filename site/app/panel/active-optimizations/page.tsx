import { requireUser } from "@/lib/session";
import { listActiveOptimizations } from "@/lib/repo/active-optimizations";
import OptimizationsView from "./OptimizationsView";

export const dynamic = "force-dynamic";

/**
 * Otimizacoes Ativas.
 *
 * O servidor so busca os dados; a pesquisa, os filtros e a ordenacao
 * acontecem no cliente sobre a lista ja carregada. Sao dezenas de
 * registos no maximo - ir ao servidor a cada tecla custaria uma ida ao
 * Firestore por letra escrita.
 */
export default async function ActiveOptimizationsPage() {
  const user = await requireUser();

  // Uma falha a ler as otimizacoes nao pode deixar a pagina em branco: o
  // resto (conta, computador, versao) continua a ser util e a lista vazia
  // ja tem um estado proprio para mostrar.
  let itens: Awaited<ReturnType<typeof listActiveOptimizations>> = [];
  try {
    itens = await listActiveOptimizations(user.id);
  } catch (erro) {
    console.error("[orion] otimizacoes activas indisponiveis:", (erro as Error)?.message ?? erro);
  }

  return (
    <OptimizationsView
      itens={itens}
      versaoApp={user.client_version}
      ultimaSessao={user.client_seen_at}
      hwidConta={user.hwid}
    />
  );
}
