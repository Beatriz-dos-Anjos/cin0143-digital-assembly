import { randomUUID } from "crypto";
import * as readline from "readline";

import { io } from "socket.io-client";

type ConnectionAck = {
  message: string;
  sessao_id: string;
  placar_atual: {
    sim: number;
    nao: number;
  };
};

type ClientRegistered = {
  token: string;
  sessao_id: string;
};

type SessionData = {
  sessao_id: string;
  placar_atual: {
    sim: number;
    nao: number;
  };
  tokens_autorizados: string[];
  tokens_que_ja_votaram: string[];
};

const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3001";
const GENERATED_TOKEN = `TK_CLIENT_${randomUUID().slice(0, 8).toUpperCase()}`;

const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
});

let currentToken = GENERATED_TOKEN;
let currentSessionId = "assembleia-2026-01";
let rl: readline.Interface | null = null;
let scoreListenerAttached = false;

function printHelp(): void {
  console.log("Comandos:");
  console.log("  token               - mostra o token gerado para este cliente");
  console.log("  vote A              - envia voto para sim");
  console.log("  vote B              - envia voto para não");
  console.log("  session             - solicita ao servidor o snapshot da sessão");
  console.log("  status              - mostra sessão e token atuais");
  console.log("  help                - exibe esta ajuda");
  console.log("  exit                - encerra o cliente");
}

function ensurePrompt(): void {
  if (rl) {
    rl.setPrompt("cliente> ");
    rl.prompt();
  }
}

function attachScoreListener(sessionId: string): void {
  if (scoreListenerAttached) {
    return;
  }

  scoreListenerAttached = true;
  socket.on(`placar_atualizado_${sessionId}`, (placar) => {
    console.log("Placar atualizado:", placar);
  });
}

function startInteractivePrompt(): void {
  if (rl) {
    return;
  }

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "cliente> ",
  });

  rl.on("line", (line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      ensurePrompt();
      return;
    }

    const [command, rawArg] = trimmed.split(/\s+/, 2);
    const normalized = command.toLowerCase();

    if (normalized === "help") {
      printHelp();
    } else if (normalized === "token") {
      console.log(`Token atual: ${currentToken}`);
    } else if (normalized === "status") {
      console.log(`Sessão: ${currentSessionId}`);
      console.log(`Token: ${currentToken}`);
      console.log(`Servidor: ${SERVER_URL}`);
    } else if (normalized === "session") {
      socket.emit("session_request");
      console.log("Solicitando snapshot da sessão ao servidor...");
    } else if (normalized === "vote") {
      const option = rawArg?.toUpperCase();
      const voteOption = option === "A" ? "sim" : option === "B" ? "nao" : undefined;

      if (!voteOption) {
        console.log("Uso: vote A | vote B");
        ensurePrompt();
        return;
      }

      socket.emit("cast_vote", `CAST_VOTE|${currentToken}|${voteOption}`);
      console.log(`Voto enviado: ${voteOption}`);
    } else if (normalized === "exit" || normalized === "quit") {
      socket.disconnect();
      rl?.close();
      return;
    } else {
      console.log(`Comando desconhecido: ${command}`);
      printHelp();
    }

    ensurePrompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });

  printHelp();
  ensurePrompt();
}

socket.on("connect", () => {
  console.log(`Conectado ao servidor: ${SERVER_URL}`);
});

socket.on("connection_ack", (data: ConnectionAck) => {
  currentSessionId = data.sessao_id;
  console.log(`Sessão: ${data.sessao_id}`);
  console.log(`Placar inicial: SIM=${data.placar_atual.sim} NAO=${data.placar_atual.nao}`);
  attachScoreListener(data.sessao_id);
  socket.emit("client_register", { token: currentToken });
});

socket.on("client_registered", (data: ClientRegistered) => {
  currentToken = data.token;
  currentSessionId = data.sessao_id;

  console.log("Cliente autorizado no servidor.");
  console.log(`Token atribuído: ${currentToken}`);
  console.log(`Sessão: ${currentSessionId}`);

  startInteractivePrompt();
});

socket.on("session_data", (data: SessionData) => {
  console.log(`\n─── Snapshot da Sessão ${data.sessao_id} ───`);
  console.log(`Placar Atual: SIM=${data.placar_atual.sim} | NÃO=${data.placar_atual.nao}`);
  console.log(`Tokens ainda aptos a votar:`, data.tokens_autorizados);
  console.log(`Tokens que já votaram:`, data.tokens_que_ja_votaram);
  console.log(`───────────────────────────────────`);
  ensurePrompt();
});

socket.on("vote_error", (error) => {
  console.log("Erro de votação:", error);
});

socket.on("disconnect", () => {
  if (rl) {
    rl.close();
  }
});

socket.on("connect_error", (error) => {
  console.error("Falha ao conectar:", error.message);
  process.exit(1);
});