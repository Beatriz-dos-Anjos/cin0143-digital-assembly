import { CAST_VOTE_PREFIX, ParsedCastVote, VALID_OPTIONS, VoteOption } from "./types";

const CAST_VOTE_PATTERN = /^CAST_VOTE\|([^|]+)\|(sim|nao|não)$/i;

function isValidTokenLength(token: string): boolean {
  return token.length >= 32 && token.length <= 256;
}

export function parseCastVote(payload: unknown): ParsedCastVote | null {
  if (typeof payload !== "string") {
    return null;
  }

  const normalized = payload.trim();
  if (normalized === "") {
    return null;
  }

  const match = normalized.match(CAST_VOTE_PATTERN);
  if (!match) {
    return null;
  }

  const [, token, option] = match;

  if (!token || !isValidTokenLength(token)) {
    return null;
  }

  let normalizedOption = option.trim().toUpperCase();
  if (normalizedOption === "NAO") {
    normalizedOption = "NÃO";
  }

  if (!isValidOption(normalizedOption)) {
    return null;
  }

  return { token: token.trim(), option: normalizedOption };
}

export function isValidOption(value: unknown): value is VoteOption {
  return (
    typeof value === "string" &&
    (VALID_OPTIONS as readonly string[]).includes(value)
  );
}

export function formatCastVote(token: string, option: VoteOption): string {
  if (!isValidTokenLength(token) || !isValidOption(option)) {
    throw new Error("Invalid token or option for formatting");
  }
  return `${CAST_VOTE_PREFIX}|${token}|${option}`;
}

export function isCastVoteFormat(payload: unknown): boolean {
  return parseCastVote(payload) !== null;
}