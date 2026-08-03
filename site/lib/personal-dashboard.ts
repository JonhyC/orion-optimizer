import { money } from "./format.ts";

/**
 * Logica da Area Pessoal.
 *
 * Fora do componente para poder ser testada sem browser, tal como em
 * admin-dashboard.ts. E a mesma regra: nada aqui inventa estado.
 *
 * A pagina tinha um `<StatusBadge status="active" />` escrito a mao, que
 * dizia "Ativa" mesmo com a licenca expirada, e uma linha fixa a dizer
 * "Discord verificado" a dois centimetros do cartao que mostrava o valor
 * verdadeiro. A pagina contradizia-se a si propria; agora o estado e
 * derivado uma unica vez e os dois sitios leem daqui.
 */

/** A partir de quantos dias a licenca passa a merecer destaque. */
export const DIAS_PARA_AVISO = 7;

export type EstadoLicenca = {
  /** Chave do StatusBadge. So chaves que ja existem no mapa STATUS. */
  badge: "active" | "pending" | "failed";
  /** Texto curto para o mosaico. */
  texto: string;
  /** Null quando e vitalicia ou acesso interno - nao ha contagem. */
  diasRestantes: number | null;
  /** Verdadeiro quando esta perto do fim ou ja passou. */
  urgente: boolean;
  /** Nota de rodape do mosaico. */
  nota: string;
};

export function estadoDaLicenca(dados: {
  tier: string | null;
  expiresAt: number | null;
  agora: number;
  acessoInterno: boolean;
  contaSuspensa: boolean;
}): EstadoLicenca {
  // Uma conta suspensa nao tem acesso, por muito que a data ainda nao
  // tenha passado. Vinha antes de tudo o resto.
  if (dados.contaSuspensa) {
    return {
      badge: "failed",
      texto: "Suspensa",
      diasRestantes: null,
      urgente: true,
      nota: "contacta o suporte",
    };
  }

  if (dados.acessoInterno && !dados.tier) {
    return {
      badge: "active",
      texto: "Acesso interno",
      diasRestantes: null,
      urgente: false,
      nota: "acesso por cargo",
    };
  }

  if (dados.expiresAt === null) {
    return {
      badge: "active",
      texto: "Life-time",
      diasRestantes: null,
      urgente: false,
      nota: "sem data de fim",
    };
  }

  const dias = Math.ceil((dados.expiresAt - dados.agora) / 86400);

  if (dias <= 0) {
    return {
      badge: "failed",
      texto: "Expirada",
      diasRestantes: 0,
      urgente: true,
      nota: "renova para voltar a usar",
    };
  }

  if (dias <= DIAS_PARA_AVISO) {
    return {
      badge: "pending",
      texto: dias === 1 ? "1 dia" : `${dias} dias`,
      diasRestantes: dias,
      urgente: true,
      nota: dias === 1 ? "termina amanhã" : "a terminar em breve",
    };
  }

  return {
    badge: "active",
    texto: `${dias} dias`,
    diasRestantes: dias,
    urgente: false,
    nota: "acesso ativo",
  };
}

export type EstadoSuporte = {
  texto: string;
  ativo: boolean;
  nota: string;
};

/**
 * Estado do Support Plan.
 *
 * Distingue "nunca teve" de "teve e acabou": a versao anterior mostrava
 * "Nao incluido" nos dois casos, o que faz um cliente que pagou suporte
 * pensar que nunca o teve.
 */
export function estadoDoSuporte(dados: {
  supportLifetime: number;
  supportExpiresAt: number | null;
  agora: number;
}): EstadoSuporte {
  if (dados.supportLifetime === 1) {
    return { texto: "Life-time", ativo: true, nota: "cobertura permanente" };
  }

  if (dados.supportExpiresAt === null) {
    return { texto: "Não incluído", ativo: false, nota: "sem cobertura" };
  }

  if (dados.supportExpiresAt <= dados.agora) {
    return { texto: "Terminado", ativo: false, nota: "cobertura expirada" };
  }

  const dias = Math.ceil((dados.supportExpiresAt - dados.agora) / 86400);
  return {
    texto: dias === 1 ? "1 dia" : `${dias} dias`,
    ativo: true,
    nota: "cobertura ativa",
  };
}

/**
 * Total gasto, por moeda.
 *
 * A versao anterior somava `amount_cents` de todas as compras e formatava
 * o resultado como euros. Com uma unica compra noutra moeda o total
 * passava a ser um numero que nao existe. Aqui cada moeda e somada e
 * formatada em separado.
 */
/** So os campos usados: serve tanto `Order` como o `OrderRow` das listagens. */
export type CompraSomavel = {
  amount_cents: number;
  currency: string;
  status: string;
};

export function totalGasto(orders: CompraSomavel[]): string {
  const pagas = orders.filter((o) => o.status === "paid");
  if (pagas.length === 0) return money(0);

  const porMoeda = new Map<string, number>();
  for (const o of pagas) {
    const moeda = o.currency || "EUR";
    porMoeda.set(moeda, (porMoeda.get(moeda) ?? 0) + o.amount_cents);
  }

  return [...porMoeda.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([moeda, total]) => money(total, moeda))
    .join(" + ");
}

/**
 * Rotulos da atividade.
 *
 * O "2.0" faz parte do NOME do produto - o site inteiro o usa assim, do
 * rodape ao checkout - e nao do numero da versao, que vai em 2.1.1. Fica
 * como esta: mudar so aqui deixava esta pagina a destoar de todas as
 * outras.
 */
const ROTULOS: Record<string, string> = {
  login_ok: "Sessão iniciada no Orion Optimizer 2.0",
  login_discord_verified: "Cargos Discord verificados",
  catalog_served: "Catálogo de otimizações carregado",
  hwid_bound: "Computador associado à licença",
  self_hwid_reset: "Computador removido da licença",
  client_password_generated: "Credenciais Windows atualizadas",
  panel_login_ok: "Sessão iniciada no painel",
  logout: "Sessão do Optimizer terminada",
  discord_plan_roles_synced: "Cargo do plano sincronizado no Discord",
};

/** Accoes que valem a pena mostrar ao cliente. O resto e ruido interno. */
export const ACCOES_VISIVEIS = new Set(Object.keys(ROTULOS));

export function rotuloDeAtividade(accao: string): string {
  return ROTULOS[accao] ?? "Atividade da conta";
}

export type Requisito = {
  id: string;
  label: string;
  pronto: boolean;
  /** Texto mostrado quando ainda nao esta pronto. */
  pendente: string;
};

/**
 * Requisitos para usar o cliente Windows.
 *
 * Fonte unica: o cartao "Estado da conta" e a lista resumida do cartao
 * "O teu acesso" liam dados diferentes e chegavam a dizer o contrario um
 * do outro - "Discord verificado" estava escrito a mao e aparecia mesmo
 * em contas sem Discord ligado.
 */
export function requisitosDeAcesso(dados: {
  contaAtiva: boolean;
  discordLigado: boolean;
  computadorAssociado: boolean;
  credenciaisGeradas: boolean;
}): Requisito[] {
  return [
    {
      id: "conta",
      label: "Conta Orion ativa",
      pronto: dados.contaAtiva,
      pendente: "Pendente",
    },
    {
      id: "discord",
      label: "Discord ligado",
      pronto: dados.discordLigado,
      pendente: "Por ligar",
    },
    {
      id: "computador",
      label: "Computador associado",
      pronto: dados.computadorAssociado,
      pendente: "feito no primeiro login",
    },
    {
      id: "credenciais",
      label: "Credenciais Windows",
      pronto: dados.credenciaisGeradas,
      pendente: "gerir na conta",
    },
  ];
}

/** Quantos requisitos faltam. Zero significa pronto a usar. */
export function requisitosEmFalta(requisitos: Requisito[]): number {
  return requisitos.filter((r) => !r.pronto).length;
}
