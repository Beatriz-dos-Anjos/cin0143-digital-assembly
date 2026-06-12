import { parseCastVote } from "./vote-parser";
import { SessaoVotacao, VoteResult } from "./types";

export function processVote(
  sessao: SessaoVotacao,
  payload: string
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

  if (sessao.tokens_que_ja_votaram.includes(token)) {
    return {
      success: false,
      error: {
        code: "VOTO_DUPLICADO",
        message: "Fraude detectada: este token já registrou um voto.",
      },
    };
  }

  sessao.placar_atual[opcao] += 1;
  sessao.tokens_que_ja_votaram.push(token);

  return {
    success: true,
    placar: { ...sessao.placar_atual },
  };
}