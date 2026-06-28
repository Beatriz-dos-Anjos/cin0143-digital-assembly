import { formatCastVote } from "./vote-parser";
import { processVote } from "./vote-validator";
import withSessionLock from "./lock.service";
import { SessaoVotacao } from "./types";

function createSessionWithTokens(count: number): SessaoVotacao {
  const tokens = Array.from({ length: count }, (_, i) =>
    `k${String(i).padStart(31, "0")}`
  );

  return {
    sessao_id: "concurrency-test",
    placar_atual: { sim: 0, nao: 0 },
    tokens_autorizados: tokens,
    tokens_que_ja_votaram: [],
    votos_realizados: [],
    criada_em: "2026-06-21 00:00:00",
    iniciada_em: Date.now(),
  };
}

function voteWithLock(
  sessao: SessaoVotacao,
  token: string,
  opcao: "sim" | "nao"
) {
  return withSessionLock(sessao.sessao_id, () =>
    processVote(sessao, formatCastVote(token, opcao))
  );
}

describe("withSessionLock — concorrência", () => {
  it("processa votos paralelos de tokens distintos sem corromper o placar", async () => {
    const TOTAL = 40;
    const sessao = createSessionWithTokens(TOTAL);

    const results = await Promise.all(
      sessao.tokens_autorizados.map((token, i) =>
        voteWithLock(sessao, token, i % 2 === 0 ? "sim" : "nao")
      )
    );

    const sucessos = results.filter((r) => r.success);
    expect(sucessos).toHaveLength(TOTAL);
    expect(sessao.placar_atual.sim + sessao.placar_atual.nao).toBe(TOTAL);
    expect(sessao.placar_atual.sim).toBe(TOTAL / 2);
    expect(sessao.placar_atual.nao).toBe(TOTAL / 2);
    expect(sessao.votos_realizados).toHaveLength(TOTAL);
    expect(sessao.tokens_que_ja_votaram).toHaveLength(TOTAL);
  });

  it("rejeita votos duplicados paralelos do mesmo token (apenas 1 aceito)", async () => {
    const sessao = createSessionWithTokens(1);
    const token = sessao.tokens_autorizados[0];
    const PARALLEL_ATTEMPTS = 30;

    const results = await Promise.all(
      Array.from({ length: PARALLEL_ATTEMPTS }, () =>
        voteWithLock(sessao, token, "sim")
      )
    );

    const sucessos = results.filter((r) => r.success);
    const duplicados = results.filter(
      (r) => !r.success && r.error.code === "VOTO_DUPLICADO"
    );

    expect(sucessos).toHaveLength(1);
    expect(duplicados).toHaveLength(PARALLEL_ATTEMPTS - 1);
    expect(sessao.placar_atual.sim).toBe(1);
    expect(sessao.placar_atual.nao).toBe(0);
    expect(sessao.votos_realizados).toHaveLength(1);
  });
});
