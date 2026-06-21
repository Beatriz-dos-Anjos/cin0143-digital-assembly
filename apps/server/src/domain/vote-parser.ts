
import { CAST_VOTE_PREFIX, ParsedCastVote, VALID_OPTIONS, VoteOption } from "./types";


const CAST_VOTE_PATTERN = /^CAST_VOTE\|([^|]+)\|(sim|nao)$/;


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

  const [, token, opcao] = match;

  if (!token || !isValidTokenLength(token)) {
    return null;
  }

  if (!isValidOption(opcao)) {
    return null;
  }

  return { token: token.trim(), opcao };
}

export function isValidOption(value: unknown): value is VoteOption {
  return (
    typeof value === "string" &&
    (VALID_OPTIONS as readonly string[]).includes(value)
  );
}


export function formatCastVote(token: string, opcao: VoteOption): string {
  if (!isValidTokenLength(token) || !isValidOption(opcao)) {
    throw new Error("Token ou opção inválidos para formatação");
  }
  return `${CAST_VOTE_PREFIX}|${token}|${opcao}`;
}


export function isCastVoteFormat(payload: unknown): boolean {
  return parseCastVote(payload) !== null;
}


export function extractTokenFromPayload(payload: unknown): string | null {
  const parsed = parseCastVote(payload);
  return parsed?.token ?? null;
}


export function extractOptionFromPayload(payload: unknown): VoteOption | null {
  const parsed = parseCastVote(payload);
  return parsed?.opcao ?? null;
}