import {
  CAST_VOTE_PREFIX,
  ParsedCastVote,
  VALID_OPTIONS,
  VoteOption,
} from "./types";

const CAST_VOTE_PATTERN = /^CAST_VOTE\|([^|]+)\|(opcao_A|opcao_B)$/;

export function parseCastVote(payload: string): ParsedCastVote | null {
  if (typeof payload !== "string" || payload.trim() === "") {
    return null;
  }

  const normalized = payload.trim();
  const match = normalized.match(CAST_VOTE_PATTERN);

  if (!match) {
    return null;
  }

  const [, token, opcao] = match;

  if (!token || !isValidOption(opcao)) {
    return null;
  }

  return { token, opcao };
}

export function isValidOption(value: string): value is VoteOption {
  return (VALID_OPTIONS as readonly string[]).includes(value);
}

export function formatCastVote(token: string, opcao: VoteOption): string {
  return `${CAST_VOTE_PREFIX}|${token}|${opcao}`;
}

export function isCastVoteFormat(payload: string): boolean {
  return parseCastVote(payload) !== null;
}