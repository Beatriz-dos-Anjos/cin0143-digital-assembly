import { randomUUID } from "crypto";
import { SessaoVotacao, VotoRegistrado } from "../domain/types";

function createEmptyPlacar() {
  return { sim: 0, nao: 0 };
}

function generateAutomaticTokens(count = 5): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < count; i++) {
    tokens.push(`TK_AUTO_${randomUUID().slice(0, 8).toUpperCase()}`);
  }
  return tokens;
}

const DEFAULT_TOKENS = generateAutomaticTokens(5);

export class SessionStore {
  private sessions = new Map<string, SessaoVotacao>();

  constructor() {
    this.createDefaultSession();
  }

  private createDefaultSession(): SessaoVotacao {
    const sessao: SessaoVotacao = {
      sessao_id: "assembleia-2026-01",
      placar_atual: createEmptyPlacar(),
      tokens_autorizados: [...DEFAULT_TOKENS],
      tokens_que_ja_votaram: [],
      votos_realizados: [],
    };

    this.sessions.set(sessao.sessao_id, sessao);
    return sessao;
  }

  get(sessaoId: string): SessaoVotacao | undefined {
    return this.sessions.get(sessaoId);
  }

  getDefault(): SessaoVotacao {
    const defaultId = "assembleia-2026-01";
    return this.sessions.get(defaultId) ?? this.createDefaultSession();
  }

  create(sessao: SessaoVotacao): void {
    this.sessions.set(sessao.sessao_id, sessao);
  }

  createFromPayload(payload: {
    session_id: string;
    opcoes?: string[];
    tokens_autorizados: string[];
  }): SessaoVotacao {
    const sessao: SessaoVotacao = {
      sessao_id: payload.session_id,
      placar_atual: createEmptyPlacar(),
      tokens_autorizados: [...payload.tokens_autorizados],
      tokens_que_ja_votaram: [],
      votos_realizados: [],
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

  findVoteByToken(sessao: SessaoVotacao, token: string): VotoRegistrado | undefined {
    return sessao.votos_realizados.find((voto) => voto.token === token);
  }

  list(): SessaoVotacao[] {
    return Array.from(this.sessions.values());
  }
}

export const sessionStore = new SessionStore();
