/**
 * Session Store - Repositório de sessões de votação
 * ✅ Padrão Repository
 * ✅ Separação de concerns
 * ✅ Métodos imutáveis
 */

import { SessaoVotacao, VotoRegistrado, PlacarAtual } from "../domain/types";
import { logger } from "../loggers/logger";
import { formatTimestamp } from "../loggers/logger";

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Cria um placar vazio
 */
function createEmptyPlacar(): PlacarAtual {
  return { sim: 0, nao: 0 };
}

/**
 * Cria uma sessão padrão
 */
function createDefaultSession(): SessaoVotacao {
  return {
    sessao_id: process.env.DEFAULT_SESSION_ID || "assembleia-2026-01",
    placar_atual: createEmptyPlacar(),
    tokens_autorizados: [],
    tokens_que_ja_votaram: [],
    votos_realizados: [],
    criada_em: formatTimestamp(),
  };
}

// ============================================================================
// REPOSITORY PATTERN
// ============================================================================

/**
 * Repository para sessões de votação
 * Centraliza toda a lógica de persistência e consulta
 */
export class SessionRepository {
  /**
   * Map em memória de sessões
   * TODO: Substituir por banco de dados real em produção
   */
  private sessions = new Map<string, SessaoVotacao>();

  constructor() {
    this.initializeDefaultSession();
  }

  /**
   * Inicializa a sessão padrão
   */
  private initializeDefaultSession(): void {
    const defaultSession = createDefaultSession();
    this.sessions.set(defaultSession.sessao_id, defaultSession);

    logger.info("SESSION_STORE", "Sessão padrão inicializada", {
      sessao_id: defaultSession.sessao_id,
    });
  }

  /**
   * Obtém uma sessão por ID
   * @param sessaoId ID da sessão
   * @returns Sessão ou undefined se não existe
   */
  get(sessaoId: string): SessaoVotacao | undefined {
    return this.sessions.get(sessaoId);
  }

  /**
   * Obtém a sessão padrão
   * @returns Sessão padrão (cria se não existir)
   */
  getDefault(): SessaoVotacao {
    const defaultId = process.env.DEFAULT_SESSION_ID || "assembleia-2026-01";
    let sessao = this.sessions.get(defaultId);

    if (!sessao) {
      sessao = createDefaultSession();
      this.sessions.set(sessao.sessao_id, sessao);
    }

    return sessao;
  }

  /**
   * Cria uma nova sessão
   * @param sessao Sessão a criar
   * @throws Erro se sessão já existe
   */
  create(sessao: SessaoVotacao): void {
    if (this.sessions.has(sessao.sessao_id)) {
      throw new Error(`Sessão ${sessao.sessao_id} já existe`);
    }

    this.sessions.set(sessao.sessao_id, sessao);

    logger.success("SESSION_STORE", "Nova sessão criada", {
      sessao_id: sessao.sessao_id,
      total_tokens: sessao.tokens_autorizados.length,
    });
  }

  /**
   * Cria uma sessão a partir de um payload
   * @param payload Dados da nova sessão
   * @returns Sessão criada
   */
  createFromPayload(payload: {
    session_id: string;
    tokens_autorizados: string[];
    opcoes?: string[];
  }): SessaoVotacao {
    if (this.sessions.has(payload.session_id)) {
      throw new Error(`Sessão ${payload.session_id} já existe`);
    }

    const sessao: SessaoVotacao = {
      sessao_id: payload.session_id,
      placar_atual: createEmptyPlacar(),
      tokens_autorizados: [...payload.tokens_autorizados],
      tokens_que_ja_votaram: [],
      votos_realizados: [],
      criada_em: formatTimestamp(),
    };

    this.sessions.set(sessao.sessao_id, sessao);
    return sessao;
  }

  /**
   * Adiciona um token autorizado a uma sessão
   * @param sessaoId ID da sessão
   * @param token Token a adicionar
   * @returns Sessão atualizada ou undefined se não existe
   */
  addAuthorizedToken(sessaoId: string, token: string): SessaoVotacao | undefined {
    const sessao = this.sessions.get(sessaoId);

    if (!sessao) {
      return undefined;
    }

    // ✅ Evitar duplicatas
    if (!sessao.tokens_autorizados.includes(token)) {
      sessao.tokens_autorizados.push(token);
    }

    return sessao;
  }

  /**
   * Remove um token de uma sessão
   * @param sessaoId ID da sessão
   * @param token Token a remover
   * @returns Sessão atualizada ou undefined se não existe
   */
  removeToken(sessaoId: string, token: string): SessaoVotacao | undefined {
    const sessao = this.sessions.get(sessaoId);

    if (!sessao) {
      return undefined;
    }

    const index = sessao.tokens_autorizados.indexOf(token);
    if (index > -1) {
      sessao.tokens_autorizados.splice(index, 1);
    }

    return sessao;
  }

  /**
   * Encontra um voto pelo token
   * @param sessao Sessão ativa
   * @param token Token a procurar
   * @returns Voto encontrado ou undefined
   */
  findVoteByToken(sessao: SessaoVotacao, token: string): VotoRegistrado | undefined {
    return sessao.votos_realizados.find((voto) => voto.token === token);
  }

  /**
   * Lista todas as sessões
   * @returns Array de sessões
   */
  list(): SessaoVotacao[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Lista todas as sessões com filtro
   * @param predicate Função de filtro
   * @returns Array de sessões filtradas
   */
  listFiltered(predicate: (sessao: SessaoVotacao) => boolean): SessaoVotacao[] {
    return Array.from(this.sessions.values()).filter(predicate);
  }

  /**
   * Obtém estatísticas gerais de todas as sessões
   * @returns Objeto com estatísticas
   */
  getGlobalStatistics() {
    const sessions = this.list();
    const totalVotos = sessions.reduce((acc, s) => acc + s.votos_realizados.length, 0);
    const totalSim = sessions.reduce((acc, s) => acc + s.placar_atual.sim, 0);
    const totalNao = sessions.reduce((acc, s) => acc + s.placar_atual.nao, 0);

    return {
      total_sessoes: sessions.length,
      total_votos: totalVotos,
      total_sim: totalSim,
      total_nao: totalNao,
      total_tokens: sessions.reduce((acc, s) => acc + s.tokens_autorizados.length, 0),
    };
  }

  /**
   * Limpa todas as sessões (use com cuidado!)
   */
  clear(): void {
    this.sessions.clear();
    this.initializeDefaultSession();
  }
}

// ============================================================================
// INSTÂNCIA SINGLETON
// ============================================================================

export const sessionStore = new SessionRepository();