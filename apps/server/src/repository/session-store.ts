

import { SessaoVotacao, VotoRegistrado, PlacarAtual } from "../domain/types";
import { logger } from "../loggers/logger";
import { formatTimestamp } from "../loggers/logger";

export const STATIC_TOKENS = [
  "550e8400-e29b-41d4-a716-446655440000",
  "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
  "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
  "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "a987fbc9-4bed-3078-cf07-9141ba07c9f3",
  "b8659fc7-5b65-4c38-8a8b-bedd779e64e9",
  "d9428888-122b-11e1-b85c-61cd3cbb3210",
  "f47ac10b-58cc-4372-a567-0e02b2c3d479",
] as const;

//Criação inicial
function createEmptyPlacar(): PlacarAtual {
  return { sim: 0, nao: 0 };
}

function createDefaultSession(): SessaoVotacao {
  const now = Date.now();
  return {
    sessao_id:  "assembleia-2026-06",
    placar_atual: createEmptyPlacar(),
    tokens_autorizados: [...STATIC_TOKENS],
    tokens_que_ja_votaram: [],
    votos_realizados: [],
    criada_em: formatTimestamp(new Date(now)),
    iniciada_em: now,
  };
}

export class SessionRepository {
  
  private sessions = new Map<string, SessaoVotacao>();

  constructor() {
    this.initializeDefaultSession();
  }

  private initializeDefaultSession(): void {
    const defaultSession = createDefaultSession();
    this.sessions.set(defaultSession.sessao_id, defaultSession);

    logger.info("SESSION_STORE", "Sessão padrão inicializada", {
      sessao_id: defaultSession.sessao_id,
      total_tokens: defaultSession.tokens_autorizados.length,
    });
  }


  get(sessaoId: string): SessaoVotacao | undefined {
    return this.sessions.get(sessaoId);
  }


  getDefault(): SessaoVotacao {
    const defaultId = process.env.DEFAULT_SESSION_ID || "assembleia-2026-06";
    let sessao = this.sessions.get(defaultId);

    if (!sessao) {
      sessao = createDefaultSession();
      this.sessions.set(sessao.sessao_id, sessao);
    }

    return sessao;
  }

  
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


  createFromPayload(payload: {
    session_id: string;
    tokens_autorizados: string[];
    opcoes?: string[];
  }): SessaoVotacao {
    if (this.sessions.has(payload.session_id)) {
      throw new Error(`Sessão ${payload.session_id} já existe`);
    }

    const now = Date.now();
    const sessao: SessaoVotacao = {
      sessao_id: payload.session_id,
      placar_atual: createEmptyPlacar(),
      tokens_autorizados: [...payload.tokens_autorizados],
      tokens_que_ja_votaram: [],
      votos_realizados: [],
      criada_em: formatTimestamp(new Date(now)),
      iniciada_em: now,
    };

    this.sessions.set(sessao.sessao_id, sessao);
    return sessao;
  }


  addAuthorizedToken(sessaoId: string, token: string): SessaoVotacao | undefined {
    const sessao = this.sessions.get(sessaoId);

    if (!sessao) {
      return undefined;
    }

    if (!sessao.tokens_autorizados.includes(token)) {
      sessao.tokens_autorizados.push(token);
    }

    return sessao;
  }


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


  findVoteByToken(sessao: SessaoVotacao, token: string): VotoRegistrado | undefined {
    return sessao.votos_realizados.find((voto) => voto.token === token);
  }


  list(): SessaoVotacao[] {
    return Array.from(this.sessions.values());
  }

  listFiltered(predicate: (sessao: SessaoVotacao) => boolean): SessaoVotacao[] {
    return Array.from(this.sessions.values()).filter(predicate);
  }


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

  reset(sessaoId: string): SessaoVotacao | undefined {
    const sessao = this.sessions.get(sessaoId);

    if (!sessao) {
      return undefined;
    }

    const now = Date.now();
    sessao.placar_atual = createEmptyPlacar();
    sessao.tokens_autorizados = [...STATIC_TOKENS];
    sessao.tokens_que_ja_votaram = [];
    sessao.votos_realizados = [];
    sessao.iniciada_em = now;

    logger.info("SESSION_STORE", "Sessão reiniciada", {
      sessao_id: sessao.sessao_id,
      total_tokens: sessao.tokens_autorizados.length,
    });

    return sessao;
  }

 
  clear(): void {
    this.sessions.clear();
    this.initializeDefaultSession();
  }
}

export const sessionStore = new SessionRepository();