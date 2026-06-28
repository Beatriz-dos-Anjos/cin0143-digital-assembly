import { Express, Request, Response } from "express";
import { Server } from "socket.io";
import { z } from "zod";
import {
  scoreChannel,
  SOCKET_EVENTS,
  SESSION_DURATION_SEC,
  CAST_VOTE_PREFIX,
} from "../domain/types";
import withSessionLock from "../domain/lock.service";
import { processVote, getEligibleTokens } from "../domain/vote-validator";
import {
  logDuplicateVote,
  logInvalidFormat,
  logUnauthorizedVote,
  logVoteAccepted,
  logVoteSummary,
  logSessionCreated,
  logTokenGenerated,
} from "../handlers/vote-handler";
import { logger } from "../loggers/logger";
import { sessionStore } from "../repository/session-store";
import { tokenService } from "../token/token-service";

const CreateSessionSchema = z.object({
  session_id: z.string().min(3).max(50),
  authorized_tokens: z.array(z.string()).min(1),
  options: z.array(z.string()).optional(),
});

const DEFAULT_SESSION_ID = "assembleia-2026-06";
const NODE_ENV = "development";

function paramAsString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildVotePayload(token: unknown, option: unknown): string {
  const tokenStr = typeof token === "string" ? token.trim() : String(token ?? "");
  const optionStr =
    typeof option === "string" ? option.trim().toLowerCase() : String(option ?? "");
  return `${CAST_VOTE_PREFIX}|${tokenStr}|${optionStr}`;
}

function resolveSessionIdFromQuery(req: Request): string {
  const query = req.query.sessionId;
  if (typeof query === "string" && query.trim()) {
    return query.trim();
  }
  return DEFAULT_SESSION_ID;
}

function getSessionSnapshot(sessionId: string) {
  const session = sessionStore.get(sessionId);
  if (!session) {
    return null;
  }

  return {
    session_id: session.session_id,
    current_score: session.current_score,
    authorized_tokens: getEligibleTokens(session),
    voted_tokens: session.voted_tokens,
    started_at: session.started_at,
    duration_seconds: SESSION_DURATION_SEC,
  };
}

export function registerRoutes(app: Express, io: Server): void {
  /**
   * Health check — out of rate limit (frequent poll from frontend).
   */
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  /**
   * Server Info
   */
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      service: "Digital Assembly Voting Server",
      status: "online",
      version: "1.0.0",
      websocket: true,
      defaultSession: DEFAULT_SESSION_ID,
      environment: NODE_ENV,
    });
  });

  app.get("/sessions/:sessionId", (req: Request, res: Response) => {
    try {
      const session = sessionStore.get(paramAsString(req.params.sessionId));

      if (!session) {
        res.status(404).json({ error: "Session not found." });
        return;
      }

      res.json({
        session_id: session.session_id,
        current_score: session.current_score,
        total_authorized: session.authorized_tokens.length,
        total_voted: session.voted_tokens.length,
        votes_cast: session.votes_cast,
        started_at: session.started_at,
        duration_seconds: SESSION_DURATION_SEC,
      });
    } catch (error) {
      res.status(500).json({ error: "Error fetching session" });
    }
  });

  app.post("/api/sessions", (req: Request, res: Response) => {
    try {
      const validatedData = CreateSessionSchema.parse(req.body);

      if (sessionStore.get(validatedData.session_id)) {
        res.status(409).json({ error: "Session already exists." });
        return;
      }

      const session = sessionStore.createFromPayload({
        session_id: validatedData.session_id,
        authorized_tokens: validatedData.authorized_tokens,
        options: validatedData.options,
      });

      logSessionCreated(session.session_id, session.authorized_tokens.length);

      res.status(201).json({
        session_id: session.session_id,
        status: "OPEN",
        message: "Session created successfully",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Invalid data",
          details: error.issues,
        });
        return;
      }

      res.status(500).json({ error: "Error creating session" });
    }
  });

  app.post("/api/sessions/:sessionId/tokens/generate", (req: Request, res: Response) => {
    try {
      const sessionId = paramAsString(req.params.sessionId);
      const session = sessionStore.get(sessionId);

      if (!session) {
        res.status(404).json({ error: "Session not found." });
        return;
      }

      const newToken = tokenService.generateSecureToken();
      sessionStore.addAuthorizedToken(sessionId, newToken);
      logTokenGenerated(newToken, sessionId);

      res.json({ token: newToken, session_id: sessionId });
    } catch (error) {
      res.status(500).json({ error: "Error generating token" });
    }
  });

  app.post("/api/sessions/:sessionId/votes", async (req: Request, res: Response) => {
    try {
      const sessionId = paramAsString(req.params.sessionId);
      const session = sessionStore.get(sessionId);

      if (!session) {
        res.status(404).json({ error: "Session not found." });
        return;
      }

      const { token, option } = req.body;
      const payload = buildVotePayload(token, option);
      const context = {
        session_id: sessionId,
        ip: req.ip ?? req.socket.remoteAddress ?? "unknown",
      };
      const result = await withSessionLock(sessionId, () => processVote(session, payload, context));

      if (!result.success) {
        if (result.error.code === "FORMATO_INVALIDO") {
          logInvalidFormat(payload, context);
        } else if (result.error.code === "TOKEN_NAO_AUTORIZADO") {
          const tokenStr = payload.split("|")[1] ?? "unknown";
          logUnauthorizedVote(tokenStr, context, payload);
        } else if (result.error.code === "VOTO_DUPLICADO" && result.duplicate) {
          logDuplicateVote(result.duplicate, context, payload);
        }

        res.status(400).json({ error: result.error });
        return;
      }

      const channel = scoreChannel(session.session_id);
      io.to(session.session_id).emit(channel, result.score);

      logVoteAccepted(result, context);
      logVoteSummary(session);

      res.json({
        success: true,
        token: result.vote.token,
        session_id: result.vote.session_id,
        current_score: result.score,
      });
    } catch (error) {
      res.status(500).json({ error: "Error registering vote" });
    }
  });

  app.post("/api/sessions/:sessionId/tokens", (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token || typeof token !== "string") {
        res.status(400).json({ error: "Invalid token" });
        return;
      }

      const session = sessionStore.addAuthorizedToken(paramAsString(req.params.sessionId), token);
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      res.json({
        message: "Token added successfully",
        session_id: session.session_id,
        total_tokens: session.authorized_tokens.length,
      });
    } catch (error) {
      res.status(500).json({ error: "Error adding token" });
    }
  });

  app.get("/api/statistics", (_req: Request, res: Response) => {
    try {
      const stats = sessionStore.getGlobalStatistics();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error obtaining statistics" });
    }
  });

  /** Management commands — same data as console, straight from sessionStore. */
  app.get("/api/tokens", (req: Request, res: Response) => {
    const snapshot = getSessionSnapshot(resolveSessionIdFromQuery(req));
    if (!snapshot) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json({ authorized_tokens: snapshot.authorized_tokens });
  });

  app.get("/api/votes", (req: Request, res: Response) => {
    const session = sessionStore.get(resolveSessionIdFromQuery(req));
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json({ votes: session.votes_cast });
  });

  app.get("/api/score", (req: Request, res: Response) => {
    const session = sessionStore.get(resolveSessionIdFromQuery(req));
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json(session.current_score);
  });

  app.get("/api/session", (req: Request, res: Response) => {
    const snapshot = getSessionSnapshot(resolveSessionIdFromQuery(req));
    if (!snapshot) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json(snapshot);
  });

  app.post("/api/sessions/:sessionId/reset", async (req: Request, res: Response) => {
    try {
      const sessionId = paramAsString(req.params.sessionId);

      const session = await withSessionLock(sessionId, async () => {
        const reset = sessionStore.reset(sessionId);
        return reset;
      });

      if (!session) {
        res.status(404).json({ error: "Session not found." });
        return;
      }

      const channel = scoreChannel(session.session_id);
      io.to(session.session_id).emit(channel, session.current_score);
      io.to(session.session_id).emit(SOCKET_EVENTS.SESSION_RESET, {
        session_id: session.session_id,
        started_at: session.started_at,
        duration_seconds: SESSION_DURATION_SEC,
        current_score: session.current_score,
      });

      logger.info("SESSION", "Session reset via API", {
        session_id: session.session_id,
      });

      res.json({
        success: true,
        session_id: session.session_id,
        current_score: session.current_score,
        started_at: session.started_at,
        duration_seconds: SESSION_DURATION_SEC,
      });
    } catch (error) {
      res.status(500).json({ error: "Error restarting session" });
    }
  });
}
