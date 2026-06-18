import { formatCastVote } from "./vote-parser";
import {
  DuplicateVoteContext,
  SessaoVotacao,
  TokenAuthStatus,
  VoteContext,
  VoteOption,
  VoteResult,
  VotoRegistrado,
} from "./types";
import { parseCastVote } from "./vote-parser";
import { sessionStore } from "../repository/session-store";

import { formatTimestamp } from "../loggers/logger";

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

export function processVote(
  sessao: SessaoVotacao,
  payload: string,
  context?: VoteContext
): VoteResult {
  const parsed = parseCastVote(payload);

  if (!parsed) {
    return {
      success: false,
      error: {
        code: "FORMATO_INVALIDO",
        message:
          "Payload inválido. Use o formato estrito: CAST_VOTE|<token>|<opcao>",
      },
    };
  }

  const { token, opcao } = parsed;

  if (!sessao.tokens_autorizados.includes(token)) {
    return {
      success: false,
      error: {
        code: "TOKEN_NAO_AUTORIZADO",
        message: "Token não autorizado para esta sessão.",
      },
    };
  }

  const votoAnterior = sessionStore.findVoteByToken(sessao, token);

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
      error: {
        code: "VOTO_DUPLICADO",
        message: "Token já exerceu direito de voto.",
      },
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

  sessao.placar_atual[opcao] += 1;
  sessao.tokens_que_ja_votaram.push(token);
  sessao.votos_realizados.push(voto);

  return {
    success: true,
    placar: { ...sessao.placar_atual },
    voto,
  };
}

export function castVoteFromConsole(
  sessao: SessaoVotacao,
  token: string,
  opcao: VoteOption
): VoteResult {
  return processVote(sessao, formatCastVote(token, opcao));
}
