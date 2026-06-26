const { randomUUID } = require("crypto");
const { io } = require("socket.io-client");

const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3001";
const SESSION_ID = process.env.SESSION_ID ?? "assembleia-2026-06";
const TOTAL_CLIENTS = Number.parseInt(process.env.CLIENTS ?? "20", 10);
const VOTE_OPTION = process.env.VOTE_OPTION === "nao" ? "nao" : "sim";
const REGISTER_TIMEOUT_MS = Number.parseInt(process.env.REGISTER_TIMEOUT_MS ?? "10000", 10);
const RESULT_TIMEOUT_MS = Number.parseInt(process.env.RESULT_TIMEOUT_MS ?? "10000", 10);

function createToken(index) {
  return `TK_LOAD_${index}_${randomUUID().replace(/-/g, "").toUpperCase()}`;
}

function waitForEvent(socket, eventName, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout aguardando evento ${eventName}`));
    }, timeoutMs);

    const handler = (payload) => {
      cleanup();
      resolve(payload);
    };

    function cleanup() {
      clearTimeout(timeoutId);
      socket.off(eventName, handler);
    }

    socket.on(eventName, handler);
  });
}

async function fetchSessionSnapshot() {
  const response = await fetch(`http://localhost:3001/sessions/${SESSION_ID}`);

  if (!response.ok) {
    throw new Error(`Falha ao consultar sessão ${SESSION_ID}: ${response.status}`);
  }

  return response.json();
}

function connectClient(index) {
  const token = createToken(index);
  const socket = io(SERVER_URL, {
    autoConnect: true,
    reconnection: false,
  });

  const registered = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout ao registrar cliente ${index}`));
    }, REGISTER_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeoutId);
      socket.off("connection_ack", handleConnectionAck);
      socket.off("client_registered", handleClientRegistered);
      socket.off("connect_error", handleConnectError);
    }

    function handleConnectionAck() {
      socket.emit("client_register", { token });
    }

    function handleClientRegistered(payload) {
      cleanup();
      resolve({ socket, token, sessionId: payload.sessao_id });
    }

    function handleConnectError(error) {
      cleanup();
      reject(error);
    }

    socket.on("connection_ack", handleConnectionAck);
    socket.on("client_registered", handleClientRegistered);
    socket.on("connect_error", handleConnectError);
  });

  return { socket, token, registered };
}

async function main() {
  if (!Number.isInteger(TOTAL_CLIENTS) || TOTAL_CLIENTS < 2) {
    throw new Error("CLIENTS precisa ser um inteiro maior ou igual a 2");
  }

  const initialSnapshot = await fetchSessionSnapshot();
  const clients = Array.from({ length: TOTAL_CLIENTS }, (_, index) => connectClient(index + 1));
  const registeredClients = await Promise.all(clients.map((client) => client.registered));

  const voteResults = registeredClients.map((client) =>
    waitForEvent(client.socket, "vote_accepted", RESULT_TIMEOUT_MS)
  );

  for (const client of registeredClients) {
    client.socket.emit("cast_vote", `CAST_VOTE|${client.token}|${VOTE_OPTION}`);
  }

  await Promise.all(voteResults);

  for (const client of registeredClients) {
    client.socket.disconnect();
  }

  const finalSnapshot = await fetchSessionSnapshot();
  const expectedAccepted = registeredClients.length;

  const simDelta = finalSnapshot.placar_atual.sim - initialSnapshot.placar_atual.sim;
  const naoDelta = finalSnapshot.placar_atual.nao - initialSnapshot.placar_atual.nao;
  const votosDelta = finalSnapshot.votos_realizados.length - initialSnapshot.votos_realizados.length;
  const votaramDelta = finalSnapshot.total_votaram - initialSnapshot.total_votaram;

  const expectedSimDelta = VOTE_OPTION === "sim" ? expectedAccepted : 0;
  const expectedNaoDelta = VOTE_OPTION === "nao" ? expectedAccepted : 0;

  if (simDelta !== expectedSimDelta || naoDelta !== expectedNaoDelta) {
    throw new Error(
      `Placar inconsistente. Inicial SIM=${initialSnapshot.placar_atual.sim} NAO=${initialSnapshot.placar_atual.nao}; ` +
        `Final SIM=${finalSnapshot.placar_atual.sim} NAO=${finalSnapshot.placar_atual.nao}; ` +
        `Esperado delta SIM=${expectedSimDelta} NAO=${expectedNaoDelta}`
    );
  }

  if (votosDelta !== expectedAccepted || votaramDelta !== expectedAccepted) {
    throw new Error(
      `Contagem inconsistente. Esperado delta de ${expectedAccepted} votos, ` +
        `obtido votos=${votosDelta} e tokens_votaram=${votaramDelta}`
    );
  }

  console.log("Teste concorrente concluído com sucesso.");
  console.log(`Clientes: ${expectedAccepted}`);
  console.log(`Voto: ${VOTE_OPTION}`);
  console.log(`Delta SIM: ${simDelta}`);
  console.log(`Delta NAO: ${naoDelta}`);
  console.log(`Delta votos: ${votosDelta}`);
}

main().catch((error) => {
  console.error("Teste concorrente falhou:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});