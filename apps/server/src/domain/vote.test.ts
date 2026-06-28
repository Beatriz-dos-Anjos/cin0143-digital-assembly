import { parseCastVote, isCastVoteFormat, formatCastVote } from "./vote-parser";
import { processVote } from "./vote-validator";
import { VotingSession } from "./types";

const TOKEN_USER1 = "a".repeat(32);
const TOKEN_USER2 = "b".repeat(32);
const TOKEN_INTRUSO = "c".repeat(32);

function createTestSession(): VotingSession {
  return {
    session_id: "test-session",
    current_score: { sim: 0, no: 0 },
    authorized_tokens: [TOKEN_USER1, TOKEN_USER2],
    voted_tokens: [],
    votes_cast: [],
    created_at: "2026-06-21 00:00:00",
    started_at: Date.now(),
  };
}

describe("vote-parser", () => {
  it("accepts payload in format CAST_VOTE|<token>|<option>", () => {
    const parsed = parseCastVote(formatCastVote(TOKEN_USER1, "sim"));
    expect(parsed).toEqual({ token: TOKEN_USER1, option: "sim" });
  });

  it("rejects malformed payload", () => {
    expect(parseCastVote("VOTE|TK_USER1|sim")).toBeNull();
    expect(parseCastVote("CAST_VOTE|TK_USER1")).toBeNull();
    expect(parseCastVote("")).toBeNull();
    expect(isCastVoteFormat("invalid")).toBe(false);
  });
});

describe("vote-validator", () => {
  it("registers valid vote and increments score", () => {
    const session = createTestSession();
    const result = processVote(session, formatCastVote(TOKEN_USER1, "sim"));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.score.sim).toBe(1);
      expect(result.score.no).toBe(0);
    }
    expect(session.voted_tokens).toContain(TOKEN_USER1);
  });

  it("blocks unauthorized token", () => {
    const session = createTestSession();
    const result = processVote(session, formatCastVote(TOKEN_INTRUSO, "nao"));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("UNAUTHORIZED_TOKEN");
    }
  });

  it("blocks duplicate vote", () => {
    const session = createTestSession();
    processVote(session, formatCastVote(TOKEN_USER1, "sim"));
    const result = processVote(session, formatCastVote(TOKEN_USER1, "nao"));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("DUPLICATE_VOTE");
    }
  });
});
