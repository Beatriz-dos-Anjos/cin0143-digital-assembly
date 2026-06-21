/**
 * Parser de Voto - Extrai e valida payload de voto
 */

import { CAST_VOTE_PREFIX, ParsedCastVote, VALID_OPTIONS, VoteOption } from "./types";

/**
 * Pattern regex para validar formato de voto
 * Formato esperado: CAST_VOTE|<token>|<opcao>
 */
const CAST_VOTE_PATTERN = /^CAST_VOTE\|([^|]+)\|(sim|nao)$/;

/**
 * Valida o comprimento do token (entre 32 e 256 caracteres)
 * @param token Token a validar
 * @returns true se o comprimento é válido
 */
function isValidTokenLength(token: string): boolean {
  return token.length >= 32 && token.length <= 256;
}

/**
 * Parseia um payload de voto em componentes estruturados
 * @param payload String do payload
 * @returns Voto parseado ou null se inválido
 * 
 * @example
 * const result = parseCastVote("CAST_VOTE|abc123|sim");
 * if (result) {
 *   console.log(result.token); // "abc123"
 *   console.log(result.opcao); // "sim"
 * }
 */
export function parseCastVote(payload: unknown): ParsedCastVote | null {
  // ✅ Validar tipo
  if (typeof payload !== "string") {
    return null;
  }

  // ✅ Validar vazio
  const normalized = payload.trim();
  if (normalized === "") {
    return null;
  }

  // ✅ Validar formato com regex
  const match = normalized.match(CAST_VOTE_PATTERN);
  if (!match) {
    return null;
  }

  const [, token, opcao] = match;

  // ✅ Validar comprimento do token
  if (!token || !isValidTokenLength(token)) {
    return null;
  }

  // ✅ Validar opção
  if (!isValidOption(opcao)) {
    return null;
  }

  return { token: token.trim(), opcao };
}

/**
 * Valida se um valor é uma opção de voto válida
 * @param value Valor a validar
 * @returns true se é uma opção válida
 */
export function isValidOption(value: unknown): value is VoteOption {
  return (
    typeof value === "string" &&
    (VALID_OPTIONS as readonly string[]).includes(value)
  );
}

/**
 * Formata um voto em payload string
 * @param token Token do votante
 * @param opcao Opção de voto
 * @returns Payload formatado
 * 
 * @example
 * const payload = formatCastVote("abc123", "sim");
 * console.log(payload); // "CAST_VOTE|abc123|sim"
 */
export function formatCastVote(token: string, opcao: VoteOption): string {
  if (!isValidTokenLength(token) || !isValidOption(opcao)) {
    throw new Error("Token ou opção inválidos para formatação");
  }
  return `${CAST_VOTE_PREFIX}|${token}|${opcao}`;
}

/**
 * Verifica se um payload está no formato correto de voto
 * @param payload Payload a verificar
 * @returns true se está no formato correto
 */
export function isCastVoteFormat(payload: unknown): boolean {
  return parseCastVote(payload) !== null;
}

/**
 * Extrai apenas o token de um payload de voto
 * @param payload Payload de voto
 * @returns Token extraído ou null
 */
export function extractTokenFromPayload(payload: unknown): string | null {
  const parsed = parseCastVote(payload);
  return parsed?.token ?? null;
}

/**
 * Extrai apenas a opção de um payload de voto
 * @param payload Payload de voto
 * @returns Opção extraída ou null
 */
export function extractOptionFromPayload(payload: unknown): VoteOption | null {
  const parsed = parseCastVote(payload);
  return parsed?.opcao ?? null;
}