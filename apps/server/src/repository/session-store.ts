import { SessaoVotacao } from "../domain/types";

function createEmptyPlacar() {
  return { opcao_A: 0, opcao_B: 0 };
}

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

export class SessionStore {
  private sessions = new Map<string, SessaoVotacao>();

  constructor() {
    this.createDefaultSession();
  }

  private createDefaultSession(): SessaoVotacao {
    const sessao: SessaoVotacao = {
      sessao_id: "assembleia-2026-01",
      placar_atual: createEmptyPlacar(),
      tokens_autorizados: [...STATIC_TOKENS],
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
