# 🗳️ CIN0143 — Digital Assembly Voting System

Sistema de votação digital distribuído para assembleias de condomínios ou corporativas, com suporte a múltiplos clientes simultâneos e sessões em tempo real.

---

## 🔍 Visão Geral

Este repositório contém a arquitetura, a documentação e o esqueleto base de um **Sistema de Votação Digital para Assembleias**, projetado para:

- Gerenciar sessões de votação em tempo real
- Suportar múltiplos clientes conectados concorrentemente
- Garantir integridade e unicidade dos votos por token

---

## 🛠️ Stack & Justificativa Arquitetural

### Visão Full Stack

| Camada | Tecnologia | Papel |
|---|---|---|
| **Frontend** | React + Next.js | UI de votação e painel de monitoramento em tempo real |
| **Backend** | Node.js + Express.js | API HTTP, gerenciamento de sessões e roteamento |
| **WebSocket** | Socket.io | Canal de comunicação bidirecional em tempo real |
| **Linguagem** | TypeScript | Tipagem estática em todo o monorepo (front + back) |
| **Testes Unitários** | Jest | Validação de regras de domínio e lógica de negócio |
| **Testes de Carga** | K6 | Stress e concorrência de conexões WebSocket |

### Estrutura Monorepo

O projeto é organizado como um **monorepo**, separando claramente as responsabilidades:

```
apps/
├── web/      # Next.js — interface de votação e monitor de placar
└── server/   # Node.js + Express + Socket.io — lógica central e estado
```

> A escolha pelo monorepo permite compartilhar tipos TypeScript entre frontend e backend, garantindo consistência nos contratos de mensagem (ex.: o formato `CAST_VOTE|<token>|<opcao>` é tipado uma única vez e reutilizado em ambas as camadas).

### Por que Socket.io em vez de raw sockets?

**Comunicação orientada a eventos e assíncrona** — WebSockets habilitam comunicação full-duplex e não-bloqueante, ideal para aplicações em tempo real onde clientes operam sem aguardar respostas síncronas.

**Baixo acoplamento via orientação a mensagens** — o paradigma de troca de mensagens mantém os clientes completamente desacoplados entre si. O servidor propaga atualizações sem necessidade de conhecer a infraestrutura individual de cada cliente.

### Trade-offs

| Prós | Contras |
|---|---|
| Suporte nativo a broadcasting em massa | Estado centralizado na memória do servidor (bottleneck) |
| Reconexão automática em caso de falha de rede | Single Point of Failure (SPOF) em escala horizontal massiva |
| Propagação de dados desacoplada | Sujeito a race conditions sob alta concorrência |

> ⚠️ O impacto do SPOF e do bottleneck de processamento será analisado em testes de carga futuros.

---

## 📡 Protocolo de Comunicação

### Cliente → Servidor: Comando de Voto

O cliente deve emitir o evento `cast_vote` com um payload textual delimitado por `|`:

```
CAST_VOTE|<token>|<opcao>
```

**Exemplo:**

```
CAST_VOTE|TK_USER_9942|opcao_A
```

### Servidor → Cliente: Notificação de Broadcast

Ao registrar um voto com sucesso, o servidor emite imediatamente um payload JSON com o estado atualizado para o canal:

```
placar_atualizado_${sessao_id}
```

Todos os consoles de monitoramento conectados recebem a atualização via `io.emit()`.

---

## 💾 Modelagem de Estado em Memória

O servidor é a **única fonte de verdade**, mantendo as sessões ativas em memória volátil com o seguinte esquema:

```json
{
  "sessao_id": "string",
  "placar_atual": {
    "opcao_A": "number",
    "opcao_B": "number"
  },
  "tokens_autorizados": ["string"],
  "tokens_que_ja_votaram": ["string"]
}
```

| Campo | Descrição |
|---|---|
| `sessao_id` | Identificador único da assembleia em curso |
| `placar_atual` | Contador em tempo real mapeando opções para totais de votos |
| `tokens_autorizados` | Lista de controle de acesso (ACL) com tokens autorizados a votar |
| `tokens_que_ja_votaram` | Ledger antifraude com tokens que já submeteram um voto |

---

## ⚙️ Regras de Domínio & Lógica de Validação

Ao receber um payload no listener `cast_vote`, o backend executa um funil de verificação sequencial:

```
Payload recebido
      │
      ▼
┌─────────────────────────────────────────┐
│  Format Check                           │
│  Conforma com CAST_VOTE|<token>|<opcao>?│
└──────────────────┬──────────────────────┘
                   │ ✅
                   ▼
┌─────────────────────────────────────────┐
│  Step 1 — Autenticação                  │
│  <token> existe em tokens_autorizados?  │
└──────────────────┬──────────────────────┘
                   │ ✅
                   ▼
┌─────────────────────────────────────────┐
│  Step 2 — Controle de Duplicatas        │
│  <token> já está em                     │
│  tokens_que_ja_votaram?                 │
└──────────────────┬──────────────────────┘
                   │ ❌ (não votou ainda)
                   ▼
┌─────────────────────────────────────────┐
│  Step 3 — Commit & Registro             │
│  Incrementa placar_atual[opcao]         │
│  Adiciona token a tokens_que_ja_votaram │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Step 4 — Broadcast                     │
│  io.emit() → placar_atualizado_sessao   │
└─────────────────────────────────────────┘
```

> Qualquer falha em uma etapa retorna uma mensagem de erro ao cliente e **interrompe** o pipeline.

---

## 🧪 Testes & Verificação

> 🚧 Esta seção descreve o planejamento arquitetural para QA — a implementação será desenvolvida nas próximas entregas.

### Ferramentas

| Ferramenta | Camada | Finalidade |
|---|---|---|
| **Jest** | Unitário / Integração | Testar parsers, validadores e regras de domínio isoladamente |
| **K6** | Carga & Concorrência | Simular centenas de clientes WebSocket simultâneos |

---

### ✅ Testes Unitários com Jest

Os testes unitários cobrem as regras de domínio do pipeline de validação de forma isolada, sem dependência de rede ou estado externo.

**Executar:**

```bash
npm run test
```

**Cenários planejados:**

| Cenário | Descrição | Resultado Esperado |
|---|---|---|
| **A — Happy Path** | Token válido vota em opção válida | Placar incrementado, token registrado, broadcast emitido |
| **B — Fraude (double vote)** | Token válido submete `CAST_VOTE` duas vezes | Bloqueado no Step 2 — erro retornado |
| **C — Intrusão** | Token não listado tenta votar | Bloqueado no Step 1 — erro retornado |
| **D — Payload malformado** | String fora do formato `CAST_VOTE\|<token>\|<opcao>` | Rejeitado no Format Check |

**Exemplo de estrutura de teste:**

```ts
describe('VoteValidator', () => {
  it('should accept a valid vote from an authorized token', () => { ... });
  it('should reject a duplicate vote from the same token', () => { ... });
  it('should reject an unauthorized token', () => { ... });
  it('should reject a malformed payload string', () => { ... });
});
```

---

### ⚡ Testes de Carga & Concorrência com K6

O K6 será utilizado para simular alta concorrência de clientes WebSocket e identificar gargalos no event loop do servidor.

**Executar:**

```bash
k6 run tests/load/voting-stress.js
```

**Metas do cenário de stress:**

| Parâmetro | Valor Alvo |
|---|---|
| Clientes WebSocket simultâneos | 100+ |
| Janela de disparo | Mesma janela de milissegundos |
| Duração do teste | 60s |
| Taxa de erros aceitável | < 1% |

**O que será monitorado:**

- Race conditions no acesso concorrente ao estado em memória
- Latência do event loop sob carga (p95, p99)
- Consistência do placar após múltiplos votos simultâneos
- Comportamento do servidor ao receber tokens duplicados em paralelo

---

## 🚀 Como Executar

### Pré-requisitos

- Node.js 18+
- npm ou yarn

### Instalação

Clone o repositório e instale as dependências de todo o monorepo:

```bash
npm install
```

### Desenvolvimento

**Rodar frontend e backend simultaneamente:**

```bash
npm run dev
```

**Rodar apenas o backend (Express + Socket.io):**

```bash
npm run dev --workspace=apps/server
```

**Rodar apenas o frontend (Next.js):**

```bash
npm run dev --workspace=apps/web
```

| Serviço | URL padrão |
|---|---|
| Frontend (Next.js) | `http://localhost:3000` |
| Backend (Express + Socket.io) | `http://localhost:4000` |

### Testes

```bash
# Testes unitários (Jest)
npm run test

# Testes de carga (K6) — requer K6 instalado globalmente
k6 run tests/load/voting-stress.js
```

---

## 📂 Estrutura de Diretórios

```
├── apps/
│   ├── web/                        # Frontend — Next.js + React
│   │   ├── app/                    # App Router (pages e layouts)
│   │   ├── components/             # Componentes de UI (painel de votação, placar)
│   │   └── lib/                    # Cliente Socket.io e hooks de tempo real
│   │
│   └── server/                     # Backend — Node.js + Express + Socket.io
│       └── src/
│           ├── domain/             # Parsers, validadores e regras de negócio
│           ├── repository/         # Estado efêmero em memória (sessões ativas)
│           └── server.ts           # Entry point — Express + Socket.io
│
├── tests/
│   └── load/
│       └── voting-stress.js        # Script de carga K6
│
├── package.json                    # Workspaces do monorepo
└── README.md
```

---

## 📄 Licença

Projeto acadêmico — CIN0143.
