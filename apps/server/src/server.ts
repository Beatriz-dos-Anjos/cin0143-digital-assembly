
import cors from "cors";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import { z } from "zod";

import { placarChannel, SOCKET_EVENTS } from "../src/domain/types";
import { formatCastVote } from "../src/domain/vote-parser";
import { processVote, getTokenStatus, getTokensAindaAptos } from "../src/domain/vote-validator";
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


const PORT =  3001;
const NODE_ENV = "development";
const ALLOWED_ORIGINS =  "http://localhost:3000";
const DEFAULT_SESSAO_ID =  "assembleia-2026-06";


const socketTokens = new Map<string, string>();

const CreateSessionSchema = z.object({
  session_id: z.string().min(3).max(50),
  tokens_autorizados: z.array(z.string()).min(1),
  opcoes: z.array(z.string()).optional(),
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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Máximo 100 requisições por window
  message: "Muitas requisições deste IP, por favor tente mais tarde.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);


/**
 * Health check
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Info do servidor
 */
app.get("/", (_req: Request, res: Response) => {
  res.json({
    service: "Digital Assembly Voting Server",
    status: "online",
    version: "1.0.0",
    websocket: true,
    defaultSession: DEFAULT_SESSAO_ID,
    environment: NODE_ENV,
  });
});
function paramAsString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

app.get("/sessions/:sessaoId", (req: Request, res: Response) => {
  try {
const sessao = sessionStore.get(paramAsString(req.params.sessaoId));

    if (!sessao) {
      res.status(404).json({ error: "Sessão não encontrada." });
      return;
    }

    res.json({
      sessao_id: sessao.sessao_id,
      placar_atual: sessao.placar_atual,
      total_autorizados: sessao.tokens_autorizados.length,
      total_votaram: sessao.tokens_que_ja_votaram.length,
      votos_realizados: sessao.votos_realizados,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar sessão" });
  }
});


app.post("/api/sessions", (req: Request, res: Response) => {
  try {
    const validatedData = CreateSessionSchema.parse(req.body);

    if (sessionStore.get(validatedData.session_id)) {
      res.status(409).json({ error: "Sessão já existe." });
      return;
    }

    const sessao = sessionStore.createFromPayload({
      session_id: validatedData.session_id,
      tokens_autorizados: validatedData.tokens_autorizados,
      opcoes: validatedData.opcoes,
    });

    logSessionCreated(sessao.sessao_id, sessao.tokens_autorizados.length);

    res.status(201).json({
      session_id: sessao.sessao_id,
      status: "OPEN",
      message: "Sessão criada com sucesso",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Dados inválidos",
        details: error.issues,
      });
      return;
    }

    res.status(500).json({ error: "Erro ao criar sessão" });
  }
});


app.post("/api/sessions/:sessaoId/tokens/generate", (req: Request, res: Response) => {
  try {
    const sessaoId = paramAsString(req.params.sessaoId);
    const sessao = sessionStore.get(sessaoId);

    if (!sessao) {
      res.status(404).json({ error: "Sessão não encontrada." });
      return;
    }

    const newToken = tokenService.generateSecureToken();
    sessionStore.addAuthorizedToken(sessaoId, newToken);
    logTokenGenerated(newToken, sessaoId);

    res.json({ token: newToken, sessao_id: sessaoId });
  } catch (error) {
    res.status(500).json({ error: "Erro ao gerar token" });
  }
});

app.post("/api/sessions/:sessaoId/votes", (req: Request, res: Response) => {
  try {
    const sessaoId = paramAsString(req.params.sessaoId);
    const sessao = sessionStore.get(sessaoId);

    if (!sessao) {
      res.status(404).json({ error: "Sessão não encontrada." });
      return;
    }

    const { token, opcao } = req.body;
    const payload = formatCastVote(token, opcao);
    const context = {
      sessao_id: sessaoId,
      ip: req.ip ?? req.socket.remoteAddress ?? "desconhecido",
    };
    const result = processVote(sessao, payload, context);

    if (!result.success) {
      if (result.error.code === "FORMATO_INVALIDO") {
        logInvalidFormat(payload, context);
      } else if (result.error.code === "TOKEN_NAO_AUTORIZADO") {
        const tokenStr = payload.split("|")[1] ?? "desconhecido";
        logUnauthorizedVote(tokenStr, context, payload);
      } else if (result.error.code === "VOTO_DUPLICADO" && result.duplicate) {
        logDuplicateVote(result.duplicate, context, payload);
      }

      res.status(400).json({ error: result.error });
      return;
    }

    const channel = placarChannel(sessao.sessao_id);
    io.to(sessao.sessao_id).emit(channel, result.placar);

    logVoteAccepted(result, context);
    logVoteSummary(sessao);

    res.json({
      success: true,
      token: result.voto.token,
      sessao_id: result.voto.sessao_id,
      placar_atual: result.placar,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao registrar voto" });
  }
});

app.post("/api/sessions/:sessaoId/tokens", (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "Token inválido" });
      return;
    }

const sessao = sessionStore.addAuthorizedToken(paramAsString(req.params.sessaoId), token);
    if (!sessao) {
      res.status(404).json({ error: "Sessão não encontrada" });
      return;
    }

    res.json({
      message: "Token adicionado com sucesso",
      sessao_id: sessao.sessao_id,
      total_tokens: sessao.tokens_autorizados.length,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao adicionar token" });
  }
});


app.get("/api/statistics", (_req: Request, res: Response) => {
  try {
    const stats = sessionStore.getGlobalStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Erro ao obter estatísticas" });
  }
});


io.on("connection", (socket) => {
  const sessao = sessionStore.getDefault();

  socket.join(sessao.sessao_id);
  logConnection(socket.id, sessao.sessao_id);

  socket.emit(SOCKET_EVENTS.CONNECTION_ACK, {
    message: "Conectado ao servidor de votação.",
    sessao_id: sessao.sessao_id,
    placar_atual: sessao.placar_atual,
  });

  socket.on(SOCKET_EVENTS.CLIENT_REGISTER, (payload: unknown) => {
    try {
      const validated = ClientRegisterSchema.parse(
        typeof payload === "object" ? payload : {}
      );

      const requestedToken = validated.token?.trim() || tokenService.generateSecureToken();
      const updatedSession = sessionStore.addAuthorizedToken(sessao.sessao_id, requestedToken);

      if (!updatedSession) {
        socket.emit(SOCKET_EVENTS.VOTE_ERROR, {
          code: "SESSAO_NAO_ENCONTRADA",
          message: "Sessão padrão não encontrada",
        });
        return;
      }
      socketTokens.set(socket.id, requestedToken);

      logClientAuthenticated(
        requestedToken,
        updatedSession.sessao_id,
        socket.id,
        updatedSession.tokens_autorizados.length
      );

      socket.emit(SOCKET_EVENTS.CLIENT_REGISTERED, {
        token: requestedToken,
        sessao_id: updatedSession.sessao_id,
      });
    } catch (error) {
      socket.emit(SOCKET_EVENTS.VOTE_ERROR, {
        code: "FORMATO_INVALIDO",
        message: "Erro ao registrar cliente",
      });
    }
  });

  socket.on(SOCKET_EVENTS.SESSION_REQUEST, () => {
    const currentSession = sessionStore.getDefault();
    const tokensAutorizadosAVotar = getTokensAindaAptos(currentSession);

    logger.info("WEBSOCKET", "Snapshot de sessão solicitado", {
      sessao_id: currentSession.sessao_id,
      socket_id: socket.id,
      tokens_aptos: tokensAutorizadosAVotar.length,
    });

    socket.emit(SOCKET_EVENTS.SESSION_DATA, {
      sessao_id: currentSession.sessao_id,
      placar_atual: currentSession.placar_atual,
      tokens_autorizados: tokensAutorizadosAVotar,
      tokens_que_ja_votaram: currentSession.tokens_que_ja_votaram,
    });
  });

  socket.on(SOCKET_EVENTS.CAST_VOTE, (payload: unknown) => {
    const payloadStr = typeof payload === "string" ? payload : String(payload);
    const context = buildVoteContext(sessao, socket, socketTokens.get(socket.id));
    const result = processVote(sessao, payloadStr, context);

    if (!result.success) {
      if (result.error.code === "FORMATO_INVALIDO") {
        logInvalidFormat(payloadStr, context);
      } else if (result.error.code === "TOKEN_NAO_AUTORIZADO") {
        const token = payloadStr.split("|")[1] ?? "desconhecido";
        logUnauthorizedVote(token, context, payloadStr);
      } else if (result.error.code === "VOTO_DUPLICADO" && result.duplicate) {
        logDuplicateVote(result.duplicate, context, payloadStr);
      }

      socket.emit(SOCKET_EVENTS.VOTE_ERROR, result.error);
      return;
    }

    const channel = placarChannel(sessao.sessao_id);
    io.to(sessao.sessao_id).emit(channel, result.placar);

    socket.emit(SOCKET_EVENTS.VOTE_ACCEPTED, {
      token: result.voto.token,
      sessao_id: result.voto.sessao_id,
    });

    logVoteAccepted(result, context);
    logVoteSummary(sessao);
  });

  socket.on("token_status_request", (token: unknown) => {
    const tokenStr = typeof token === "string" ? token : String(token);
    const status = getTokenStatus(sessao, tokenStr);
    socket.emit("token_status_response", status);
  });

  socket.on("generate_token_request", () => {
    const newToken = tokenService.generateSecureToken();
    sessionStore.addAuthorizedToken(sessao.sessao_id, newToken);

    logTokenGenerated(newToken, sessao.sessao_id);

    socket.emit("generate_token_response", { token: newToken });
  });

  socket.on("list_votes_request", () => {
    socket.emit("list_votes_response", {
      votos: sessao.votos_realizados,
    });
  });

  socket.on("disconnect", () => {
    socketTokens.delete(socket.id); 
    logDisconnection(socket.id);
  });
});


httpServer.listen(PORT, () => {
  logger.success("SERVER", "Servidor iniciado com sucesso", {
    port: PORT,
    url: `http://localhost:${PORT}`,
    websocket: `ws://localhost:${PORT}`,
    environment: NODE_ENV,
  });

  logger.info("SERVER", "Sistema aguardando conexões...", {
    sessao_padrao: DEFAULT_SESSAO_ID,
    allowed_origins: ALLOWED_ORIGINS.length,
  });

  logger.info("SERVER", "Sessão padrão carregada", {
    sessao_id: sessionStore.getDefault().sessao_id,
    total_tokens: sessionStore.getDefault().tokens_autorizados.length,
  });
});


process.on("SIGTERM", () => {
  logger.alert("SERVER", "SIGTERM recebido, encerrando gracefully...");
  httpServer.close(() => {
    logger.info("SERVER", "Servidor encerrado");
    process.exit(0);
  });
});

export { httpServer, io };