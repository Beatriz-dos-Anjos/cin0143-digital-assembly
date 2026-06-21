import { randomBytes } from "crypto";
import * as readline from "readline";

import { io } from "socket.io-client";

import {
  placarChannel,
  SECURITY_CONFIG,
  SOCKET_EVENTS,
  VoteOption,
  PlacarAtual,
} from "./apps/server/src/domain/types";

type ConnectionAck = {
  message: string;
  sessao_id: string;
  placar_atual: PlacarAtual;
};

type ClientRegistered = {
  token: string;
  sessao_id: string;
};

const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3001";

function generateToken(): string {
  return randomBytes(SECURITY_CONFIG.TOKEN_LENGTH).toString("hex");
}

function isVoteOption(value: string): value is VoteOption {
  return value === "sim" || value === "nao";
}

function formatPlacar(placar: PlacarAtual): string {
  return `SIM=${placar.sim} | NAO=${placar.nao}`;
}

const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
});

const generatedToken = generateToken();

let rl: readline.Interface | null = null;
let sessionId = "";
let currentPlacar: PlacarAtual = { sim: 0, nao: 0 };
let registered = false;
let scoreChannel: string | null = null;
let hasVoted = false;

function printHeader(): void {
  console.clear();
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Cliente de Votação Digital                               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`Servidor: ${SERVER_URL}`);
  console.log(`Token atribuído: ${generatedToken}`);
  if (sessionId) {
    console.log(`Sessão: ${sessionId}`);
  }
  console.log(`Placar atual: ${formatPlacar(currentPlacar)}`);
  console.log("Comandos: vote sim | vote nao | exit");
}

function ensurePrompt(): void {
  if (rl) {
    rl.prompt();
  }
}

function sendVote(voteValue: VoteOption): void {
  if (!registered) {
    console.log("Cliente ainda não autenticado no servidor.");
    ensurePrompt();
    return;
  }

  if (hasVoted) {
    console.log("Este token já votou nesta sessão. Reinicie o cliente para gerar outro token.");
    ensurePrompt();
    return;
  }

  socket.emit(SOCKET_EVENTS.CAST_VOTE, `CAST_VOTE|${generatedToken}|${voteValue}`);
  console.log(`Voto enviado: ${voteValue.toUpperCase()}`);
}

function attachScoreListener(nextSessionId: string): void {
  const nextChannel = placarChannel(nextSessionId);

  if (scoreChannel === nextChannel) {
    return;
  }

  if (scoreChannel) {
    socket.off(scoreChannel);
  }

  scoreChannel = nextChannel;
  socket.on(nextChannel, (placar: PlacarAtual) => {
    currentPlacar = placar;
    printHeader();
    console.log(`Placar atualizado em tempo real: ${formatPlacar(placar)}`);
    ensurePrompt();
  });
}

function startPrompt(): void {
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

    if (normalized === "vote") {
      const voteValue = rawArg?.toLowerCase();

      if (!voteValue || !isVoteOption(voteValue)) {
        console.log("Uso: vote sim | vote nao");
        ensurePrompt();
        return;
      }

      sendVote(voteValue);
    } else if (isVoteOption(normalized)) {
      sendVote(normalized);
    } else if (normalized === "exit" || normalized === "quit") {
      console.log("Saindo da sessão...");
      socket.disconnect();
      rl?.close();
      return;
    } else {
      console.log("Comandos disponíveis: vote sim | vote nao | exit");
    }

    ensurePrompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });

  ensurePrompt();
}

socket.on("connect", () => {
  console.log(`Conectado ao servidor em ${SERVER_URL}`);
});

socket.on("connection_ack", (data: ConnectionAck) => {
  sessionId = data.sessao_id;
  currentPlacar = data.placar_atual;
  attachScoreListener(sessionId);

  socket.emit(SOCKET_EVENTS.CLIENT_REGISTER, { token: generatedToken });
});

socket.on("client_registered", (data: ClientRegistered) => {
  sessionId = data.sessao_id;
  registered = true;

  printHeader();
  console.log("Cliente autenticado para votação.");
  startPrompt();
});

socket.on(SOCKET_EVENTS.VOTE_ACCEPTED, () => {
  hasVoted = true;
});

socket.on(SOCKET_EVENTS.VOTE_ERROR, (error: { code: string; message: string }) => {
  console.log(`Voto rejeitado: ${error.message} (${error.code})`);
  ensurePrompt();
});

socket.on("disconnect", () => {
  registered = false;
});

socket.on("connect_error", (error) => {
  console.error(`Falha ao conectar ao servidor: ${error.message}`);
  process.exit(1);
});

process.on("SIGINT", () => {
  socket.disconnect();
  process.exit(0);
});