import { formatCastVote } from "./vote-parser";
import { processVote } from "./vote-validator";
import withSessionLock from "./lock.service";
import { VotingSession } from "./types";

function createSessionWithTokens(count: number): VotingSession {
  const tokens = Array.from({ length: count }, (_, i) =>
    `k${String(i).padStart(31, "0")}`
  );

  return {
    session_id: "concurrency-test",
    current_score: { sim: 0, nao: 0 },
    authorized_tokens: tokens,
    voted_tokens: [],
    votes_cast: [],
    created_at: "2026-06-21 00:00:00",
    started_at: Date.now(),
  };
}

function voteWithLock(
  session: VotingSession,
  token: string,
  option: "sim" | "nao"
) {
  return withSessionLock(session.session_id, () =>
    processVote(session, formatCastVote(token, option))
  );
}

describe("withSessionLock — concurrency", () => {
  it("processes parallel votes of distinct tokens without corrupting the score", async () => {
    const TOTAL = 40;
    const session = createSessionWithTokens(TOTAL);

    const results = await Promise.all(
      session.authorized_tokens.map((token, i) =>
        voteWithLock(session, token, i % 2 === 0 ? "sim" : "nao")
      )
    );

    const successes = results.filter((r) => r.success);
    expect(successes).toHaveLength(TOTAL);
    expect(session.current_score.sim + session.current_score.nao).toBe(TOTAL);
    expect(session.current_score.sim).toBe(TOTAL / 2);
    expect(session.current_score.nao).toBe(TOTAL / 2);
    expect(session.votes_cast).toHaveLength(TOTAL);
    expect(session.voted_tokens).toHaveLength(TOTAL);
  });

  it("rejects parallel duplicate votes from the same token (only 1 accepted)", async () => {
    const session = createSessionWithTokens(1);
    const token = session.authorized_tokens[0];
    const PARALLEL_ATTEMPTS = 30;

    const results = await Promise.all(
      Array.from({ length: PARALLEL_ATTEMPTS }, () =>
        voteWithLock(session, token!, "sim")
      )
    );

    const successes = results.filter((r) => r.success);
    const duplicates = results.filter(
      (r) => !r.success && r.error.code === "VOTO_DUPLICADO"
    );

    expect(successes).toHaveLength(1);
    expect(duplicates).toHaveLength(PARALLEL_ATTEMPTS - 1);
    expect(session.current_score.sim).toBe(1);
    expect(session.current_score.nao).toBe(0);
    expect(session.votes_cast).toHaveLength(1);
  });
});
