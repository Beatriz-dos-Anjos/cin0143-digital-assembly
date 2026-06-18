import { io } from "socket.io-client";

const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3001";
const TOKEN = process.env.VOTE_TOKEN ?? "token_001_eleitor_001";
const OPCAO = process.env.VOTE_OPCAO ?? "opcao_A";

const socket = io(SERVER_URL);

socket.on("connect", () => {
  console.log(`Conectado ao servidor: ${SERVER_URL}`);
});

socket.on("connection_ack", (data) => {
  console.log("Sessão:", data);
  const payload = `CAST_VOTE|${TOKEN}|${OPCAO}`;
  console.log("Enviando:", payload);
  socket.emit("cast_vote", payload);
});

socket.on("placar_atualizado_assembleia-2026-01", (placar) => {
  console.log("Placar atualizado:", placar);
  socket.disconnect();
});

socket.on("vote_error", (error) => {
  console.log("Erro de votação:", error);
  socket.disconnect();
});

socket.on("connect_error", (error) => {
  console.error("Falha ao conectar:", error.message);
  process.exit(1);
});
