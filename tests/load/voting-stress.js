/**
 * Teste de carga e concorrência via HTTP (mesma trava withSessionLock do WebSocket).
 *
 * Pré-requisitos:
 *   - Servidor rodando: npm run dev  (porta 3001)
 *   - K6 instalado: https://k6.io/docs/get-started/installation/
 *
 * Executar:
 *   k6 run tests/load/voting-stress.js
 *   k6 run -e VUS=100 tests/load/voting-stress.js
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const VU_COUNT = parseInt(__ENV.VUS || "50", 10);
const DUPLICATE_VUS = parseInt(__ENV.DUPLICATE_VUS || "20", 10);

export const options = {
  scenarios: {
    votos_unicos: {
      executor: "shared-iterations",
      exec: "votoUnico",
      vus: VU_COUNT,
      iterations: VU_COUNT,
      maxDuration: "60s",
    },
    voto_duplicado: {
      executor: "shared-iterations",
      exec: "votoDuplicado",
      vus: DUPLICATE_VUS,
      iterations: DUPLICATE_VUS,
      maxDuration: "30s",
      startTime: "2s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "checks{scenario:votos_unicos}": ["rate>0.99"],
    "checks{scenario:voto_duplicado}": ["rate>0.99"],
  },
};

export function setup() {
  const sessaoId = `k6-stress-${Date.now()}`;
  const tokens = Array.from({ length: VU_COUNT }, (_, i) =>
    `k${String(i).padStart(31, "0")}`
  );
  const duplicateToken = "d".repeat(32);

  const payload = JSON.stringify({
    session_id: sessaoId,
    tokens_autorizados: [...tokens, duplicateToken],
    opcoes: ["sim", "nao"],
  });

  const createRes = http.post(`${BASE_URL}/api/sessions`, payload, {
    headers: { "Content-Type": "application/json" },
  });

  check(createRes, {
    "sessão criada": (r) => r.status === 201,
  });

  if (createRes.status !== 201) {
    throw new Error(`Falha ao criar sessão K6: ${createRes.body}`);
  }

  return { sessaoId, tokens, duplicateToken };
}

export function votoUnico(data) {
  const token = data.tokens[__VU - 1];
  if (!token) {
    return;
  }

  const res = http.post(
    `${BASE_URL}/api/sessions/${data.sessaoId}/votes`,
    JSON.stringify({ token, opcao: __VU % 2 === 0 ? "sim" : "nao" }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(res, {
    "voto aceito": (r) => r.status === 200 && r.json("success") === true,
  });
}

export function votoDuplicado(data) {
  const res = http.post(
    `${BASE_URL}/api/sessions/${data.sessaoId}/votes`,
    JSON.stringify({ token: data.duplicateToken, opcao: "sim" }),
    { headers: { "Content-Type": "application/json" } }
  );

  const accepted = res.status === 200 && res.json("success") === true;
  const duplicate =
    res.status === 400 && res.json("error")?.code === "VOTO_DUPLICADO";

  check(res, {
    "aceito ou duplicado rejeitado": () => accepted || duplicate,
  });
}

export function teardown(data) {
  const res = http.get(`${BASE_URL}/sessions/${data.sessaoId}`);
  if (res.status !== 200) {
    console.error(`Não foi possível ler sessão ${data.sessaoId}: ${res.body}`);
    return;
  }

  const body = res.json();
  const placar = body.placar_atual;
  const totalPlacar = placar.sim + placar.nao;

  check(body, {
    "placar = total_votaram": () => totalPlacar === body.total_votaram,
    "todos tokens únicos votaram": () => body.total_votaram === data.tokens.length + 1,
    "sem sim/nao negativos": () => placar.sim >= 0 && placar.nao >= 0,
  });
}

export default function () {
  sleep(0.1);
}
