import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import { placarChannel, SOCKET_EVENTS } from "./domain/types";
import { processVote } from "./domain/vote-validator";
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
    version: "0.1.0",
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
  });
});

io.on("connection", (socket) => {
  const sessao = sessionStore.getDefault();

  socket.join(sessao.sessao_id);

  socket.emit(SOCKET_EVENTS.CONNECTION_ACK, {
    message: "Conectado ao servidor de votação.",
    sessao_id: sessao.sessao_id,
    placar_atual: sessao.placar_atual,
  });

  console.log(`[socket] Cliente conectado: ${socket.id}`);

  socket.on(SOCKET_EVENTS.CAST_VOTE, (payload: unknown) => {
    const payloadStr = typeof payload === "string" ? payload : String(payload);
    const result = processVote(sessao, payloadStr);

    if (!result.success) {
      socket.emit(SOCKET_EVENTS.VOTE_ERROR, result.error);
      console.log(
        `[vote] Rejeitado (${socket.id}): ${result.error.code} — ${payloadStr}`
      );
      return;
    }

    const channel = placarChannel(sessao.sessao_id);
    io.to(sessao.sessao_id).emit(channel, result.placar);

    console.log(
      `[vote] Registrado (${socket.id}): ${payloadStr} → A=${result.placar.opcao_A} B=${result.placar.opcao_B}`
    );
  });

  socket.on("disconnect", () => {
    console.log(`[socket] Cliente desconectado: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`WebSocket (Socket.io) ativo na mesma porta`);
  console.log(`Sessão padrão: ${DEFAULT_SESSAO_ID}`);
});