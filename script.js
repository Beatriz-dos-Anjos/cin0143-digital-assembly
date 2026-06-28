"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const socket_io_client_1 = require("socket.io-client");
const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3001";
const OPTION = process.env.VOTE_OPTION ?? "sim";
// Use VOTE_TOKEN from environment if provided, otherwise generate a random unique token
let token = process.env.VOTE_TOKEN;
if (!token) {
    token = `TK_CLIENT_TEST_${(0, crypto_1.randomUUID)().replace(/-/g, "").toUpperCase()}`;
}
const socket = (0, socket_io_client_1.io)(SERVER_URL);
socket.on("connect", () => {
    console.log(`Connected to server: ${SERVER_URL}`);
});
socket.on("connection_ack", (data) => {
    console.log("Initial session:", data);
    console.log(`Registering/Authorizing token: ${token}`);
    socket.emit("client_register", { token });
});
socket.on("client_registered", (data) => {
    console.log("Token successfully authorized by server:", data);
    const activeToken = data.token;
    const sessionId = data.session_id;
    // Listen to the correct score channel dynamically
    socket.on(`score_updated_${sessionId}`, (score) => {
        console.log("Updated score received:", score);
        socket.disconnect();
    });
    const payload = `CAST_VOTE|${activeToken}|${OPTION}`;
    console.log("Sending vote:", payload);
    socket.emit("cast_vote", payload);
});
socket.on("vote_error", (error) => {
    console.log("Voting error:", error);
    socket.disconnect();
});
socket.on("connect_error", (error) => {
    console.error("Failed to connect:", error.message);
    process.exit(1);
});
