/**
 * Load and concurrency test via HTTP (uses the same withSessionLock lock as WebSocket).
 *
 * Prerequisites:
 *   - Server running: npm run dev  (port 3001)
 *   - K6 installed: https://k6.io/docs/get-started/installation/
 *
 * Execute:
 *   k6 run tests/load/voting-stress.js
 *   k6 run -e VUS=100 tests/load/voting-stress.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { scenario } from "k6/execution";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const VU_COUNT = parseInt(__ENV.VUS || "50", 10);
const DUPLICATE_VUS = parseInt(__ENV.DUPLICATE_VUS || "20", 10);

export const options = {
  scenarios: {
    unique_votes: {
      executor: "shared-iterations",
      exec: "uniqueVote",
      vus: VU_COUNT,
      iterations: VU_COUNT,
      maxDuration: "60s",
    },
    duplicate_vote: {
      executor: "shared-iterations",
      exec: "duplicateVote",
      vus: DUPLICATE_VUS,
      iterations: DUPLICATE_VUS,
      maxDuration: "30s",
      startTime: "2s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.30"], // Since we expect 19/71 (~26.7%) requests to fail as duplicate votes, we adjust the threshold
    "checks{scenario:unique_votes}": ["rate>0.99"],
    "checks{scenario:duplicate_vote}": ["rate>0.99"],
  },
};

export function setup() {
  const sessionId = `k6-stress-${Date.now()}`;
  const tokens = Array.from({ length: VU_COUNT }, (_, i) =>
    `k${String(i).padStart(31, "0")}`
  );
  const duplicateToken = "d".repeat(32);

  const payload = JSON.stringify({
    session_id: sessionId,
    authorized_tokens: [...tokens, duplicateToken],
    options: ["sim", "nao"],
  });

  const createRes = http.post(`${BASE_URL}/api/sessions`, payload, {
    headers: { "Content-Type": "application/json" },
  });

  check(createRes, {
    "session created": (r) => r.status === 201,
  });

  if (createRes.status !== 201) {
    throw new Error(`Failed to create K6 session: ${createRes.body}`);
  }

  return { sessionId, tokens, duplicateToken };
}

export function uniqueVote(data) {
  const token = data.tokens[scenario.iterationInTest];
  if (!token) {
    return;
  }

  const res = http.post(
    `${BASE_URL}/api/sessions/${data.sessionId}/votes`,
    JSON.stringify({ token, option: scenario.iterationInTest % 2 === 0 ? "sim" : "nao" }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(res, {
    "vote accepted": (r) => r.status === 200 && r.json("success") === true,
  });
}

export function duplicateVote(data) {
  const res = http.post(
    `${BASE_URL}/api/sessions/${data.sessionId}/votes`,
    JSON.stringify({ token: data.duplicateToken, option: "sim" }),
    { headers: { "Content-Type": "application/json" } }
  );

  const accepted = res.status === 200 && res.json("success") === true;
  const duplicate =
    res.status === 400 && res.json("error")?.code === "DUPLICATE_VOTE";

  check(res, {
    "accepted or duplicate rejected": () => accepted || duplicate,
  });
}

export function teardown(data) {
  const res = http.get(`${BASE_URL}/sessions/${data.sessionId}`);
  if (res.status !== 200) {
    console.error(`Could not read session ${data.sessionId}: ${res.body}`);
    return;
  }

  const body = res.json();
  const score = body.current_score;
  const totalScore = score.sim + score.no;

  check(body, {
    "score = total_voted": () => totalScore === body.total_voted,
    "all unique tokens voted": () => body.total_voted === data.tokens.length + 1,
    "no negative sim/no": () => score.sim >= 0 && score.no >= 0,
  });
}

export default function () {
  sleep(0.1);
}
