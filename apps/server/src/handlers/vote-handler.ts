import { Socket } from "socket.io";
import {
  DuplicateVoteContext,
  VotingSession,
  VoteContext,
  VoteResult,
} from "../domain/types";
import { logger, formatTimestamp } from "../loggers/logger";
import { getEligibleTokens, getVotingStatistics } from "../domain/vote-validator";

export function resolveClientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const ips = forwarded.split(",").map((ip) => ip.trim());
    return ips[0] ?? "unknown";
  }
  return socket.handshake.address ?? "unknown";
}

export function buildVoteContext(session: VotingSession, socket: Socket, socketToken?: string): VoteContext {
  return {
    session_id: session.session_id,
    socket_id: socket.id,
    ip: resolveClientIp(socket),
    socket_token: socketToken,
  };
}

export function logConnection(socketId: string, sessionId: string): void {
  logger.info("WEBSOCKET", "Client connected", {
    session_id: sessionId,
    socket_id: socketId,
  });
}

export function logDisconnection(socketId: string): void {
  logger.info("WEBSOCKET", "Client disconnected", {
    socket_id: socketId,
  });
}

export function logVoteAccepted(
  result: Extract<VoteResult, { success: true }>,
  context: VoteContext
): void {
  const token = result.vote.token;
  const vote = result.vote.vote;

  logger.success("VOTE_VALIDATION", "Vote validated and registered successfully", {
    token: token.substring(0, 8) + "***",
    vote,
    session_id: context.session_id,
    client_ip: context.ip,
    timestamp: result.vote.timestamp,
  });

  logger.success("VOTE_REGISTRATION", "Vote registered in score", {
    token: token.substring(0, 8) + "***",
    vote,
    total_sim: result.score.sim,
    total_nao: result.score.nao,
  });
}

export function logUnauthorizedVote(
  token: string,
  context: VoteContext,
  payload: string
): void {
  logger.error("VOTE_VALIDATION", "Voting attempt with unauthorized token rejected", {
    error_type: "UNAUTHORIZED_TOKEN",
    token: token.substring(0, 8) + "***",
    session_id: context.session_id,
    client_ip: context.ip,
    action_taken: "Vote rejected",
  });

  logger.audit("AUDIT", "Voting attempt with unauthorized token detected", {
    type: "UNAUTHORIZED_TOKEN",
    suspicious_token: token.substring(0, 8) + "***",
    source_ip: context.ip,
    status: "Monitored",
  });
}

export function logDuplicateVote(
  duplicate: DuplicateVoteContext,
  context: VoteContext,
  payload: string
): void {
  const token = duplicate.token;

  logger.error("VOTE_VALIDATION", "Duplicate vote attempt rejected", {
    error_type: "DUPLICATE_VOTE",
    token: token.substring(0, 8) + "***",
    previous_vote: duplicate.previous_vote,
    attempted_vote: duplicate.attempted_vote,
    reversion_attempt: duplicate.reversion_attempt ? "sim" : "nao",
    session_id: context.session_id,
    client_ip: context.ip,
    attempt_timestamp: formatTimestamp(),
    previous_vote_timestamp: duplicate.previous_vote_timestamp,
  });

  logger.audit("AUDIT", "Duplicate vote attempt detected", {
    suspicious_token: token.substring(0, 8) + "***",
    previous_vote: duplicate.previous_vote,
    attempted_vote: duplicate.attempted_vote,
    source_ip: context.ip,
    status: "Monitored",
  });
}

export function logInvalidFormat(payload: string, context: VoteContext): void {
  const tokenMatch = payload.match(/^CAST_VOTE\|([^|]*)\|/);
  const tokenRaw = tokenMatch?.[1]?.trim() ?? "";
  const tokenDisplay =
    tokenRaw.length > 0 ? `${tokenRaw.substring(0, 8)}***` : "malformed";

  logger.error("VOTE_VALIDATION", "Voting attempt with invalid token rejected", {
    error_type: "INVALID_FORMAT",
    token: tokenDisplay,
    session_id: context.session_id,
    client_ip: context.ip,
    payload_length: payload.length,
    action_taken: "Vote rejected",
  });

  logger.audit("AUDIT", "Voting attempt with invalid token detected", {
    suspicious_token: tokenDisplay,
    source_ip: context.ip,
    status: "Monitored",
  });
}

export function logVoteSummary(session: VotingSession): void {
  const stats = getVotingStatistics(session);
  const eligibleTokens = getEligibleTokens(session);

  logger.info("VOTE_SUMMARY", "Voting status updated", {
    session_id: session.session_id,
    processed_votes: stats.total_votes,
    sim: `${stats.votes_sim} votes (${stats.percentage_sim})`,
    no: `${stats.votes_no} votes (${stats.percentage_no})`,
    eligible_tokens: eligibleTokens.length,
    voted_tokens: stats.voted_tokens,
    total_tokens: stats.total_tokens,
  });
}

export function logSessionCreated(sessionId: string, totalTokens: number): void {
  logger.success("SESSION", "Voting session successfully created", {
    session_id: sessionId,
    authorized_tokens: totalTokens,
    created_at: formatTimestamp(),
  });
}

export function logClientAuthenticated(
  token: string,
  sessionId: string,
  socketId: string,
  totalTokens: number
): void {
  logger.success("WEBSOCKET", "Client authenticated for voting", {
    token: token.substring(0, 8) + "***",
    session_id: sessionId,
    socket_id: socketId,
    total_tokens: totalTokens,
  });
}

export function logTokenGenerated(token: string, sessionId: string): void {
  logger.success("TOKEN_GENERATION", "Token generated via voting console", {
    token: token.substring(0, 8) + "***",
    session_id: sessionId,
    generated_at: formatTimestamp(),
  });
}

export function logSystemError(error: Error, context: string): void {
  logger.error("SYSTEM", `Critical error in ${context}`, {
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
  logger.warning("VALIDATION", "Error validating user input", {
    field: fieldName,
    expected_type: expectedType,
    received_type: typeof receivedValue,
  });
}