import cors from "cors";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import { z } from "zod";

import { scoreChannel, SOCKET_EVENTS, SESSION_DURATION_SEC, CAST_VOTE_PREFIX } from "../src/domain/types";
import withSessionLock from "../src/domain/lock.service";
import { processVote, getTokenStatus, getEligibleTokens } from "../src/domain/vote-validator";
import {
  buildVoteContext,
  logConnection,
  logDisconnection,
  logDuplicateVote,
  logInvalidFormat,
  logUnauthorizedVote,
  logVoteAccepted,
  logVoteSummary,
  logClientAuthenticated,
  logTokenGenerated,
  logSessionCreated,
} from "../src/handlers/vote-handler";
import { logger } from "../../server/src/loggers/logger";
import { sessionStore } from "../src/repository/session-store";
import { tokenService } from "../src/token/token-service";


const PORT = 3001;
const NODE_ENV = "development";
const ALLOWED_ORIGINS = "http://localhost:3000";
const DEFAULT_SESSION_ID = "assembleia-2026-06";


const socketTokens = new Map<string, string>();

const CreateSessionSchema = z.object({
  session_id: z.string().min(3).max(50),
  authorized_tokens: z.array(z.string()).min(1),
  options: z.array(z.string()).optional(),
});


const ClientRegisterSchema = z.object({
  token: z.string().optional(),
});

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});


app.use(express.json({ limit: "1mb" }));

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  })
);

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

const isProduction = process.env.NODE_ENV === "production";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10_000,
  message: {
    error: {
      code: "RATE_LIMIT",
      message: "Too many requests from this IP, please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
});

app.use(limiter);


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

function paramAsString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildVotePayload(token: unknown, option: unknown): string {
  const tokenStr = typeof token === "string" ? token.trim() : String(token ?? "");
  const optionStr =
    typeof option === "string" ? option.trim().toLowerCase() : String(option ?? "");
  return `${CAST_VOTE_PREFIX}|${tokenStr}|${optionStr}`;
}

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

io.on("connection", (socket) => {
  const session = sessionStore.getDefault();

  socket.join(session.session_id);
  logConnection(socket.id, session.session_id);

  socket.emit(SOCKET_EVENTS.CONNECTION_ACK, {
    message: "Connected to the voting server.",
    session_id: session.session_id,
    current_score: session.current_score,
    started_at: session.started_at,
    duration_seconds: SESSION_DURATION_SEC,
  });

  socket.on(SOCKET_EVENTS.CLIENT_REGISTER, (payload: unknown) => {
    try {
      const validated = ClientRegisterSchema.parse(
        typeof payload === "object" ? payload : {}
      );

      const requestedToken = validated.token?.trim() || tokenService.generateSecureToken();
      const updatedSession = sessionStore.addAuthorizedToken(session.session_id, requestedToken);

      if (!updatedSession) {
        socket.emit(SOCKET_EVENTS.VOTE_ERROR, {
          code: "SESSION_NOT_FOUND",
          message: "Default session not found",
        });
        return;
      }
      socketTokens.set(socket.id, requestedToken);

      logClientAuthenticated(
        requestedToken,
        updatedSession.session_id,
        socket.id,
        updatedSession.authorized_tokens.length
      );

      socket.emit(SOCKET_EVENTS.CLIENT_REGISTERED, {
        token: requestedToken,
        session_id: updatedSession.session_id,
      });
    } catch (error) {
      socket.emit(SOCKET_EVENTS.VOTE_ERROR, {
        code: "INVALID_FORMAT",
        message: "Error registering client",
      });
    }
  });

  socket.on(SOCKET_EVENTS.SESSION_REQUEST, () => {
    const currentSession = sessionStore.getDefault();
    const eligibleTokens = getEligibleTokens(currentSession);

    logger.info("WEBSOCKET", "Session snapshot requested", {
      session_id: currentSession.session_id,
      socket_id: socket.id,
      eligible_tokens: eligibleTokens.length,
    });

    socket.emit(SOCKET_EVENTS.SESSION_DATA, {
      session_id: currentSession.session_id,
      current_score: currentSession.current_score,
      authorized_tokens: eligibleTokens,
      voted_tokens: currentSession.voted_tokens,
      started_at: currentSession.started_at,
      duration_seconds: SESSION_DURATION_SEC,
    });
  });

  socket.on(SOCKET_EVENTS.CAST_VOTE, async (payload: unknown) => {
    const payloadStr = typeof payload === "string" ? payload : String(payload);
    const context = buildVoteContext(session, socket, socketTokens.get(socket.id));
    const result = await withSessionLock(session.session_id, () =>
      processVote(session, payloadStr, context)
    );

    if (!result.success) {
      if (result.error.code === "FORMATO_INVALIDO") {
        logInvalidFormat(payloadStr, context);
      } else if (result.error.code === "TOKEN_NAO_AUTORIZADO") {
        const token = payloadStr.split("|")[1] ?? "unknown";
        logUnauthorizedVote(token, context, payloadStr);
      } else if (result.error.code === "VOTO_DUPLICADO" && result.duplicate) {
        logDuplicateVote(result.duplicate, context, payloadStr);
      }

      socket.emit(SOCKET_EVENTS.VOTE_ERROR, result.error);
      return;
    }

    const channel = scoreChannel(session.session_id);
    io.to(session.session_id).emit(channel, result.score);

    socket.emit(SOCKET_EVENTS.VOTE_ACCEPTED, {
      token: result.vote.token,
      session_id: result.vote.session_id,
    });

    logVoteAccepted(result, context);
    logVoteSummary(session);
  });

  socket.on("token_status_request", (token: unknown) => {
    const tokenStr = typeof token === "string" ? token : String(token);
    const status = getTokenStatus(session, tokenStr);
    socket.emit("token_status_response", status);
  });

  socket.on("generate_token_request", () => {
    const newToken = tokenService.generateSecureToken();
    sessionStore.addAuthorizedToken(session.session_id, newToken);

    logTokenGenerated(newToken, session.session_id);

    socket.emit("generate_token_response", { token: newToken });
  });

  socket.on("list_votes_request", () => {
    socket.emit("list_votes_response", {
      votes: session.votes_cast,
    });
  });

  socket.on("disconnect", () => {
    socketTokens.delete(socket.id); 
    logDisconnection(socket.id);
  });
});


httpServer.listen(PORT, () => {
  logger.success("SERVER", "Server started successfully", {
    port: PORT,
    url: `http://localhost:${PORT}`,
    websocket: `ws://localhost:${PORT}`,
    environment: NODE_ENV,
  });

  logger.info("SERVER", "System waiting for connections...", {
    default_session: DEFAULT_SESSION_ID,
    allowed_origins: ALLOWED_ORIGINS.length,
  });

  logger.info("SERVER", "Default session loaded", {
    session_id: sessionStore.getDefault().session_id,
    total_tokens: sessionStore.getDefault().authorized_tokens.length,
  });
});


process.on("SIGTERM", () => {
  logger.alert("SERVER", "SIGTERM received, shutting down gracefully...");
  httpServer.close(() => {
    logger.info("SERVER", "Server stopped");
    process.exit(0);
  });
});

export { httpServer, io };