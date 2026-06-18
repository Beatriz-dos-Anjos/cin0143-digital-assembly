import * as readline from "readline";

import { VoteOption } from "./domain/types";
import {
  getTokenStatus,
  processVote,
} from "./domain/vote-validator";
import { formatCastVote } from "./domain/vote-parser";
import { logger } from "./loggers/logger";
import {
  logDuplicateVote,
  logUnauthorizedVote,
  logVoteAccepted,
} from "./handlers/vote-handler";
import { sessionStore } from "./repository/session-store";

const BANNER = `
╔════════════════════════════════════════════════════════════╗
║  Console de Autenticação - Sistema de Votação Digital     ║
╚════════════════════════════════════════════════════════════╝
`;

const HELP = `
Comandos disponíveis:
  AUTH <token>              - Validar se token é autorizado
  VOTE <token> <opcao>      - Simular voto (opcao_A ou opcao_B)
  CAST <token> <opcao>      - Alias de VOTE
  STATUS <token>            - Verificar status do token
  LIST_TOKENS               - Listar todos os tokens válidos
  LIST_VOTES                - Listar votos registrados
  PLACAR                    - Exibir placar atual
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

function isVoteOption(value: string): value is VoteOption {
  return value === "opcao_A" || value === "opcao_B";
}

function handleAuth(token: string): void {
  const sessao = sessionStore.getDefault();
  const status = getTokenStatus(sessao, token);

  if (!status.autorizado) {
    console.log("✗ Token não autorizado");
    console.log(`  ├─ Token: ${token}`);
    console.log("  ├─ Status: NÃO ENCONTRADO NA LISTA");
    console.log("  └─ Ação: Acesso negado");
    return;
  }

  console.log("✓ Token válido e autorizado");

  if (status.votou) {
    console.log("✗ Token já exerceu direito de voto");
    console.log(`  ├─ Voto registrado: ${status.voto_registrado}`);
    console.log(`  └─ Timestamp: ${status.timestamp_voto}`);
    return;
  }

  console.log("✓ Token nunca votou antes");
  console.log("Status: PRONTO PARA VOTAR");
}

function handleStatus(token: string): void {
  const sessao = sessionStore.getDefault();
  const status = getTokenStatus(sessao, token);

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

function handleVote(token: string, opcao: string): void {
  if (!isVoteOption(opcao)) {
    console.log("✗ Opção inválida. Use opcao_A ou opcao_B.");
    return;
  }

  const sessao = sessionStore.getDefault();
  const payload = formatCastVote(token, opcao);
  const result = processVote(sessao, payload, {
    sessao_id: sessao.sessao_id,
    socket_id: "console_local",
    ip: "127.0.0.1",
  });

  if (!result.success) {
    if (result.error.code === "TOKEN_NAO_AUTORIZADO") {
      logUnauthorizedVote(token, {
        sessao_id: sessao.sessao_id,
        socket_id: "console_local",
        ip: "127.0.0.1",
      }, payload);

      console.log("✗ VOTO REJEITADO - Token não autorizado");
      console.log(`  ├─ Token: ${token}`);
      console.log("  ├─ Motivo: Token não consta na lista de autorizados");
      console.log("  └─ Ação: Voto recusado");
      return;
    }

    if (result.error.code === "VOTO_DUPLICADO" && result.duplicate) {
      logDuplicateVote(
        result.duplicate,
        {
          sessao_id: sessao.sessao_id,
          socket_id: "console_local",
          ip: "127.0.0.1",
        },
        payload
      );

      console.log("✗ VOTO REJEITADO - Duplicidade detectada");
      console.log(`  ├─ Token: ${token}`);
      console.log("  ├─ Motivo: Token já exerceu direito de voto");
      console.log(`  ├─ Voto anterior: ${result.duplicate.voto_anterior}`);
      console.log(`  ├─ Hora anterior: ${result.duplicate.timestamp_voto_anterior}`);
      console.log("  └─ Ação: Voto recusado, log registrado");
      return;
    }

    console.log(`✗ ${result.error.message}`);
    return;
  }

  logVoteAccepted(result, payload);

  console.log("✓ Voto registrado com sucesso!");
  console.log(`  ├─ Token: ${token}`);
  console.log(`  ├─ Voto: ${opcao}`);
  console.log(`  ├─ Timestamp: ${result.voto.timestamp}`);
  console.log("  └─ Status: VOTAÇÃO CONCLUÍDA");
}

function handleListTokens(): void {
  const sessao = sessionStore.getDefault();

  console.log("Tokens autorizados:");
  for (const token of sessao.tokens_autorizados) {
    console.log(`  - ${token}`);
  }
}

function handleListVotes(): void {
  const sessao = sessionStore.getDefault();

  if (sessao.votos_realizados.length === 0) {
    console.log("Nenhum voto registrado ainda.");
    return;
  }

  console.log("Votos registrados:");
  for (const voto of sessao.votos_realizados) {
    console.log(
      `  - ${voto.token} → ${voto.voto} (${voto.timestamp})`
    );
  }
}

function handlePlacar(): void {
  const sessao = sessionStore.getDefault();
  console.log("Placar atual:");
  console.log(`  opcao_A: ${sessao.placar_atual.opcao_A}`);
  console.log(`  opcao_B: ${sessao.placar_atual.opcao_B}`);
}

function handleCommand(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return true;
  }

  const args = parseQuotedArgs(trimmed);
  const command = args[0]?.toUpperCase();

  switch (command) {
    case "AUTH":
      if (!args[1]) {
        console.log("Uso: AUTH <token>");
        break;
      }
      handleAuth(args[1]);
      break;
    case "VOTE":
    case "CAST":
      if (!args[1] || !args[2]) {
        console.log("Uso: VOTE <token> <opcao_A|opcao_B>");
        break;
      }
      handleVote(args[1], args[2]);
      break;
    case "STATUS":
      if (!args[1]) {
        console.log("Uso: STATUS <token>");
        break;
      }
      handleStatus(args[1]);
      break;
    case "LIST_TOKENS":
      handleListTokens();
      break;
    case "LIST_VOTES":
      handleListVotes();
      break;
    case "PLACAR":
      handlePlacar();
      break;
    case "CLEAR":
      clearConsole();
      break;
    case "HELP":
      console.log(HELP);
      break;
    case "EXIT":
    case "QUIT":
      console.log("Encerrando console de votação...");
      return false;
    default:
      console.log(`Comando desconhecido: ${command}. Digite HELP para ajuda.`);
  }

  return true;
}

function startConsole(): void {
  clearConsole();

  logger.info("CONSOLE", "Console de autenticação iniciado", {
    sessao: sessionStore.getDefault().sessao_id,
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "votacao> ",
  });

  rl.prompt();

  rl.on("line", (line) => {
    const shouldContinue = handleCommand(line);
    if (!shouldContinue) {
      rl.close();
      return;
    }
    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

startConsole();
