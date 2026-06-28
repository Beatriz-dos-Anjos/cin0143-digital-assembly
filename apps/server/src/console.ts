import * as readline from "readline";
import { io, Socket } from "socket.io-client";
import { CurrentScore, RegisteredVote } from "./domain/types";

const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3001";
let socket: Socket;
let rl: readline.Interface | null = null;
let currentSessionId = "assembleia-2026-06";
let currentScore: CurrentScore = { sim: 0, no: 0 };

let pendingCommand: "AUTH" | "STATUS" | "LIST_TOKENS" | "SESSION" | "VOTE" | null = null;

const BANNER = `
╔════════════════════════════════════════════════════════════╗
║  Authentication Console - Digital Voting System            ║
╚════════════════════════════════════════════════════════════╝
`;

const HELP = `
Available commands:
  LIST_TOKENS               - List all valid tokens
  LIST_VOTES                - List cast votes
  SCORE                     - Display current score
  SESSION                   - List complete active session data
  CLEAR                     - Clear console
  HELP                      - Display help
  EXIT                      - Exit
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
      console.log("Requesting list of votes...");
      socket.emit("list_votes_request");
      break;

    case "SCORE":
    case "PLACAR":
      console.log("Current Score");
      console.log(`  sim: ${currentScore.sim}`);
      console.log(`  No: ${currentScore.no}`);
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
      console.log("Closing voting console...");
      socket.disconnect();
      rl?.close();
      break;

    default:
      console.log(`Unknown command: ${command}. Type HELP for help.`);
      promptUser();
  }
}

function setupSocketListeners(): void {
  socket.on("connect", () => {
    // console.log("Connected to the voting server.");
  });

  socket.on("connection_ack", (data: any) => {
    currentSessionId = data.session_id;
    currentScore = data.current_score;

    socket.on(`score_updated_${data.session_id}`, (score: CurrentScore) => {
      currentScore = score;
      if (pendingCommand === "VOTE") {
        console.log(`✓ Vote registered successfully!`);
        pendingCommand = null;
      } else {
        console.log(`\n Vote registered in another terminal! Score updated: sim=${score.sim} | NO=${score.no}`);
      }
      promptUser();
    });
  });

  socket.on("generate_token_response", (data: { token: string }) => {
    console.log(`✓ Token successfully generated and authorized!`);
    console.log(`  ├─ Token: ${data.token}`);
    console.log(`  └─ Status: READY TO VOTE`);
    promptUser();
  });

  socket.on("token_status_response", (status: any) => {
    if (pendingCommand === "AUTH") {
      if (!status.authorized) {
        console.log("✗ Token not authorized");
        console.log(`  ├─ Token: ${status.token}`);
        console.log("  ├─ Status: NOT FOUND IN LIST");
        console.log("  └─ Action: Access denied");
      } else {
        console.log("✓ Token valid and authorized");
        if (status.voted) {
          console.log("✗ Token has already voted");
          console.log(`  ├─ Vote registered: ${status.registered_vote}`);
          console.log(`  └─ Timestamp: ${status.vote_timestamp}`);
        } else {
          console.log("✓ Token has never voted before");
          console.log("Status: READY TO VOTE");
        }
      }
    } else if (pendingCommand === "STATUS") {
      console.log("─── Token Status ───────────────────");
      console.log(`Token: ${status.token}`);
      console.log(`Authorized: ${status.authorized ? "sim" : "nao"}`);
      console.log(`Voted: ${status.voted ? "sim" : "nao"}`);
      if (status.registered_vote) {
        console.log(`Vote registered: "${status.registered_vote}"`);
        console.log(`Vote timestamp: ${status.vote_timestamp}`);
      }
      console.log(`Can vote again: ${status.can_vote ? "sim" : "nao"}`);
      console.log("─────────────────────────────────────");
    }
    pendingCommand = null;
    promptUser();
  });

  socket.on("list_votes_response", (data: { votes: RegisteredVote[] }) => {
    if (data.votes.length === 0) {
      console.log("No votes registered yet.");
    } else {
      console.log("Registered votes:");
      for (const vote of data.votes) {
        console.log(`  - ${vote.token} → ${vote.vote} (${vote.timestamp})`);
      }
    }
    promptUser();
  });

  socket.on("session_data", (data: any) => {
    if (pendingCommand === "LIST_TOKENS") {
      console.log("Tokens authorized to vote (still eligible):");
      if (data.authorized_tokens.length === 0) {
        console.log("  (No tokens available or all have already voted)");
      } else {
        for (const token of data.authorized_tokens) {
          console.log(`  - ${token}`);
        }
      }
    } else if (pendingCommand === "SESSION") {
      console.log("─── Active Session ───────────────────────");
      console.log(`Session: ${data.session_id}`);
      console.log(`Score: sim=${data.current_score.sim} | NO=${data.current_score.no}`);
      console.log(`Tokens still eligible to vote (${data.authorized_tokens.length}):`);
      if (data.authorized_tokens.length === 0) {
        console.log("  - (No eligible tokens)");
      } else {
        for (const token of data.authorized_tokens) {
          console.log(`  - ${token}`);
        }
      }
      console.log(`Tokens that have already voted (${data.voted_tokens.length}):`);
      if (data.voted_tokens.length === 0) {
        console.log("  - (No token voted)");
      } else {
        for (const token of data.voted_tokens) {
          console.log(`  - ${token}`);
        }
      }
      console.log("───────────────────────────────────────");
    }
    pendingCommand = null;
    promptUser();
  });

  socket.on("vote_error", (error: any) => {
    console.log(`✗ VOTE REJECTED - ${error.message} (${error.code})`);
    pendingCommand = null;
    promptUser();
  });

  socket.on("connect_error", (error: any) => {
    console.error("\nServer connection error:", error.message);
    rl?.close();
    process.exit(1);
  });
}

function startConsole(): void {
  clearConsole();

  console.log(`Connecting to the voting server at ${SERVER_URL}...`);
  socket = io(SERVER_URL);

  setupSocketListeners();

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "voting> ",
  });

  rl.on("line", (line) => {
    handleCommand(line);
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

startConsole();