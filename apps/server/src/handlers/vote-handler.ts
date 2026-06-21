
import { Socket } from "socket.io";
import {
  DuplicateVoteContext,
  SessaoVotacao,
  VoteContext,
  VoteResult,
} from "../domain/types";
import { logger, formatTimestamp } from "../loggers/logger";
import { getTokensAindaAptos, getVotingStatistics } from "../domain/vote-validator";


export function resolveClientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  
  if (typeof forwarded === "string") {
    const ips = forwarded.split(",").map((ip) => ip.trim());
    return ips[0] ?? "desconhecido";
  }

  return socket.handshake.address ?? "desconhecido";
}


export function buildVoteContext(sessao: SessaoVotacao, socket: Socket, socketToken?: string): VoteContext {
  return {
    sessao_id: sessao.sessao_id,
    socket_id: socket.id,
    ip: resolveClientIp(socket),
    socket_token: socketToken,
  };
}



export function logConnection(socketId: string, sessaoId: string): void {
  logger.info("WEBSOCKET", "Cliente conectado", {
    sessao_id: sessaoId,
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
  payload: string,
  context: VoteContext
): void {
  const token = result.voto.token;
  const voto = result.voto.voto;

  logger.success("VOTE_VALIDATION", "Voto validado e registrado com sucesso", {
    token: token.substring(0, 8) + "***",
    voto,
    sessao_id: context.sessao_id,
    ip_cliente: context.ip,
    timestamp: result.voto.timestamp,
  });

  logger.success("VOTE_REGISTRATION", "Voto registrado no placar", {
    token: token.substring(0, 8) + "***",
    voto,
    total_sim: result.placar.sim,
    total_nao: result.placar.nao,
  });
}



export function logUnauthorizedVote(
  token: string,
  context: VoteContext,
  payload: string
): void {
  logger.error("VOTE_VALIDATION", "Tentativa de votação com token não autorizado", {
    token: token.substring(0, 8) + "***",
    sessao_id: context.sessao_id,
    ip_cliente: context.ip,
    acao_tomada: "Voto rejeitado",
  });

  logger.alert("SEGURANCA", "Possível tentativa de fraude detectada", {
    tipo: "TOKEN_NAO_AUTORIZADO",
    token_suspeito: token.substring(0, 8) + "***",
    ip_origem: context.ip,
    status: "Flagged para investigação",
  });
}



export function logDuplicateVote(
  duplicate: DuplicateVoteContext,
  context: VoteContext,
  payload: string
): void {
  const token = duplicate.token;

  logger.error("VOTE_VALIDATION", "Tentativa de voto duplicado rejeitada", {
    tipo_erro: "VOTO_DUPLICADO",
    token: token.substring(0, 8) + "***",
    voto_anterior: duplicate.voto_anterior,
    voto_tentado: duplicate.voto_tentado,
    tentativa_reversao: duplicate.tentativa_reversao ? "SIM" : "NAO",
    sessao_id: context.sessao_id,
    ip_cliente: context.ip,
    timestamp_tentativa: formatTimestamp(),
    timestamp_voto_anterior: duplicate.timestamp_voto_anterior,
  });

  logger.auditoria("AUDITORIA", "Tentativa de voto duplicado detectada", {
    token_suspeito: token.substring(0, 8) + "***",
    voto_anterior: duplicate.voto_anterior,
    voto_tentado: duplicate.voto_tentado,
    ip_origem: context.ip,
    status: "Monitorado",
  });
}

export function logInvalidFormat(payload: string, context: VoteContext): void {
  logger.warning("VOTE_VALIDATION", "Payload malformado rejeitado", {
    socket_id: context.socket_id,
    ip_cliente: context.ip,
    payload_length: payload.length,
    acao_tomada: "Voto rejeitado",
  });
}


export function logVoteSummary(sessao: SessaoVotacao): void {
  const stats = getVotingStatistics(sessao);
  const tokensAptos = getTokensAindaAptos(sessao);

  logger.info("VOTE_SUMMARY", "Status da votação atualizado", {
    sessao_id: sessao.sessao_id,
    votos_processados: stats.total_votos,
    sim: `${stats.votos_sim} votos (${stats.percentual_sim})`,
    nao: `${stats.votos_nao} votos (${stats.percentual_nao})`,
    tokens_aptos: tokensAptos.length,
    tokens_votaram: stats.tokens_votaram,
    tokens_totais: stats.tokens_totais,
  });
}



export function logSessionCreated(sessaoId: string, totalTokens: number): void {
  logger.success("SESSION", "Sessão de votação criada com sucesso", {
    sessao_id: sessaoId,
    tokens_autorizados: totalTokens,
    criada_em: formatTimestamp(),
  });
}


export function logClientAuthenticated(
  token: string,
  sessaoId: string,
  socketId: string,
  totalTokens: number
): void {
  logger.success("WEBSOCKET", "Cliente autenticado para votação", {
    token: token.substring(0, 8) + "***",
    sessao_id: sessaoId,
    socket_id: socketId,
    total_tokens: totalTokens,
  });
}


export function logTokenGenerated(token: string, sessaoId: string): void {
  logger.success("TOKEN_GENERATION", "Token gerado via console de votação", {
    token: token.substring(0, 8) + "***",
    sessao_id: sessaoId,
    gerado_em: formatTimestamp(),
  });
}


export function logSystemError(error: Error, context: string): void {
  logger.error("SYSTEM", `Erro crítico em ${context}`, {
    error_message: error.message,
    error_stack: error.stack?.split("\n")[0] ?? "N/A",
    context,
  });
}


export function logValidationError(
  fieldName: string,
  expectedType: string,
  receivedValue: unknown
): void {
  logger.warning("VALIDATION", "Erro ao validar entrada do usuário", {
    field: fieldName,
    expected_type: expectedType,
    received_type: typeof receivedValue,
  });
}