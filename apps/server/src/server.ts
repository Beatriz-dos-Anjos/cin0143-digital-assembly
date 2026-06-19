import cors from "cors";
import express from "express";
import { randomUUID } from "crypto";
import { createServer } from "http";
import { Server } from "socket.io";

import { placarChannel, SOCKET_EVENTS } from "./domain/types";
import { processVote } from "./domain/vote-validator";
import {
  buildVoteContext,
  logConnection,
  logDisconnection,
  logDuplicateVote,
  logInvalidFormat,
  logUnauthorizedVote,
  logVoteAccepted,
  logVoteSummary,
} from "./handlers/vote-handler";
import { logger } from "./loggers/logger";
import { sessionStore } from "./repository/session-store";

const PORT = Number(process.env.PORT) || 3001;
const DEFAULT_SESSAO_ID = "assembleia-2026-01";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN ?? "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    service: "Digital Assembly Voting Server",
    status: "online",
    version: "0.2.0",
    websocket: true,
    defaultSession: DEFAULT_SESSAO_ID,
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/sessions/:sessaoId", (req, res) => {
  const sessao = sessionStore.get(req.params.sessaoId);

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
});

function createClientToken(): string {
  return `TK_CLIENT_${randomUUID().slice(0, 8).toUpperCase()}`;
}

function getTokensAindaAptos(sessao: {
  tokens_autorizados: string[];
  tokens_que_ja_votaram: string[];
}): string[] {
  return sessao.tokens_autorizados.filter(
    (token) => !sessao.tokens_que_ja_votaram.includes(token)
  );
}

app.post("/api/sessions", (req, res) => {
  const { session_id, tokens_autorizados } = req.body ?? {};

  if (!session_id || !Array.isArray(tokens_autorizados)) {
    res.status(400).json({
      error: "Campos obrigatórios: session_id, tokens_autorizados[]",
    });
    return;
  }

  if (sessionStore.get(session_id)) {
    res.status(409).json({ error: "Sessão já existe." });
    return;
  }

  const sessao = sessionStore.createFromPayload({
    session_id,
    tokens_autorizados,
    opcoes: req.body.opcoes,
  });

  logger.success("SESSION", "Sessão de votação criada", {
    sessao_id: sessao.sessao_id,
    total_tokens: sessao.tokens_autorizados.length,
  });

  res.status(201).json({
    session_id: sessao.sessao_id,
    status: "OPEN",
  });
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
    const requestedToken =
      typeof payload === "string"
        ? payload
        : payload && typeof payload === "object" && "token" in payload
          ? String((payload as { token?: unknown }).token ?? "")
          : "";

    const token = requestedToken.trim() || createClientToken();
    const updatedSession = sessionStore.addAuthorizedToken(sessao.sessao_id, token);

    if (!updatedSession) {
      socket.emit(SOCKET_EVENTS.VOTE_ERROR, {
        code: "SESSAO_NAO_ENCONTRADA",
        message: "Sessão padrão não encontrada para registrar o cliente.",
      });
      return;
    }

    logger.success("WEBSOCKET", "Cliente autenticado para votação", {
      token,
      sessao_id: updatedSession.sessao_id,
      socket_id: socket.id,
      total_tokens: updatedSession.tokens_autorizados.length,
    });

    socket.emit(SOCKET_EVENTS.CLIENT_REGISTERED, {
      token,
      sessao_id: updatedSession.sessao_id,
    });
  });

  socket.on(SOCKET_EVENTS.SESSION_REQUEST, () => {
    const currentSession = sessionStore.getDefault();
    const tokensAutorizadosAVotar = getTokensAindaAptos(currentSession);

    logger.info("WEBSOCKET", "Snapshot de sessão solicitado", {
      sessao_id: currentSession.sessao_id,
      socket_id: socket.id,
      placar_atual: `A=${currentSession.placar_atual.sim} | B=${currentSession.placar_atual.nao}`,
      tokens_autorizados: tokensAutorizadosAVotar,
      tokens_que_ja_votaram: currentSession.tokens_que_ja_votaram,
    });

    socket.emit(SOCKET_EVENTS.SESSION_DATA, {
      sessao_id: currentSession.sessao_id,
      placar_atual: currentSession.placar_atual,
      tokens_autorizados: getTokensAindaAptos(currentSession),
      tokens_que_ja_votaram: currentSession.tokens_que_ja_votaram,
    });
  });

  socket.on(SOCKET_EVENTS.CAST_VOTE, (payload: unknown) => {
    const payloadStr = typeof payload === "string" ? payload : String(payload);
    const context = buildVoteContext(sessao, socket);
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

    logVoteAccepted(result, payloadStr);
    logVoteSummary(sessao);
  });

  socket.on("disconnect", () => {
    logDisconnection(socket.id);
  });
});

httpServer.listen(PORT, () => {
  const defaultSession = sessionStore.getDefault();
  logger.info("SERVER", "Servidor iniciado", {
    url: `http://localhost:${PORT}`,
    websocket: `ws://localhost:${PORT}`,
  });
  logger.info("SERVER", "Tokens autorizados gerados automaticamente:", {
    tokens: defaultSession.tokens_autorizados.join(", "),
  });
  logger.info("SERVER", "Sistema aguardando conexões...", {
    sessao_padrao: DEFAULT_SESSAO_ID,
  });
});
