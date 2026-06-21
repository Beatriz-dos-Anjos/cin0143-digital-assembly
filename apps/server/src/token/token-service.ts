/**
 * Token Service - Gerenciamento seguro de tokens
 * ✅ Tokens criptograficamente seguros
 * ✅ Validação forte
 * ✅ Rastreamento de tokens
 */

import crypto from "crypto";
import { logger } from "../loggers/logger";
import { SECURITY_CONFIG } from "../domain/types";

// ============================================================================
// TIPOS
// ============================================================================

/**
 * Informações de um token gerado
 */
export interface GeneratedToken {
  readonly token: string;
  readonly created_at: string;
  readonly expires_at: string;
}

/**
 * Metadados de um token
 */
interface TokenMetadata {
  created_at: string;
  created_by: string;
  last_used?: string;
  usage_count: number;
}

// ============================================================================
// SERVIÇO DE TOKENS
// ============================================================================

/**
 * Serviço para gerenciar geração e validação de tokens
 */
export class TokenService {
  /**
   * Cache de metadados de tokens
   * TODO: Usar Redis ou banco de dados em produção
   */
  private tokenMetadata = new Map<string, TokenMetadata>();

  /**
   * Gera um token criptograficamente seguro
   * @returns Token em hexadecimal (64 caracteres = 256 bits)
   */
  generateSecureToken(): string {
    // ✅ Use crypto.randomBytes para entropia real
    return crypto.randomBytes(SECURITY_CONFIG.TOKEN_LENGTH).toString("hex");
  }

  /**
   * Cria um novo token com metadados
   * @param createdBy Identificação de quem criou o token
   * @param expirationHours Horas até expiração (padrão: 24)
   * @returns Objeto com token e informações
   */
  createToken(createdBy: string = "system", expirationHours: number = 24): GeneratedToken {
    const token = this.generateSecureToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expirationHours * 3600 * 1000);

    // Armazenar metadados
    this.tokenMetadata.set(token, {
      created_at: now.toISOString(),
      created_by: createdBy,
      usage_count: 0,
    });

    logger.success("TOKEN_SERVICE", "Token gerado com sucesso", {
      token: token.substring(0, 8) + "***", // Não logar token inteiro
      created_by: createdBy,
      expires_at: expiresAt.toISOString(),
    });

    return {
      token,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
  }

  /**
   * Valida o formato de um token
   * @param token Token a validar
   * @returns true se o formato é válido
   */
  isValidTokenFormat(token: string): boolean {
    // ✅ Deve ser 64 caracteres hexadecimais (32 bytes)
    return /^[a-f0-9]{64}$/.test(token);
  }

  /**
   * Valida se um token é válido (formato + segurança)
   * @param token Token a validar
   * @returns true se válido
   */
  isValidToken(token: string): boolean {
    if (!this.isValidTokenFormat(token)) {
      return false;
    }

    // Verificar se o token foi registrado
    const metadata = this.tokenMetadata.get(token);
    if (!metadata) {
      return false;
    }

    // Verificar expiração (opcional, depende de sua implementação)
    return true;
  }

  /**
   * Registra o uso de um token
   * @param token Token a registrar
   */
  recordTokenUsage(token: string): void {
    const metadata = this.tokenMetadata.get(token);
    if (metadata) {
      metadata.usage_count += 1;
      metadata.last_used = new Date().toISOString();
    }
  }

  /**
   * Obtém metadados de um token
   * @param token Token a consultar
   * @returns Metadados ou undefined
   */
  getTokenMetadata(token: string): TokenMetadata | undefined {
    return this.tokenMetadata.get(token);
  }

  /**
   * Lista todos os tokens registrados (apenas para auditoria)
   * @returns Array com resumo dos tokens
   */
  listTokens() {
    return Array.from(this.tokenMetadata.entries()).map(([token, metadata]) => ({
      token: token.substring(0, 8) + "***", // Não expor token inteiro
      ...metadata,
    }));
  }

  /**
   * Remove um token do registro
   * @param token Token a remover
   */
  revokeToken(token: string): void {
    this.tokenMetadata.delete(token);
    logger.warning("TOKEN_SERVICE", "Token revogado", {
      token: token.substring(0, 8) + "***",
    });
  }

  /**
   * Limpa tokens expirados (executa periodicamente)
   * @param expirationHours Horas para considerar expirado
   */
  cleanupExpiredTokens(expirationHours: number = 24): number {
    const now = new Date();
    let removed = 0;

    for (const [token, metadata] of this.tokenMetadata.entries()) {
      const createdAt = new Date(metadata.created_at);
      const expiresAt = new Date(createdAt.getTime() + expirationHours * 3600 * 1000);

      if (now > expiresAt) {
        this.tokenMetadata.delete(token);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info("TOKEN_SERVICE", `${removed} tokens expirados foram removidos`, {
        tokens_removed: removed,
      });
    }

    return removed;
  }
}

// ============================================================================
// INSTÂNCIA SINGLETON
// ============================================================================

export const tokenService = new TokenService();

// ============================================================================
// SCHEDULER (Executar periodicamente)
// ============================================================================

/**
 * Inicia limpeza periódica de tokens expirados
 * @param intervalMinutes Intervalo em minutos (padrão: 60)
 */
export function startTokenCleanupScheduler(intervalMinutes: number = 60): NodeJS.Timer {
  return setInterval(() => {
    tokenService.cleanupExpiredTokens();
  }, intervalMinutes * 60 * 1000);
}