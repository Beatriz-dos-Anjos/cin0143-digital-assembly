import { VotingSession, RegisteredVote, CurrentScore } from "../domain/types";
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

function createEmptyScore(): CurrentScore {
  return { sim: 0, nao: 0 };
}

function createDefaultSession(): VotingSession {
  const now = Date.now();
  return {
    session_id: "assembleia-2026-06",
    current_score: createEmptyScore(),
    authorized_tokens: [...STATIC_TOKENS],
    voted_tokens: [],
    votes_cast: [],
    created_at: formatTimestamp(new Date(now)),
    started_at: now,
  };
}

export class SessionRepository {
  
  private sessions = new Map<string, VotingSession>();

  constructor() {
    this.initializeDefaultSession();
  }

  private initializeDefaultSession(): void {
    const defaultSession = createDefaultSession();
    this.sessions.set(defaultSession.session_id, defaultSession);

    logger.info("SESSION_STORE", "Default session initialized", {
      session_id: defaultSession.session_id,
      total_tokens: defaultSession.authorized_tokens.length,
    });
  }

  get(sessionId: string): VotingSession | undefined {
    return this.sessions.get(sessionId);
  }

  getDefault(): VotingSession {
    const defaultId = process.env.DEFAULT_SESSION_ID || "assembleia-2026-06";
    let session = this.sessions.get(defaultId);

    if (!session) {
      session = createDefaultSession();
      this.sessions.set(session.session_id, session);
    }

    return session;
  }
  
  create(session: VotingSession): void {
    if (this.sessions.has(session.session_id)) {
      throw new Error(`Session ${session.session_id} already exists`);
    }

    this.sessions.set(session.session_id, session);

    logger.success("SESSION_STORE", "New session created", {
      session_id: session.session_id,
      total_tokens: session.authorized_tokens.length,
    });
  }

  createFromPayload(payload: {
    session_id: string;
    authorized_tokens: string[];
    options?: string[];
  }): VotingSession {
    if (this.sessions.has(payload.session_id)) {
      throw new Error(`Session ${payload.session_id} already exists`);
    }

    const now = Date.now();
    const session: VotingSession = {
      session_id: payload.session_id,
      current_score: createEmptyScore(),
      authorized_tokens: [...payload.authorized_tokens],
      voted_tokens: [],
      votes_cast: [],
      created_at: formatTimestamp(new Date(now)),
      started_at: now,
    };

    this.sessions.set(session.session_id, session);
    return session;
  }

  addAuthorizedToken(sessionId: string, token: string): VotingSession | undefined {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return undefined;
    }

    if (!session.authorized_tokens.includes(token)) {
      session.authorized_tokens.push(token);
    }

    return session;
  }

  removeToken(sessionId: string, token: string): VotingSession | undefined {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return undefined;
    }

    const index = session.authorized_tokens.indexOf(token);
    if (index > -1) {
      session.authorized_tokens.splice(index, 1);
    }

    return session;
  }

  findVoteByToken(session: VotingSession, token: string): RegisteredVote | undefined {
    return session.votes_cast.find((vote) => vote.token === token);
  }

  list(): VotingSession[] {
    return Array.from(this.sessions.values());
  }

  listFiltered(predicate: (session: VotingSession) => boolean): VotingSession[] {
    return Array.from(this.sessions.values()).filter(predicate);
  }

  getGlobalStatistics() {
    const sessions = this.list();
    const totalVotes = sessions.reduce((acc, s) => acc + s.votes_cast.length, 0);
    const totalsim = sessions.reduce((acc, s) => acc + s.current_score.sim, 0);
    const totalNao = sessions.reduce((acc, s) => acc + s.current_score.nao, 0);

    return {
      total_sessions: sessions.length,
      total_votes: totalVotes,
      total_sim: totalsim,
      total_nao: totalNao,
      total_tokens: sessions.reduce((acc, s) => acc + s.authorized_tokens.length, 0),
    };
  }

  reset(sessionId: string): VotingSession | undefined {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return undefined;
    }

    const now = Date.now();
    session.current_score = createEmptyScore();
    session.authorized_tokens = [...STATIC_TOKENS];
    session.voted_tokens = [];
    session.votes_cast = [];
    session.started_at = now;

    logger.info("SESSION_STORE", "Session restarted", {
      session_id: session.session_id,
      total_tokens: session.authorized_tokens.length,
    });

    return session;
  }

  clear(): void {
    this.sessions.clear();
    this.initializeDefaultSession();
  }
}

export const sessionStore = new SessionRepository();