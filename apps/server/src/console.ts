import * as readline from "readline";
import { io, Socket } from "socket.io-client";
import express from "express";
import cors from "cors";
import { PlacarAtual, VotoRegistrado } from "./domain/types";

const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3001";
let socket: Socket;
let rl: readline.Interface | null = null;
let currentSessionId = "assembleia-2026-06";
let placarAtual: PlacarAtual = { sim: 0, nao: 0 };

let pendingCommand: "AUTH" | "STATUS" | "LIST_TOKENS" | "SESSION" | "VOTE" | null = null;

const BANNER = `
╔════════════════════════════════════════════════════════════╗
║  Console de Autenticação - Sistema de Votação Digital     ║
╚════════════════════════════════════════════════════════════╝
`;

const HELP = `
Comandos disponíveis:
  LIST_TOKENS               - Listar todos os tokens válidos
  LIST_VOTES                - Listar votos registrados
  PLACAR                    - Exibir placar atual
  SESSION                    - Listar dados completos da sessão ativa
  CLEAR                     - Limpar console
  HELP                      - Exibir ajuda
  EXIT                      - Sair
`;

function clearConsole(): void {
  process.stdout.write("\x1Bc");
  process.stdout.write(BANNER);
  process.stdout.write(HELP);
}

function parseQuotedArgs(input: string): string[] {
  const args: string[] = [];
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    args.push(match[1] ?? match[2] ?? match[3] ?? "");
  }

  return args;
}

function promptUser(): void {
  if (rl) {
    rl.prompt();
  }
}

function handleCommand(line: string): void {
  const trimmed = line.trim();
  if (!trimmed) {
    promptUser();
    return;
  }

  const args = parseQuotedArgs(trimmed);
  const command = args[0]?.toUpperCase();

  switch (command) {
   
    case "LIST_TOKENS":
      pendingCommand = "LIST_TOKENS";
      socket.emit("session_request");
      break;

    case "LIST_VOTES":
      console.log("Solicitando lista de votos...");
      socket.emit("list_votes_request");
      break;

    case "PLACAR":
      console.log("Placar atual");
      console.log(`  Sim: ${placarAtual.sim}`);
      console.log(`  Não: ${placarAtual.nao}`);
      promptUser();
      break;

    case "SESSION":
      pendingCommand = "SESSION";
      socket.emit("session_request");
      break;

    case "CLEAR":
      clearConsole();
      promptUser();
      break;

    case "HELP":
      console.log(HELP);
      promptUser();
      break;

    case "EXIT":
    case "QUIT":
      console.log("Encerrando console de votação...");
      socket.disconnect();
      rl?.close();
      break;

    default:
      console.log(`Comando desconhecido: ${command}. Digite HELP para ajuda.`);
      promptUser();
  }
}

function setupSocketListeners(): void {
  socket.on("connect", () => {
    // console.log("Conectado ao servidor de votação.");
  });

  socket.on("connection_ack", (data: any) => {
    currentSessionId = data.sessao_id;
    placarAtual = data.placar_atual;

    socket.on(`placar_atualizado_${data.sessao_id}`, (placar: PlacarAtual) => {
      placarAtual = placar;
      if (pendingCommand === "VOTE") {
        console.log(`✓ Voto registrado com sucesso!`);
        pendingCommand = null;
      } else {
        console.log(`\n Voto registrado em outro terminal! Placar atualizado: SIM=${placar.sim} | NÃO=${placar.nao}`);
      }
      promptUser();
    });
  });

  socket.on("generate_token_response", (data: { token: string }) => {
    console.log(`✓ Token gerado e autorizado com sucesso!`);
    console.log(`  ├─ Token: ${data.token}`);
    console.log(`  └─ Status: PRONTO PARA VOTAR`);
    promptUser();
  });

  socket.on("token_status_response", (status: any) => {
    if (pendingCommand === "AUTH") {
      if (!status.autorizado) {
        console.log("✗ Token não autorizado");
        console.log(`  ├─ Token: ${status.token}`);
        console.log("  ├─ Status: NÃO ENCONTRADO NA LISTA");
        console.log("  └─ Ação: Acesso negado");
      } else {
        console.log("✓ Token válido e autorizado");
        if (status.votou) {
          console.log("✗ Token já exerceu direito de voto");
          console.log(`  ├─ Voto registrado: ${status.voto_registrado}`);
          console.log(`  └─ Timestamp: ${status.timestamp_voto}`);
        } else {
          console.log("✓ Token nunca votou antes");
          console.log("Status: PRONTO PARA VOTAR");
        }
      }
    } else if (pendingCommand === "STATUS") {
      console.log("─── Status do Token ───────────────────");
      console.log(`Token: ${status.token}`);
      console.log(`Autorizado: ${status.autorizado ? "SIM" : "NÃO"}`);
      console.log(`Votou: ${status.votou ? "SIM" : "NÃO"}`);
      if (status.voto_registrado) {
        console.log(`Voto registrado: "${status.voto_registrado}"`);
        console.log(`Timestamp do voto: ${status.timestamp_voto}`);
      }
      console.log(`Pode votar novamente: ${status.pode_votar ? "SIM" : "NÃO"}`);
      console.log("─────────────────────────────────────");
    }
    pendingCommand = null;
    promptUser();
  });

  socket.on("list_votes_response", (data: { votos: VotoRegistrado[] }) => {
    if (data.votos.length === 0) {
      console.log("Nenhum voto registrado ainda.");
    } else {
      console.log("Votos registrados:");
      for (const voto of data.votos) {
        console.log(`  - ${voto.token} → ${voto.voto} (${voto.timestamp})`);
      }
    }
    promptUser();
  });

  socket.on("session_data", (data: any) => {
    if (pendingCommand === "LIST_TOKENS") {
      console.log("Tokens autorizados a votar (ainda aptos):");
      if (data.tokens_autorizados.length === 0) {
        console.log("  (Nenhum token disponível ou todos já votaram)");
      } else {
        for (const token of data.tokens_autorizados) {
          console.log(`  - ${token}`);
        }
      }
    } else if (pendingCommand === "SESSION") {
      console.log("─── Sessão Ativa ───────────────────────");
      console.log(`Sessão: ${data.sessao_id}`);
      console.log(`Placar: SIM=${data.placar_atual.sim} | NÃO=${data.placar_atual.nao}`);
      console.log(`Tokens ainda aptos a votar (${data.tokens_autorizados.length}):`);
      if (data.tokens_autorizados.length === 0) {
        console.log("  - (Nenhum token apto)");
      } else {
        for (const token of data.tokens_autorizados) {
          console.log(`  - ${token}`);
        }
      }
      console.log(`Tokens que já votaram (${data.tokens_que_ja_votaram.length}):`);
      if (data.tokens_que_ja_votaram.length === 0) {
        console.log("  - (Nenhum token votou)");
      } else {
        for (const token of data.tokens_que_ja_votaram) {
          console.log(`  - ${token}`);
        }
      }
      console.log("───────────────────────────────────────");
    }
    pendingCommand = null;
    promptUser();
  });

  socket.on("vote_error", (error: any) => {
    console.log(`✗ VOTO REJEITADO - ${error.message} (${error.code})`);
    pendingCommand = null;
    promptUser();
  });

  socket.on("connect_error", (error: any) => {
    console.error("\nErro de conexão com o servidor:", error.message);
    rl?.close();
    process.exit(1);
  });
}

// ──────────────────────────────────────────────────────────────────
// ADIÇÃO: API HTTP no mesmo processo, para o frontend consultar.
// Não toca em nada do que já existia acima. Usa o mesmo `socket`
// e a mesma `placarAtual`, mas escuta as respostas de forma isolada
// (uma Promise por chamada), sem depender do `pendingCommand`
// global — assim não interfere com quem está digitando no terminal.
// ──────────────────────────────────────────────────────────────────

const API_PORT = process.env.API_PORT ?? 3002;

function requestSessionData(): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout")), 5000);
    socket.once("session_data", (data: any) => {
      clearTimeout(timeout);
      resolve(data);
    });
    socket.emit("session_request");
  });
}

function requestVotes(): Promise<{ votos: VotoRegistrado[] }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout")), 5000);
    socket.once("list_votes_response", (data: any) => {
      clearTimeout(timeout);
      resolve(data);
    });
    socket.emit("list_votes_request");
  });
}

function startApi(): void {
  const app = express();
  app.use(cors());

  // equivalente a LIST_TOKENS
  app.get("/api/tokens", async (_req, res) => {
    try {
      const data = await requestSessionData();
      res.json({ tokens_autorizados: data.tokens_autorizados });
    } catch {
      res.status(502).json({ error: "Falha ao consultar tokens" });
    }
  });

  // equivalente a LIST_VOTES
  app.get("/api/votes", async (_req, res) => {
    try {
      const data = await requestVotes();
      res.json(data);
    } catch {
      res.status(502).json({ error: "Falha ao consultar votos" });
    }
  });

  // equivalente a PLACAR
  app.get("/api/placar", (_req, res) => {
    res.json(placarAtual);
  });

  // equivalente a SESSION
  app.get("/api/session", async (_req, res) => {
    try {
      const data = await requestSessionData();
      res.json(data);
    } catch {
      res.status(502).json({ error: "Falha ao consultar sessão" });
    }
  });

  app.listen(API_PORT, () => {
    console.log(`API HTTP para o frontend disponível em http://localhost:${API_PORT}`);
  });
}

function startConsole(): void {
  clearConsole();

  console.log(`Conectando ao servidor de votação em ${SERVER_URL}...`);
  socket = io(SERVER_URL);
  
  setupSocketListeners();
  startApi();

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "votacao> ",
  });

  rl.on("line", (line) => {
    handleCommand(line);
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

startConsole();