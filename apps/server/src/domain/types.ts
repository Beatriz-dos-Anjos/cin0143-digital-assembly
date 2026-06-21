/**
 * Sistema de Votação Digital - Tipos Centralizados
 * Versão: 1.0.0
 */

// ============================================================================
// TIPOS BÁSICOS
// ============================================================================

/**
 * Opção de voto disponível
 */
export type VoteOption = "sim" | "nao";

/**
 * Nível de severidade de erro
 */
export type ErrorSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Código de erro na validação de voto
 */
export type VoteErrorCode =
  | "FORMATO_INVALIDO"
  | "TOKEN_NAO_AUTORIZADO"
  | "VOTO_DUPLICADO"
  | "OPCAO_INVALIDA"
  | "SESSAO_NAO_ENCONTRADA"
  | "RATE_LIMIT_EXCEDIDO";

/**
 * Nível de log
 */
export type LogLevel = "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "ALERT" | "AUDITORIA";

// ============================================================================
// INTERFACES - PLACAR E VOTOS
// ============================================================================

/**
 * Placar atual da votação
 */
export interface PlacarAtual {
  readonly sim: number;
  readonly nao: number;
}

/**
 * Registro de um voto realizado
 */
export interface VotoRegistrado {
  readonly token: string;
  readonly voto: VoteOption;
  readonly timestamp: string;
  readonly sessao_id: string;
  readonly ip?: string;
  readonly socket_id?: string;
}

/**
 * Contexto de votação (dados da requisição)
 */
export interface VoteContext {
  readonly sessao_id: string;
  readonly socket_id?: string;
  readonly ip?: string;
  readonly socket_token?: string; 

}

/**
 * Contexto de voto duplicado (para auditoria)
 */
export interface DuplicateVoteContext {
  readonly token: string;
  readonly voto_anterior: VoteOption;
  readonly voto_tentado: VoteOption;
  readonly timestamp_voto_anterior: string;
  readonly tentativa_reversao: boolean;
}

// ============================================================================
// INTERFACES - SESSÃO
// ============================================================================

/**
 * Sessão de votação com todos os dados
 */
export interface SessaoVotacao {
  readonly sessao_id: string;
  placar_atual: PlacarAtual;
  tokens_autorizados: string[];
  tokens_que_ja_votaram: string[];
  votos_realizados: VotoRegistrado[];
  readonly criada_em: string;
  readonly encerrada_em?: string;
}

// ============================================================================
// INTERFACES - PARSER E VALIDAÇÃO
// ============================================================================

/**
 * Voto parseado de um payload
 */
export interface ParsedCastVote {
  readonly token: string;
  readonly opcao: VoteOption;
}

/**
 * Erro de validação de voto
 */
export interface VoteError {
  readonly code: VoteErrorCode;
  readonly message: string;
  readonly severity: ErrorSeverity;
}

// ============================================================================
// INTERFACES - RESULTADO DE OPERAÇÃO
// ============================================================================

/**
 * Resultado de processamento de voto (Union Type)
 */
export type VoteResult =
  | {
      readonly success: true;
      readonly placar: PlacarAtual;
      readonly voto: VotoRegistrado;
    }
  | {
      readonly success: false;
      readonly error: VoteError;
      readonly duplicate?: DuplicateVoteContext;
    };

/**
 * Status de autenticação de um token
 */
export interface TokenAuthStatus {
  readonly token: string;
  readonly autorizado: boolean;
  readonly votou: boolean;
  readonly voto_registrado?: VoteOption;
  readonly timestamp_voto?: string;
  readonly pode_votar: boolean;
}

// ============================================================================
// INTERFACES - LOGGING
// ============================================================================

/**
 * Detalhes estruturados de um log
 */
export interface LogDetails {
  readonly [key: string]: string | number | boolean | string[] | number[] | undefined;
}

/**
 * Entrada de log estruturada
 */
export interface StructuredLog {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly module: string;
  readonly message: string;
  readonly details?: LogDetails;
}

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Prefixo do comando de voto
 */
export const CAST_VOTE_PREFIX = "CAST_VOTE";

/**
 * Opções de voto válidas
 */
export const VALID_OPTIONS: readonly VoteOption[] = ["sim", "nao"];

/**
 * Eventos de WebSocket
 */
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

/**
 * Configurações de Rate Limiting
 */
export const RATE_LIMIT_CONFIG = {
  MAX_VOTES_PER_HOUR: 1000,
  MAX_VOTES_PER_IP: 100,
  WINDOW_MS: 3600000, // 1 hora em ms
} as const;

/**
 * Configurações de Segurança
 */
export const SECURITY_CONFIG = {
  TOKEN_LENGTH: 32, // bytes
  TOKEN_ALPHABET: "abcdef0123456789",
  SESSION_TIMEOUT_MS: 86400000, // 24 horas
  MAX_SESSION_LIFETIME_MS: 604800000, // 7 dias
} as const;

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Cria o nome do canal de broadcast para uma sessão
 * @param sessaoId ID da sessão
 * @returns Nome do canal
 */
export function placarChannel(sessaoId: string): string {
  return `${SOCKET_EVENTS.PLACAR_ATUALIZADO}_${sessaoId}`;
}

/**
 * Valida se uma opção é válida
 * @param value Valor a validar
 * @returns true se é uma opção válida
 */
export function isValidOption(value: unknown): value is VoteOption {
  return typeof value === "string" && VALID_OPTIONS.includes(value as VoteOption);
}

/**
 * Cria um erro padrão para voto inválido
 * @param code Código do erro
 * @param message Mensagem
 * @param severity Severidade
 * @returns Objeto VoteError
 */
export function createVoteError(
  code: VoteErrorCode,
  message: string,
  severity: ErrorSeverity = "MEDIUM"
): VoteError {
  return { code, message, severity };
}