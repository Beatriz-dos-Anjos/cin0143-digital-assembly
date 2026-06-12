export type VoteOption = "opcao_A" | "opcao_B";

export interface PlacarAtual {
  opcao_A: number;
  opcao_B: number;
}

export interface SessaoVotacao {
  sessao_id: string;
  placar_atual: PlacarAtual;
  tokens_autorizados: string[];
  tokens_que_ja_votaram: string[];
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

export type VoteResult =
  | { success: true; placar: PlacarAtual }
  | { success: false; error: VoteError };

export const CAST_VOTE_PREFIX = "CAST_VOTE";
export const VALID_OPTIONS: readonly VoteOption[] = ["opcao_A", "opcao_B"];

export const SOCKET_EVENTS = {
  CAST_VOTE: "cast_vote",
  PLACAR_ATUALIZADO: "placar_atualizado",
  VOTE_ERROR: "vote_error",
  CONNECTION_ACK: "connection_ack",
} as const;

export function placarChannel(sessaoId: string): string {
  return `${SOCKET_EVENTS.PLACAR_ATUALIZADO}_${sessaoId}`;
}