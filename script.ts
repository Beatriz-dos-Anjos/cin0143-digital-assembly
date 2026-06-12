
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

socket.on("connection_ack", () => {
  socket.emit("cast_vote", "CAST_VOTE|TK_CONDOMINO_002|opcao_A");
});

socket.on("placar_atualizado_assembleia-2026-01", console.log);
socket.on("vote_error", console.log);