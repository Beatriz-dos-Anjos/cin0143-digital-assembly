/**
 * Available vote option
 */
export type VoteOption = "SIM" | "NÃO";
export type ErrorSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type VoteErrorCode =
  | "FORMATO_INVALIDO"
  | "TOKEN_NAO_AUTORIZADO"
  | "VOTO_DUPLICADO"
  | "OPCAO_INVALIDA"
  | "SESSAO_NAO_ENCONTRADA"
  | "RATE_LIMIT_EXCEDIDO";
export type LogLevel = "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "ALERT" | "AUDIT";

/**
 * Current score of the voting session
 */
export interface CurrentScore {
  readonly sim: number;
  readonly nao: number;
}

/**
 * Record of a cast vote
 */
export interface RegisteredVote {
  readonly token: string;
  readonly vote: VoteOption;
  readonly timestamp: string;
  readonly session_id: string;
  readonly ip?: string;
  readonly socket_id?: string;
}

/**
 * Voting context (request data)
 */
export interface VoteContext {
  readonly session_id: string;
  readonly socket_id?: string;
  readonly ip?: string;
  readonly socket_token?: string;
}

/**
 * Context for a duplicate vote (for auditing)
 */
export interface DuplicateVoteContext {
  readonly token: string;
  readonly previous_vote: VoteOption;
  readonly attempted_vote: VoteOption;
  readonly previous_vote_timestamp: string;
  readonly reversion_attempt: boolean;
}

/**
 * Voting session with all data
 */
export interface VotingSession {
  readonly session_id: string;
  current_score: CurrentScore;
  authorized_tokens: string[];
  voted_tokens: string[];
  votes_cast: RegisteredVote[];
  readonly created_at: string;
  started_at: number;
  readonly ended_at?: string;
}

/** Duração padrão da janela de votação (segundos). */
export const SESSION_DURATION_SEC = 180;

/**
 * Parsed cast vote
 */
export interface ParsedCastVote {
  readonly token: string;
  readonly option: VoteOption;
}

/**
 * Vote validation error
 */
export interface VoteError {
  readonly code: VoteErrorCode;
  readonly message: string;
  readonly severity: ErrorSeverity;
}

/**
 * Vote processing result
 */
export type VoteResult =
  | {
      readonly success: true;
      readonly score: CurrentScore;
      readonly vote: RegisteredVote;
    }
  | {
      readonly success: false;
      readonly error: VoteError;
      readonly duplicate?: DuplicateVoteContext;
    };

/**
 * Authentication status of a token
 */
export interface TokenAuthStatus {
  readonly token: string;
  readonly authorized: boolean;
  readonly voted: boolean;
  readonly registered_vote?: VoteOption;
  readonly vote_timestamp?: string;
  readonly can_vote: boolean;
}

/**
 * Structured details of a log
 */
export interface LogDetails {
  readonly [key: string]: string | number | boolean | string[] | number[] | undefined;
}

/**
 * Structured log entry
 */
export interface StructuredLog {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly module: string;
  readonly message: string;
  readonly details?: LogDetails;
}

/**
 * Prefix of the cast vote command
 */
export const CAST_VOTE_PREFIX = "CAST_VOTE";

/**
 * Valid vote options
 */
export const VALID_OPTIONS: readonly VoteOption[] = ["SIM", "NÃO"];

/**
 * WebSocket events
 */
export const SOCKET_EVENTS = {
  CAST_VOTE: "cast_vote",
  CLIENT_REGISTER: "client_register",
  CLIENT_REGISTERED: "client_registered",
  SESSION_REQUEST: "session_request",
  SESSION_DATA: "session_data",
  SCORE_UPDATED: "score_updated",
  VOTE_ACCEPTED: "vote_accepted",
  VOTE_ERROR: "vote_error",
  CONNECTION_ACK: "connection_ack",
  SESSION_RESET: "session_reset",
} as const;

/**
 * Rate Limiting settings
 */
export const RATE_LIMIT_CONFIG = {
  MAX_VOTES_PER_HOUR: 1000,
  MAX_VOTES_PER_IP: 100,
  WINDOW_MS: 3600000, // 1 hour in ms
} as const;

/**
 * Security settings
 */
export const SECURITY_CONFIG = {
  TOKEN_LENGTH: 32, // bytes
  TOKEN_ALPHABET: "abcdef0123456789",
  SESSION_TIMEOUT_MS: 86400000, // 24 hours
  MAX_SESSION_LIFETIME_MS: 604800000, // 7 days
} as const;

/**
 * Creates the broadcast channel name for a session
 * @param sessionId Session ID
 * @returns Channel name
 */
export function scoreChannel(sessionId: string): string {
  return `${SOCKET_EVENTS.SCORE_UPDATED}_${sessionId}`;
}

/**
 * Validates if an option is valid
 * @param value Value to validate
 * @returns true if it is a valid option
 */
export function isValidOption(value: unknown): value is VoteOption {
  return typeof value === "string" && VALID_OPTIONS.includes(value as VoteOption);
}

export function createVoteError(
  code: VoteErrorCode,
  message: string,
  severity: ErrorSeverity = "MEDIUM"
): VoteError {
  return { code, message, severity };
}