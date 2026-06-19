export type VoteOption = "sim" | "nao";

export interface PlacarAtual {
  sim: number;
  nao: number;
}

export interface VotoRegistrado {
  token: string;
  voto: VoteOption;
  timestamp: string;
  sessao_id?: string;
  ip?: string;
  socket_id?: string;
}

export interface SessaoVotacao {
  sessao_id: string;
  placar_atual: PlacarAtual;
  tokens_autorizados: string[];
  tokens_que_ja_votaram: string[];
  votos_realizados: VotoRegistrado[];
}

export interface ParsedCastVote {
  token: string;
  opcao: VoteOption;
}

export type VoteErrorCode =
  | "FORMATO_INVALIDO"
  | "TOKEN_NAO_AUTORIZADO"
  | "VOTO_DUPLICADO"
  | "OPCAO_INVALIDA"
  | "SESSAO_NAO_ENCONTRADA";

export interface VoteError {
  code: VoteErrorCode;
  message: string;
}

export interface VoteContext {
  sessao_id: string;
  socket_id?: string;
  ip?: string;
}

export interface DuplicateVoteContext {
  token: string;
  voto_anterior: VoteOption;
  voto_tentado: VoteOption;
  timestamp_voto_anterior: string;
  tentativa_reversao: boolean;
}

export type VoteResult =
  | { success: true; placar: PlacarAtual; voto: VotoRegistrado }
  | {
      success: false;
      error: VoteError;
      duplicate?: DuplicateVoteContext;
    };

export interface TokenAuthStatus {
  token: string;
  autorizado: boolean;
  votou: boolean;
  voto_registrado?: VoteOption;
  timestamp_voto?: string;
  pode_votar: boolean;
}

export const CAST_VOTE_PREFIX = "CAST_VOTE";
export const VALID_OPTIONS: readonly VoteOption[] = ["sim", "nao"];

export const SOCKET_EVENTS = {
  CAST_VOTE: "cast_vote",
  CLIENT_REGISTER: "client_register",
  CLIENT_REGISTERED: "client_registered",
  SESSION_REQUEST: "session_request",
  SESSION_DATA: "session_data",
  PLACAR_ATUALIZADO: "placar_atualizado",
  VOTE_ERROR: "vote_error",
  CONNECTION_ACK: "connection_ack",
} as const;

export function placarChannel(sessaoId: string): string {
  return `${SOCKET_EVENTS.PLACAR_ATUALIZADO}_${sessaoId}`;
}