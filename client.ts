import { randomUUID } from "crypto";
import * as readline from "readline";

import { io } from "socket.io-client";

type ConnectionAck = {
  message: string;
  session_id: string;
  current_score: {
    sim: number;
    nao: number;
  };
};

type ClientRegistered = {
  token: string;
  session_id: string;
};

type SessionData = {
  session_id: string;
  current_score: {
    sim: number;
    nao: number;
  };
  authorized_tokens: string[];
  voted_tokens: string[];
};

const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3001";
const GENERATED_TOKEN = `TK_CLIENT_${randomUUID().replace(/-/g, "").toUpperCase()}`;
const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
});

let currentToken = GENERATED_TOKEN;
let currentSessionId = "assembleia-2026-06";
let rl: readline.Interface | null = null;
let scoreListenerAttached = false;

function printHelp(): void {
  console.log("Commands:");
  console.log("  token               - shows the token generated for this client");
  console.log("  vote <token> sim    - sends a sim vote using the specified token");
  console.log("  vote <token> nao    - sends a nao vote using the specified token");
  console.log("  session             - requests the session snapshot from the server");
  console.log("  status              - shows current session and token");
  console.log("  help                - displays this help");
  console.log("  exit                - exits the client");
}

function ensurePrompt(): void {
  if (rl) {
    rl.setPrompt("client> ");
    rl.prompt();
  }
}

function attachScoreListener(sessionId: string): void {
  if (scoreListenerAttached) {
    return;
  }

  scoreListenerAttached = true;
  socket.on(`score_updated_${sessionId}`, (score) => {
    console.log("Score updated:", score);
  });
}

function startInteractivePrompt(): void {
  if (rl) {
    return;
  }

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "client> ",
  });

  rl.on("line", (line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      ensurePrompt();
      return;
    }

    const firstSpaceIndex = trimmed.indexOf(" ");
    const command = firstSpaceIndex === -1 ? trimmed : trimmed.slice(0, firstSpaceIndex);
    const rawArg = firstSpaceIndex === -1 ? undefined : trimmed.slice(firstSpaceIndex + 1).trim();
    const normalized = command.toLowerCase();

    if (normalized === "help") {
      printHelp();
    } else if (normalized === "token") {
      console.log(`Current token: ${currentToken}`);
    } else if (normalized === "status") {
      console.log(`Session: ${currentSessionId}`);
      console.log(`Token: ${currentToken}`);
      console.log(`Server: ${SERVER_URL}`);
    } else if (normalized === "session") {
      socket.emit("session_request");
      console.log("Requesting session snapshot from the server...");
    } else if (normalized === "vote") {
      const parts = rawArg?.trim().split(/\s+/) ?? [];

      if (parts.length < 2) {
        console.log("Usage: vote <token> <sim|nao>");
        ensurePrompt();
        return;
      }

      const [tokenArg, optionArg] = parts;
      const option = optionArg.toUpperCase();
      const voteOption = option === "sim" ? "sim" : option === "nao" ? "nao" : undefined;

      if (!voteOption) {
        console.log("Usage: vote <token> <sim|nao>");
        ensurePrompt();
        return;
      }

      socket.emit("cast_vote", `CAST_VOTE|${tokenArg}|${voteOption}`);
      console.log(`Vote sent: token=${tokenArg} | option=${voteOption}`);

    } else if (normalized === "exit" || normalized === "quit") {
      socket.disconnect();
      rl?.close();
      return;
    } else {
      console.log(`Unknown command: ${command}`);
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
  console.log(`Connected to server: ${SERVER_URL}`);
});

socket.on("connection_ack", (data: ConnectionAck) => {
  currentSessionId = data.session_id;
  console.log(`Session: ${data.session_id}`);
  console.log(`Initial score: sim=${data.current_score.sim} nao=${data.current_score.nao}`);
  attachScoreListener(data.session_id);
  socket.emit("client_register", { token: currentToken });
});

socket.on("client_registered", (data: ClientRegistered) => {
  currentToken = data.token;
  currentSessionId = data.session_id;

  console.log("Client authorized on server.");
  console.log(`Assigned token: ${currentToken}`);
  console.log(`Session: ${currentSessionId}`);

  startInteractivePrompt();
});

socket.on("session_data", (data: SessionData) => {
  console.log(`\n─── Session Snapshot ${data.session_id} ───`);
  console.log(`Current Score: sim=${data.current_score.sim} | nao=${data.current_score.nao}`);
  console.log(`Tokens still eligible to vote:`, data.authorized_tokens);
  console.log(`Tokens that have already voted:`, data.voted_tokens);
  console.log(`───────────────────────────────────`);
  ensurePrompt();
});

socket.on("vote_error", (error) => {
  console.log("Voting error:", error);
});

socket.on("disconnect", () => {
  if (rl) {
    rl.close();
  }
});

socket.on("connect_error", (error) => {
  console.error("Failed to connect:", error.message);
  process.exit(1);
});