const BASE_URL = "http://localhost:3001";
const SESSAO_ID = `teste-${Date.now()}`;
const TOTAL_VOTOS = 20;

const tokens = Array.from(
  { length: TOTAL_VOTOS },
  (_, i) => `token-teste-valido-${String(i).padStart(16, "0")}`
);

async function criarSessao() {
  const res = await fetch(`${BASE_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: SESSAO_ID,
      tokens_autorizados: tokens,
      opcoes: ["sim", "nao"],
    }),
  });
  const json = await res.json();
  console.log("Criação da sessão:", json);
  return tokens;
}

async function votar(token, opcao) {
  const res = await fetch(`${BASE_URL}/api/sessions/${SESSAO_ID}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, opcao: opcao.toLowerCase() }),
  });
  const json = await res.json();
  if (!json.success) console.log(`[${token}]`, JSON.stringify(json));
  return json;
}


async function main() {
  console.log(`Sessão: ${SESSAO_ID}`);
  console.log("Criando sessão...");
  await criarSessao();

  console.log(`\n--- Teste de ${TOTAL_VOTOS} votos simultâneos ---`);
  const inicio = Date.now();

  const resultados = await Promise.all(
    tokens.map((token, i) => votar(token, i % 2 === 0 ? "sim" : "nao"))
  );

  const duracao = Date.now() - inicio;
  const sucessos = resultados.filter((r) => r.success).length;
  const erros = resultados.filter((r) => !r.success);

  console.log(`\nResultado em ${duracao}ms:`);
  console.log(`  Votos aceitos: ${sucessos} / ${TOTAL_VOTOS}`);
  console.log(`  Esperado SIM: 10, NAO: 10`);

  if (erros.length > 0) {
    console.log(`  Erros inesperados:`);
    erros.forEach((e) => console.log(`    -`, JSON.stringify(e)));
  }

  const sessao = await fetch(`${BASE_URL}/sessions/${SESSAO_ID}`).then((r) =>
    r.json()
  );
  console.log(`\nPlacar final:`, sessao.placar_atual);
  console.log(`Total votaram: ${sessao.total_votaram} / ${sessao.total_autorizados}`);

  const placarOk =
    sessao.total_votaram === TOTAL_VOTOS && sucessos === TOTAL_VOTOS;
  console.log(
    `\n${placarOk ? "✅ TRAVAS FUNCIONANDO" : "❌ PROBLEMA DE CONCORRÊNCIA DETECTADO"}`
  );

}

main().catch(console.error);