
import {
  DuplicateVoteContext,
  SessaoVotacao,
  TokenAuthStatus,
  VoteContext,
  VoteOption,
  VoteResult,
  VotoRegistrado,
  createVoteError,
} from "./types";
import { parseCastVote } from "./vote-parser";
import { formatTimestamp } from "../loggers/logger";
import { sessionStore } from "../repository/session-store";


/**
 * Obtém o status de autorização de um token
 * @param sessao Sessão ativa
 * @param token Token a verificar
 * @returns Status do token
 */
export function getTokenStatus(
  sessao: SessaoVotacao,
  token: string
): TokenAuthStatus {
  const autorizado = sessao.tokens_autorizados.includes(token);
  const votoAnterior = sessionStore.findVoteByToken(sessao, token);

  return {
    token,
    autorizado,
    votou: Boolean(votoAnterior),
    voto_registrado: votoAnterior?.voto,
    timestamp_voto: votoAnterior?.timestamp,
    pode_votar: autorizado && !votoAnterior,
  };
}

/**
 * Verifica se um token é autorizado para a sessão
 * @param sessao Sessão ativa
 * @param token Token a verificar
 * @returns true se autorizado
 */
function isTokenAuthorized(sessao: SessaoVotacao, token: string): boolean {
  return sessao.tokens_autorizados.includes(token);
}

/**
 * Verifica se um token já votou
 * @param sessao Sessão ativa
 * @param token Token a verificar
 * @returns Voto anterior ou undefined
 */
function findPreviousVote(
  sessao: SessaoVotacao,
  token: string
): VotoRegistrado | undefined {
  return sessionStore.findVoteByToken(sessao, token);
}

/**
 * Processa um voto de forma segura com validação completa
 * ✅ Validações ocorrem ANTES de qualquer mutação
 * ✅ Estado é atualizado atomicamente
 * 
 * @param sessao Sessão de votação
 * @param payload Payload do voto
 * @param context Contexto da requisição
 * @returns Resultado do processamento
 */
export function processVote(
  sessao: SessaoVotacao,
  payload: unknown,
  context?: VoteContext
): VoteResult {
  const parsed = parseCastVote(payload);

  if (!parsed) {
    return {
      success: false,
      error: createVoteError(
        "FORMATO_INVALIDO",
        "Payload inválido. Use o formato: CAST_VOTE|<token>|<opcao>",
        "MEDIUM"
      ),
    };
  }

  const { token, opcao } = parsed;
  if (context?.socket_token && context.socket_token !== token) {
    return {
      success: false,
      error: createVoteError(
        "TOKEN_NAO_AUTORIZADO",
        "Você só pode votar usando o token gerado para esta conexão.",
        "HIGH"
      ),
    };
  }

  if (!isTokenAuthorized(sessao, token)) {
    return {
      success: false,
      error: createVoteError(
        "TOKEN_NAO_AUTORIZADO",
        "Token não autorizado para esta sessão.",
        "HIGH"
      ),
    };
  }

  const votoAnterior = findPreviousVote(sessao, token);

  if (votoAnterior) {
    const duplicate: DuplicateVoteContext = {
      token,
      voto_anterior: votoAnterior.voto,
      voto_tentado: opcao,
      timestamp_voto_anterior: votoAnterior.timestamp,
      tentativa_reversao: votoAnterior.voto !== opcao,
    };

    return {
      success: false,
      error: createVoteError(
        "VOTO_DUPLICADO",
        "Token já exerceu direito de voto.",
        "HIGH"
      ),
      duplicate,
    };
  }

  const voto: VotoRegistrado = {
    token,
    voto: opcao,
    timestamp: formatTimestamp(),
    sessao_id: context?.sessao_id ?? sessao.sessao_id,
    ip: context?.ip,
    socket_id: context?.socket_id,
  };

  try {
    const placarAnterior = { ...sessao.placar_atual };

    const novosPlacar = {
      ...placarAnterior,
      [opcao]: placarAnterior[opcao] + 1,
    };

    sessao.placar_atual = novosPlacar;
    sessao.tokens_que_ja_votaram = [...sessao.tokens_que_ja_votaram, token];
    sessao.votos_realizados = [...sessao.votos_realizados, voto];

    return {
      success: true,
      placar: { ...novosPlacar },
      voto,
    };
  } catch (error) {
    return {
      success: false,
      error: createVoteError(
        "FORMATO_INVALIDO",
        "Erro ao processar voto. Tente novamente.",
        "CRITICAL"
      ),
    };
  }
}

/**
 * Processa um voto formatado manualmente (para console/testes)
 * Útil para testes e operações administrativas
 * 
 * @param sessao Sessão ativa
 * @param token Token do votante
 * @param opcao Opção de voto
 * @returns Resultado do processamento
 */
export function castVoteFromManual(
  sessao: SessaoVotacao,
  token: string,
  opcao: VoteOption
): VoteResult {
  const payload = `CAST_VOTE|${token}|${opcao}`;
  return processVote(sessao, payload, {
    sessao_id: sessao.sessao_id,
  });
}


/**
 * Calcula tokens ainda aptos a votar (usando Set para O(n) em vez de O(n²))
 * @param sessao Sessão ativa
 * @returns Array de tokens aptos
 */
export function getTokensAindaAptos(sessao: SessaoVotacao): string[] {
  const votadosSet = new Set(sessao.tokens_que_ja_votaram);
  return sessao.tokens_autorizados.filter((token) => !votadosSet.has(token));
}

/**
 * Calcula percentual de votos
 * @param votos Número de votos
 * @param total Total de votos
 * @param casasDecimais Casas decimais (padrão: 1)
 * @returns Percentual formatado
 */
export function calculatePercentage(
  votos: number,
  total: number,
  casasDecimais: number = 1
): string {
  if (total === 0) return "0.0%";
  const percentual = (votos / total) * 100;
  return `${percentual.toFixed(casasDecimais)}%`;
}

/**
 * Obtém resumo estatístico da sessão
 * @param sessao Sessão ativa
 * @returns Objeto com estatísticas
 */
export function getVotingStatistics(sessao: SessaoVotacao) {
  const total = sessao.votos_realizados.length;
  const sim = sessao.placar_atual.sim;
  const nao = sessao.placar_atual.nao;
  const aptos = getTokensAindaAptos(sessao);

  return {
    total_votos: total,
    votos_sim: sim,
    votos_nao: nao,
    percentual_sim: calculatePercentage(sim, total),
    percentual_nao: calculatePercentage(nao, total),
    tokens_aptos: aptos.length,
    tokens_votaram: sessao.tokens_que_ja_votaram.length,
    tokens_totais: sessao.tokens_autorizados.length,
  };
}