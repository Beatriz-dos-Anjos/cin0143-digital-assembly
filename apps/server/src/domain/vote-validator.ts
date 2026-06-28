import {
  DuplicateVoteContext,
  VotingSession,
  TokenAuthStatus,
  VoteContext,
  VoteOption,
  VoteResult,
  RegisteredVote,
  createVoteError,
} from "./types";
import { parseCastVote } from "./vote-parser";
import { formatTimestamp } from "../loggers/logger";
import { sessionStore } from "../repository/session-store";

export function getTokenStatus(
  session: VotingSession,
  token: string
): TokenAuthStatus {
  const authorized = session.authorized_tokens.includes(token);
  const previousVote = sessionStore.findVoteByToken(session, token);

  return {
    token,
    authorized,
    voted: Boolean(previousVote),
    registered_vote: previousVote?.vote,
    vote_timestamp: previousVote?.timestamp,
    can_vote: authorized && !previousVote,
  };
}

function isTokenAuthorized(session: VotingSession, token: string): boolean {
  return session.authorized_tokens.includes(token);
}

function findPreviousVote(
  session: VotingSession,
  token: string
): RegisteredVote | undefined {
  return sessionStore.findVoteByToken(session, token);
}

export function processVote(
  session: VotingSession,
  payload: unknown,
  context?: VoteContext
): VoteResult {
  const parsed = parseCastVote(payload);

  if (!parsed) {
    return {
      success: false,
      error: createVoteError(
        "FORMATO_INVALIDO",
        "Token inválido. Use o código completo fornecido pela assembleia.",
        "HIGH"
      ),
    };
  }

  const { token, option } = parsed;
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

  if (!isTokenAuthorized(session, token)) {
    return {
      success: false,
      error: createVoteError(
        "TOKEN_NAO_AUTORIZADO",
        "Token não autorizado para esta sessão.",
        "HIGH"
      ),
    };
  }

  const previousVote = findPreviousVote(session, token);

  if (previousVote) {
    const duplicate: DuplicateVoteContext = {
      token,
      previous_vote: previousVote.vote,
      attempted_vote: option,
      previous_vote_timestamp: previousVote.timestamp,
      reversion_attempt: previousVote.vote !== option,
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

  const vote: RegisteredVote = {
    token,
    vote: option,
    timestamp: formatTimestamp(),
    session_id: context?.session_id ?? session.session_id,
    ip: context?.ip,
    socket_id: context?.socket_id,
  };

  try {
    const previousScore = { ...session.current_score };
    const scoreKey = option === "SIM" ? "sim" : "nao";

    const newScore = {
      ...previousScore,
      [scoreKey]: previousScore[scoreKey] + 1,
    };

    session.current_score = newScore;
    session.voted_tokens = [...session.voted_tokens, token];
    session.votes_cast = [...session.votes_cast, vote];

    return {
      success: true,
      score: { ...newScore },
      vote,
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

export function castVoteFromManual(
  session: VotingSession,
  token: string,
  option: VoteOption
): VoteResult {
  const payload = `CAST_VOTE|${token}|${option}`;
  return processVote(session, payload, {
    session_id: session.session_id,
  });
}

export function getEligibleTokens(session: VotingSession): string[] {
  const votedSet = new Set(session.voted_tokens);
  return session.authorized_tokens.filter((token) => !votedSet.has(token));
}

export function calculatePercentage(
  votes: number,
  total: number,
  decimalPlaces: number = 1
): string {
  if (total === 0) return "0.0%";
  const percentual = (votes / total) * 100;
  return `${percentual.toFixed(decimalPlaces)}%`;
}

export function getVotingStatistics(session: VotingSession) {
  const total = session.votes_cast.length;
  const sim = session.current_score.sim;
  const no = session.current_score.nao;
  const eligible = getEligibleTokens(session);

  return {
    total_votes: total,
    votes_sim: sim,
    votes_no: no,
    percentage_sim: calculatePercentage(sim, total),
    percentage_no: calculatePercentage(no, total),
    eligible_tokens: eligible.length,
    voted_tokens: session.voted_tokens.length,
    total_tokens: session.authorized_tokens.length,
  };
}