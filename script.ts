import { randomUUID } from "crypto";
import { io } from "socket.io-client";

const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3001";
const OPCAO = process.env.VOTE_OPCAO ?? "sim";

// Use VOTE_TOKEN from environment if provided, otherwise generate a random unique token
let token = process.env.VOTE_TOKEN;
if (!token) {
  token = `TK_CLIENT_TEST_${randomUUID().slice(0, 8).toUpperCase()}`;
}

const socket = io(SERVER_URL);

socket.on("connect", () => {
  console.log(`Conectado ao servidor: ${SERVER_URL}`);
});

socket.on("connection_ack", (data) => {
  console.log("Sessão inicial:", data);
  console.log(`Registrando/Autorizando token: ${token}`);
  socket.emit("client_register", { token });
});

socket.on("client_registered", (data) => {
  console.log("Token autorizado com sucesso pelo servidor:", data);
  const activeToken = data.token;
  const sessionId = data.sessao_id;

  // Listen to the correct placar channel dynamically
  socket.on(`placar_atualizado_${sessionId}`, (placar) => {
    console.log("Placar atualizado recebido:", placar);
    socket.disconnect();
  });

  const payload = `CAST_VOTE|${activeToken}|${OPCAO}`;
  console.log("Enviando voto:", payload);
  socket.emit("cast_vote", payload);
});

socket.on("vote_error", (error) => {
  console.log("Erro de votação:", error);
  socket.disconnect();
});

socket.on("connect_error", (error) => {
  console.error("Falha ao conectar:", error.message);
  process.exit(1);
});
