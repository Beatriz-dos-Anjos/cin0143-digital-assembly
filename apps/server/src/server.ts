import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";

import { logger } from "./loggers/logger";
import { sessionStore } from "./repository/session-store";
import { registerRoutes } from "./routes/session-routes";
import { registerSocketHandlers } from "./sockets/session-socket";

const PORT = 3001;
const NODE_ENV = "development";
const ALLOWED_ORIGINS = "http://localhost:3000";
const DEFAULT_SESSION_ID = "assembleia-2026-06";

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

// Registrar as rotas HTTP e Handlers do Socket.io
registerRoutes(app, io);
registerSocketHandlers(io);

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