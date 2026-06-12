import { SessaoVotacao } from "../domain/types";

function createEmptyPlacar() {
  return { opcao_A: 0, opcao_B: 0 };
}

const DEFAULT_TOKENS = [
  "TK_CONDOMINO_001",
  "TK_CONDOMINO_002",
  "TK_CONDOMINO_003",
  "TK_CONDOMINO_450",
];

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

  list(): SessaoVotacao[] {
    return Array.from(this.sessions.values());
  }
}

export const sessionStore = new SessionStore();