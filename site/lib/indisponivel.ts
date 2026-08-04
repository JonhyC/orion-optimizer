/**
 * Reconhece falhas da base de dados que nao sao culpa de quem esta a
 * navegar.
 *
 * Existe porque o site inteiro passou a responder "Application error: a
 * server-side exception has occurred" - um ecra branco - quando a quota
 * diaria do Firestore se esgotou. O erro subia da leitura da sessao ate
 * ao layout e nao havia nada a apanha-lo, portanto nem a pagina de login
 * aparecia.
 *
 * Codigos gRPC do Firestore:
 *   8  RESOURCE_EXHAUSTED - quota diaria esgotada
 *  14  UNAVAILABLE        - sem ligacao ou canal em mau estado
 *   4  DEADLINE_EXCEEDED  - demorou de mais
 */
const CODIGOS = new Set([8, 14, 4]);

export type MotivoIndisponivel = "quota" | "ligacao" | null;

export function motivoDeIndisponibilidade(erro: unknown): MotivoIndisponivel {
  const codigo = (erro as { code?: unknown })?.code;
  if (typeof codigo === "number" && CODIGOS.has(codigo)) {
    return codigo === 8 ? "quota" : "ligacao";
  }

  // Em producao a mensagem chega por vezes sem o campo `code`.
  const texto = String((erro as Error)?.message ?? erro ?? "");
  if (/RESOURCE_EXHAUSTED|Quota exceeded/i.test(texto)) return "quota";
  if (/UNAVAILABLE|DEADLINE_EXCEEDED|ECONNREFUSED/i.test(texto)) return "ligacao";
  return null;
}

/** Texto para o utilizador. Sem jargao e sem culpar quem esta a ler. */
export function textoIndisponivel(motivo: Exclude<MotivoIndisponivel, null>): {
  titulo: string;
  detalhe: string;
} {
  if (motivo === "quota") {
    return {
      titulo: "O Orion está temporariamente indisponível",
      detalhe:
        "A base de dados atingiu o limite diário de leituras. O serviço volta ao normal quando o limite reiniciar, à meia-noite (hora do Pacífico).",
    };
  }
  return {
    titulo: "Não foi possível contactar a base de dados",
    detalhe:
      "O serviço não respondeu. Tenta novamente daqui a instantes — se continuar, pode ser o limite diário de leituras, que reinicia à meia-noite (hora do Pacífico).",
  };
}
