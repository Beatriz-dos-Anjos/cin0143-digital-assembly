import { Socket } from "socket.io";

import {
  DuplicateVoteContext,
  SessaoVotacao,
  VoteContext,
  VoteResult,
} from "../domain/types";
import { logger, formatTimestamp } from "../loggers/logger";

function getTokensAindaAptos(sessao: SessaoVotacao): string[] {
  return sessao.tokens_autorizados.filter(
    (token) => !sessao.tokens_que_ja_votaram.includes(token)
  );
}

function resolveClientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() ?? "desconhecido";
  }

  return socket.handshake.address ?? "desconhecido";
}

export function buildVoteContext(
  sessao: SessaoVotacao,
  socket: Socket
): VoteContext {
  return {
    sessao_id: sessao.sessao_id,
    socket_id: socket.id,
    ip: resolveClientIp(socket),
  };
}

export function logConnection(socketId: string, sessaoId: string): void {
  logger.info("WEBSOCKET", "Cliente conectado", {
    sessao_id: sessaoId,
    sessao_id_ws: `sess_${socketId}`,
    socket_id: socketId,
  });
}

export function logDisconnection(socketId: string): void {
  logger.info("WEBSOCKET", "Cliente desconectado", {
    socket_id: socketId,
  });
}

export function logVoteAccepted(
  result: Extract<VoteResult, { success: true }>,
  payload: string
): void {
  logger.info("VOTE_VALIDATION", "Token validado com sucesso", {
    token: result.voto.token,
    status: "Autorizado",
    primeira_votacao: "SIM",
  });

  logger.success("VOTE_REGISTRATION", "Voto registrado com sucesso", {
    token: result.voto.token,
    voto: result.voto.voto,
    sessao: result.voto.socket_id ? `sess_${result.voto.socket_id}` : undefined,
    ip: result.voto.ip,
    timestamp: result.voto.timestamp,
    total_opcao_A: result.placar.opcao_A,
    total_opcao_B: result.placar.opcao_B,
    payload,
  });
}

export function logUnauthorizedVote(
  token: string,
  context: VoteContext,
  payload: string
): void {
  logger.error("VOTE_VALIDATION", "Tentativa de votação com token inválido", {
    token,
    status: "NAO AUTORIZADO",
    sessao: context.socket_id ? `sess_${context.socket_id}` : undefined,
    ip_cliente: context.ip,
    payload,
    acao_tomada: "Voto rejeitado",
  });

  logger.alert("SEGURANCA", "Possível tentativa de fraude", {
    token_fraudulento: token,
    ip_origem: context.ip,
    status: "Flagged para investigação",
  });
}

export function logDuplicateVote(
  duplicate: DuplicateVoteContext,
  context: VoteContext,
  payload: string
): void {
  logger.error("VOTE_VALIDATION", "Voto REJEITADO - Duplicidade detectada", {
    tipo_erro: "VOTO_DUPLICADO",
    token: duplicate.token,
    voto_tentado: duplicate.voto_tentado,
    voto_anterior: duplicate.voto_anterior,
    sessao_id: context.socket_id ? `sess_${context.socket_id}` : undefined,
    ip_cliente: context.ip,
    timestamp_tentativa: formatTimestamp(),
    timestamp_voto_anterior: duplicate.timestamp_voto_anterior,
    tentativa_reversao: duplicate.tentativa_reversao ? "SIM" : "NAO",
    motivo_rejeicao: "Duplicidade de token",
    acao_tomada: "Voto rejeitado, sessão mantida aberta",
    mensagem: "Token já exerceu direito de voto",
    payload,
  });

  logger.auditoria("AUDITORIA", "Tentativa de voto duplicado detectada", {
    token_suspeito: duplicate.token,
    voto_anterior: duplicate.voto_anterior,
    voto_tentado: duplicate.voto_tentado,
    status: "Monitorado",
  });
}

export function logInvalidFormat(payload: string, context: VoteContext): void {
  logger.warning("VOTE_VALIDATION", "Payload malformado rejeitado", {
    payload,
    socket_id: context.socket_id,
    ip_cliente: context.ip,
    acao_tomada: "Voto rejeitado",
  });
}

export function logVoteSummary(sessao: SessaoVotacao): void {
  const total = sessao.votos_realizados.length;
  const totalA = sessao.placar_atual.opcao_A;
  const totalB = sessao.placar_atual.opcao_B;
  const percentA = total > 0 ? ((totalA / total) * 100).toFixed(1) : "0.0";
  const percentB = total > 0 ? ((totalB / total) * 100).toFixed(1) : "0.0";
  const tokensAutorizadosAVotar = getTokensAindaAptos(sessao);

  logger.info("VOTE_SUMMARY", "Status da votação atualizado", {
    sessao_id: sessao.sessao_id,
    votos_processados: total,
    opcao_A: `${totalA} votos (${percentA}%)`,
    opcao_B: `${totalB} votos (${percentB}%)`,
    tokens_autorizados_a_votar: tokensAutorizadosAVotar,
    tokens_que_ja_votaram: sessao.tokens_que_ja_votaram,
  });
}
