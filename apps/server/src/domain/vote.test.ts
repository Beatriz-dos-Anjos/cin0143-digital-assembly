import { parseCastVote, isCastVoteFormat } from "./vote-parser";
import { processVote } from "./vote-validator"
import { SessaoVotacao } from "./types";

function createTestSession(): SessaoVotacao {
  return {
    sessao_id: "test-session",
    placar_atual: { opcao_A: 0, opcao_B: 0 },
    tokens_autorizados: ["TK_USER1", "TK_USER2"],
    tokens_que_ja_votaram: [],
  };
}

describe("vote-parser", () => {
  it("aceita payload no formato CAST_VOTE|<token>|<opcao>", () => {
    const parsed = parseCastVote("CAST_VOTE|TK_USER1|opcao_A");
    expect(parsed).toEqual({ token: "TK_USER1", opcao: "opcao_A" });
  });

  it("rejeita payload malformado", () => {
    expect(parseCastVote("VOTE|TK_USER1|opcao_A")).toBeNull();
    expect(parseCastVote("CAST_VOTE|TK_USER1")).toBeNull();
    expect(parseCastVote("")).toBeNull();
    expect(isCastVoteFormat("invalid")).toBe(false);
  });
});

describe("vote-validator", () => {
  it("registra voto válido e incrementa placar", () => {
    const sessao = createTestSession();
    const result = processVote(sessao, "CAST_VOTE|TK_USER1|opcao_A");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.placar.opcao_A).toBe(1);
      expect(result.placar.opcao_B).toBe(0);
    }
    expect(sessao.tokens_que_ja_votaram).toContain("TK_USER1");
  });

  it("bloqueia token não autorizado", () => {
    const sessao = createTestSession();
    const result = processVote(sessao, "CAST_VOTE|TK_INTRUSO|opcao_B");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TOKEN_NAO_AUTORIZADO");
    }
  });

  it("bloqueia voto duplicado", () => {
    const sessao = createTestSession();
    processVote(sessao, "CAST_VOTE|TK_USER1|opcao_A");
    const result = processVote(sessao, "CAST_VOTE|TK_USER1|opcao_B");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VOTO_DUPLICADO");
    }
  });
});