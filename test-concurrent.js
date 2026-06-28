const BASE_URL = "http://localhost:3001";
const SESSION_ID = `test-${Date.now()}`;
const TOTAL_VOTES = 20;

const tokens = Array.from(
  { length: TOTAL_VOTES },
  (_, i) => `token-test-valid-${String(i).padStart(16, "0")}`
);

async function createSession() {
  const res = await fetch(`${BASE_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: SESSION_ID,
      authorized_tokens: tokens,
      options: ["sim", "nao"],
    }),
  });
  const json = await res.json();
  console.log("Session creation:", json);
  return tokens;
}

async function vote(token, option) {
  const res = await fetch(`${BASE_URL}/api/sessions/${SESSION_ID}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, option: option.toLowerCase() }),
  });
  const json = await res.json();
  if (!json.success) console.log(`[${token}]`, JSON.stringify(json));
  return json;
}


async function main() {
  console.log(`Session: ${SESSION_ID}`);
  console.log("Creating session...");
  await createSession();

  console.log(`\n--- Test of ${TOTAL_VOTES} simultaneous votes ---`);
  const start = Date.now();

  const results = await Promise.all(
    tokens.map((token, i) => vote(token, i % 2 === 0 ? "sim" : "nao"))
  );

  const duration = Date.now() - start;
  const successes = results.filter((r) => r.success).length;
  const errors = results.filter((r) => !r.success);

  console.log(`\nResult in ${duration}ms:`);
  console.log(`  Accepted votes: ${successes} / ${TOTAL_VOTES}`);
  console.log(`  Expected sim: 10, NO: 10`);

  if (errors.length > 0) {
    console.log(`  Unexpected errors:`);
    errors.forEach((e) => console.log(`    -`, JSON.stringify(e)));
  }

  const session = await fetch(`${BASE_URL}/sessions/${SESSION_ID}`).then((r) =>
    r.json()
  );
  console.log(`\nFinal score:`, session.current_score);
  console.log(`Total voted: ${session.total_voted} / ${session.total_authorized}`);

  const scoreOk =
    session.total_voted === TOTAL_VOTES && successes === TOTAL_VOTES;
  console.log(
    `\n${scoreOk ? "LOCKS WORKING" : "CONCURRENCY PROBLEM DETECTED"}`
  );

}

main().catch(console.error);