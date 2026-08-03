import type { Point, Summary } from "./stats.ts";

/**
 * Logica do Painel Administrativo.
 *
 * Fora dos componentes para poder ser testada sem browser. E aqui que
 * moram as decisoes que, se estiverem erradas, nao rebentam nada - so
 * mostram ao dono um numero que nao corresponde ao negocio.
 *
 * REGRA DESTA PAGINA: nada aqui inventa valores. Se uma metrica nao for
 * medida, nao aparece. Um painel que mostra "58 ms" sem ninguem ter
 * cronometrado nada e pior do que um painel sem essa linha.
 */

export type Severidade = "critico" | "aviso" | "info";

export type Alerta = {
  id: string;
  severidade: Severidade;
  texto: string;
  /** Para onde ir resolver. Null quando nao ha accao directa. */
  href: string | null;
};

/**
 * Alertas ordenados por gravidade.
 *
 * Cada um so aparece se for verdade. A versao anterior incluia sempre
 * "Versao publicada X" na mesma lista dos problemas - informacao util,
 * mas nao um alerta, e a misturar as duas coisas nenhuma se destaca.
 */
export function derivarAlertas(dados: {
  ticketsPorLer: number;
  comprasPendentes: number;
  discordBotPronto: boolean;
  conflitosCatalogo: number;
  tweaksSuspensos: number;
  contasSuspensas: number;
}): Alerta[] {
  const alertas: Alerta[] = [];

  if (dados.ticketsPorLer > 0) {
    alertas.push({
      id: "tickets",
      severidade: "critico",
      texto: `${dados.ticketsPorLer} ${dados.ticketsPorLer === 1 ? "ticket por responder" : "tickets por responder"}`,
      href: "/panel/admin/support",
    });
  }
  if (dados.comprasPendentes > 0) {
    alertas.push({
      id: "compras",
      severidade: "aviso",
      texto: `${dados.comprasPendentes} ${dados.comprasPendentes === 1 ? "compra pendente" : "compras pendentes"}`,
      href: "/panel/admin/orders",
    });
  }
  if (dados.conflitosCatalogo > 0) {
    alertas.push({
      id: "conflitos",
      severidade: "aviso",
      texto: `${dados.conflitosCatalogo} ${dados.conflitosCatalogo === 1 ? "valor de registry escrito" : "valores de registry escritos"} por mais do que um tweak`,
      href: "/panel/admin/catalog",
    });
  }
  if (!dados.discordBotPronto) {
    alertas.push({
      id: "discord",
      severidade: "aviso",
      texto: "Bot do Discord sem token: os cargos não são sincronizados",
      href: null,
    });
  }
  if (dados.tweaksSuspensos > 0) {
    alertas.push({
      id: "suspensos",
      severidade: "info",
      texto: `${dados.tweaksSuspensos} ${dados.tweaksSuspensos === 1 ? "tweak suspenso" : "tweaks suspensos"} não são servidos a ninguém`,
      href: "/panel/admin/catalog",
    });
  }
  if (dados.contasSuspensas > 0) {
    alertas.push({
      id: "contas",
      severidade: "info",
      texto: `${dados.contasSuspensas} ${dados.contasSuspensas === 1 ? "conta suspensa" : "contas suspensas"}`,
      href: "/panel/admin/users",
    });
  }

  const ordem: Record<Severidade, number> = { critico: 0, aviso: 1, info: 2 };
  return alertas.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
}

export const PERIODOS = [
  { id: "7", label: "7 dias", dias: 7 },
  { id: "30", label: "30 dias", dias: 30 },
  { id: "90", label: "90 dias", dias: 90 },
] as const;

export type PeriodoId = (typeof PERIODOS)[number]["id"];

/**
 * Recorta uma serie aos ultimos N dias.
 *
 * A serie vem do servidor com o periodo maior; os periodos menores sao
 * fatias dela. Assim o seletor troca sem ir ao servidor - e o que faz a
 * mudanca parecer instantanea em vez de recarregar a pagina.
 */
export function recortar(serie: Point[], dias: number): Point[] {
  return serie.slice(Math.max(0, serie.length - dias));
}

export function totalDaSerie(serie: Point[]): number {
  return serie.reduce((soma, p) => soma + p.value, 0);
}

/**
 * Variacao entre a primeira e a segunda metade do periodo, em percentagem.
 *
 * Devolve null quando a metade anterior foi zero: dividir por zero daria
 * infinito, e "+Infinity%" nao diz nada a ninguem. Tambem devolve null
 * com menos de 4 pontos - com dois dias, uma "tendencia" nao existe.
 */
export function tendencia(serie: Point[]): number | null {
  if (serie.length < 4) return null;

  const meio = Math.floor(serie.length / 2);
  const anterior = totalDaSerie(serie.slice(0, meio));
  const recente = totalDaSerie(serie.slice(meio));

  if (anterior === 0) return null;
  return ((recente - anterior) / anterior) * 100;
}

export type EstadoServico = {
  nome: string;
  estado: "ok" | "atencao" | "desligado";
  detalhe: string;
};

/**
 * Estado dos servicos, so com o que se sabe.
 *
 * A versao anterior mostrava "58 ms" para a API - um valor escrito a mao
 * no codigo, que nunca foi medido. Aqui cada linha ou tem um facto
 * verificavel ou diz que nao esta configurado.
 */
export function estadoDosServicos(dados: {
  firestoreMs: number | null;
  discordBotPronto: boolean;
  pagamentosConfigurados: boolean;
  versaoPublicada: string;
}): EstadoServico[] {
  return [
    {
      nome: "Base de dados",
      estado: dados.firestoreMs === null ? "desligado" : dados.firestoreMs > 500 ? "atencao" : "ok",
      detalhe:
        dados.firestoreMs === null
          ? "Sem resposta"
          : `${dados.firestoreMs} ms para carregar este painel`,
    },
    {
      nome: "Discord",
      estado: dados.discordBotPronto ? "ok" : "atencao",
      detalhe: dados.discordBotPronto ? "Bot com token" : "Bot sem token configurado",
    },
    {
      nome: "Pagamentos",
      estado: dados.pagamentosConfigurados ? "ok" : "desligado",
      detalhe: dados.pagamentosConfigurados ? "Configurados" : "Sem fornecedor configurado",
    },
    {
      nome: "Aplicação",
      estado: "ok",
      detalhe: `Versão ${dados.versaoPublicada} publicada`,
    },
  ];
}

/** Percentagem formatada com sinal. Null vira travessao. */
export function variacao(valor: number | null): string {
  if (valor === null) return "—";
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${valor.toFixed(0)}%`;
}
