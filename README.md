# CIN0143 - Digital Assembly Voting System

Sistema de votação digital distribuído para assembleias de condomínios ou corporativas, com suporte a múltiplos clientes simultâneos e sessões em tempo real.

##  Visão Geral

Este repositório contém a arquitetura, a documentação e o esqueleto base de um **Sistema de Votação Digital para Assembleias**, projetado para:

- Gerenciar sessões de votação em tempo real
- Suportar múltiplos clientes conectados concorrentemente
- Garantir integridade e unicidade dos votos por token

---

##  Stack & Justificativa Arquitetural

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

O projeto é organizado como um **monorepo**, separando claramente as responsabilidades

* A estrutura está descrita detalhadamente no final do README
-> A escolha pelo monorepo permite compartilhar tipos TypeScript entre frontend e backend, garantindo consistência nos contratos de mensagem.
  
## Arquitetura Cliente-Servidor

### Visão Geral

O sistema segue uma arquitetura **Cliente Servidor**:
- **Cliente**: Interface e validação UX 
- **Servidor**: Validação real, autorização, estado

### Diagrama de Arquitetura

┌──────────────────────────┐     WebSocket      ┌──────────────────────────┐
│  FRONTEND                │   (Socket.io)      │  BACKEND                 │
│  (React + Next.js)       │◄────────────────►  │  (Node.js + Express)     │
│                          │                    │                          │
│ RESPONSABILIDADES:       │  CAST_VOTE|...     │ RESPONSABILIDADES:       │
│ • Renderizar UI          │ ────────────────►  │ • Parse & validar        │
│ • Capturar entrada       │                    │ • Autenticar token       │
│ • Validação UX (campo)   │  placar_atual      │ • Bloquear voto duplo    │
│ • Enviar comando         │ ◄──────────────    │ • Registrar voto         │
│ • Receber updates        │                    │ • Broadcast updates      │
│ • Renderizar placar      │                    │ • Armazenar estado       │
│                          │                    │                          │
│ NÃO FAZ:                 │                    │ SEMPRE:                  │
│ • Validar autorização    │                    │ • Autoridade final       │
│ • Armazenar estado       │                    │ • Única fonte de verdade │
│ • Decidir voto válido    │                    │ • Garante atomicidade    │
└──────────────────────────┘                    └──────────────────────────┘

## Por que Socket.io para o Sistema de Votação?
 
Comunicação orientada a eventos e bidirecional em tempo real : WebSockets habilitam comunicação full-duplex e não-bloqueante, essencial para uma votação distribuída onde múltiplos clientes precisam receber atualizações do placar instantaneamente conforme os votos chegam ao servidor.
 
Baixo acoplamento via orientação a mensagens : o paradigma de troca de mensagens mantém os clientes completamente desacoplados entre si. O servidor propaga as atualizações de placar sem necessidade de conhecer a infraestrutura individual de cada cliente, permitindo que qualquer número de participantes se conecte e receba o placar sincronizado.
 
Controle centralizado de sessão de votação : Socket.io vincula cada cliente a uma sessão persistente no servidor, permitindo validar tokens e rastrear quem já votou de forma segura. O servidor garante que um token jamais vote duas vezes, mesmo sob alta concorrência.

 
## Por que WebSocket em vez de MQTT?
 
WebSocket (Socket.io) garante validação dos votos  em um único servidor centralizado, impedindo race conditions. MQTT seria assíncrono e desacoplado, tornando difícil garantir que um token não vota duas vezes em alta concorrência. Além disso, Socket.io oferece **broadcast nativo de baixíssima latência** para sincronizar o placar em tempo real para todos os clientes, enquanto MQTT exigiria roteamento por tópicos através de um broker separado.

---
##  Protocolo de Comunicação e Especificação de Payloads
 
A comunicação entre o Cliente e o Servidor  (Express/Socket.io) é orientada a eventos (**Event Driven**) e estruturada sob os seguintes contratos de mensagem:
 
---
 
### 1. Evento: `cast_vote` - Client → Server
 
| Campo | Valor |
|---|---|
| **Descrição** | Disparado pelo cliente para submeter um voto na assembleia |
| **Tipo de Dado** | String de texto simples (Textual Pleno) |
| **Delimitador** | `\|` (Pipeline) |
| **Formato Estrito** | `CAST_VOTE\|<token>\|<opcao>` |
| **Exemplo de Payload** | `CAST_VOTE\|TK_CONDOMINO_450\|opcao_B` |
 
---
 
### 2. Evento: `placar_atualizado` - Server → Broadcast (todos os clientes)
 
| Campo | Valor |
|---|---|
| **Descrição** | Disparado pelo servidor imediatamente após o registro bem-sucedido de um voto válido |
| **Tipo de Dado** | Objeto JSON |
| **Canal** | `placar_atualizado_${sessao_id}` |
 
**Exemplo de Payload:**
 
```json
{
  "opcao_A": 4,
  "opcao_B": 2
}
```
``
USUÁRIO                     CLIENTE                    SERVIDOR
  │                           │                          │
  ├─ Clica "Votar A"──────►   │                          │
  │                           ├─ Valida UX───────────┐   │
  │                           │                       │   │
  │                           │ (Token preenchido?)   │   │
  │                           │ (Opção selecionada?) │   │
  │                           │                       │   │
  │                           │ Passou ──────────►│   │
  │                           │                       │   ├─ Emit 'cast_vote'
  │                           │                       │   │  CAST_VOTE|TK_001|opcao_A
  │                           │                       │   │
  │                           │                       │   ├─ Parse payload
  │                           │                       │   ├─ Valida servidor
  │                           │                       │   ├─ (Token autorizado?)
  │                           │                       │   ├─ (Já votou?)
  │                           │                       │   ├─ (Opção existe?)
  │                           │                       │   │
  │                           │                       │   ├─ Commit
  │                           │                       │   ├─ Incrementa placar
  │                           │                       │   ├─ Broadcast
  │                           │                       │   │
  │◄────────────────────────────────────────────────────┤ emit 'placar_atualizado'
  │     Servidor envia        ◄─ Socket escuta       │
  │     {opcao_A: 5}             e atualiza UI      │
  │                           │
  ├─ Vê placar atualizado     │
  │
```


##  Modelagem de Estado em Memória

O servidor mantém as sessões ativas em memória volátil com o seguinte esquema:

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
## Como Inicializar uma Sessão

POST /api/sessions
Content-Type: application/json

{
  "session_id": "ASSEMBLY_CONDOMINIO_JAN_2027",
  "opcoes": ["opcao_A", "opcao_B"],
  "tokens_autorizados": ["TK_001", "TK_002", "TK_003"]
}

Response: 201
{ "session_id": "...", "status": "OPEN" }

---

| Campo | Descrição |
|---|---|
| `sessao_id` | Identificador único da assembleia em curso |
| `placar_atual` | Contador em tempo real mapeando opções para totais de votos |
| `tokens_autorizados` | Lista de controle de acesso com tokens autorizados a votar |
| `tokens_que_ja_votaram` | Ledger antifraude com tokens que já submeteram um voto |

---

## Regras de Domínio & Lógica de Validação

Ao receber um payload no listener `cast_vote`, o backend executa um funil de verificação sequencial:

```
Payload recebido
      │
      ▼
┌─────────────────────────────────────────┐
│  Format Check                           │
│  Conforma com CAST_VOTE|<token>|<opcao>?│
└──────────────────┬──────────────────────┘
                   │ 
                   ▼
┌─────────────────────────────────────────┐
│  Step 1 - Autenticação                  │
│  <token> existe em tokens_autorizados?  │
└──────────────────┬──────────────────────┘
                   │ 
                   ▼
┌─────────────────────────────────────────┐
│  Step 2 - Controle de Duplicatas        │
│  <token> já está em                     │
│  tokens_que_ja_votaram?                 │
└──────────────────┬──────────────────────┘
                   │ (não votou ainda)
                   ▼
┌─────────────────────────────────────────┐
│  Step 3 -  Registro             │
│  Incrementa placar_atual[opcao]         │
│  Adiciona token a tokens_que_ja_votaram │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Step 4 - Broadcast                     │
│  e placar_atualizado_sessao   │
└─────────────────────────────────────────┘
```

> Qualquer falha em uma etapa retorna uma mensagem de erro ao cliente e **interrompe** o pipeline.

## Eventos de Erro (Server → Client)

| Evento | Payload | Quando |
|--------|---------|--------|
| cast_vote_error | {"error": "unauthorized"} | Token não autorizado |
| cast_vote_error | {"error": "duplicate_vote"} | Token já votou |
| cast_vote_error | {"error": "invalid_format"} | Payload malformado |

---
---

##  Testes & Verificação


### Ferramentas

| Ferramenta | Camada | Finalidade |
|---|---|---|
| **Jest** | Unitário / Integração | Testar validadores e regras de domínio isoladamente |
| **K6** | Carga & Concorrência | Simular clientes WebSocket simultâneos |

---

### Testes Unitários com Jest

Os testes unitários cobrem as regras de domínio do pipeline de validação de forma isolada.

**Executar:**

```bash
npm run test:coverage
```

**Cenários planejados:**

| Cenário | Descrição | Resultado Esperado |
|---|---|---|
| **A - Happy Path** | Token válido vota em opção válida | Placar incrementado, token registrado, broadcast emitido |
| **B - Fraude (double vote)** | Token válido submete `CAST_VOTE` duas vezes | Erro retornado (Passo 2) |
| **C - Intrusão** | Token não listado tenta votar |Erro retornado (Passo 1) |
| **D - Payload malformado** | String fora do formato `CAST_VOTE\|<token>\|<opcao>` | Rejeitado no Format Check |


###  Testes de Carga & Concorrência com K6

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
- Consistência do placar após múltiplos votos simultâneos
- Comportamento do servidor ao receber tokens duplicados em paralelo

---

##  Como Executar

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
npm run dev 
```

**Rodar apenas o frontend (Next.js):**

```bash
npm run dev 
```

| Serviço | URL padrão |
|---|---|
| Frontend (Next.js) | `http://localhost:3000` |
| Backend (Express + Socket.io) | `http://localhost:3001` |


##  Autenticação em Memória & Prevenção de Fraude (Funil de Verificação por Token)
 
### Estratégia de Autenticação por Token
 
Para o escopo atual da arquitetura, o sistema evita handshakes persistentes ou consultas externas de sessão. A identidade é verificada **evento a evento**:
 
- O identificador único do cliente (Token) é embutido diretamente na string do payload
- A cada clique no botão de votação, o cliente transmite o texto estrito: `CAST_VOTE|<token>|<opcao>`
- O servidor analisa e processa os dados em tempo real: ao receber o evento, abre o envelope, isola o <token> e executa imediatamente as regras de domínio.

---
 
### Registros Voláteis em Memória
 
Para gerenciar o rastreamento sem infraestrutura de banco de dados, o backend Express/Socket.io mantém as seguintes estruturas em tempo de execução:
 
| Estrutura | Tipo | Inicialização | Papel |
|---|---|---|---|
| `tokens_autorizados` | `string[]` | Populado no servidor | Registro de controle de acesso - lista todos os tokens legalmente registrados na sessão (ex.: `['TK_USER1', 'TK_USER2', 'TK_USER3']`) |
| `tokens_que_ja_votaram` | `string[]` | Inicializado vazio `[]` | Registro antifraude — barreira contra votos duplos, atualizada a cada voto confirmado |
 
---
 
###  Funil de Execução: Lógica Sequencial do Backend
 
Quando uma string de payload  chega pela interface de rede WebSocket, o pipeline de validação sequencial dispara as seguintes operações:
 
```text
Payload de Entrada: "CAST_VOTE|TK_USER1|opcao_A"
              │
              ▼
   ┌────────────────────────────────┐
   │     Parsing da String          │ ──► Separa o payload pelo delimitador '|'
   └────────────────────────────────┘
              │
              ▼
   ┌────────────────────────────────┐
   │  Verificação de Autorização    │ ──► .includes('TK_USER1') em tokens_autorizados
   └────────────────────────────────┘     False: Rejeita com evento "Acesso Negado"
              │ True
              ▼
   ┌────────────────────────────────┐
   │  Bloqueio de Voto Duplo        │ ──► .includes('TK_USER1') em tokens_que_ja_votaram
   └────────────────────────────────┘     True: Rejeita com evento "Fraude Detectada"
              │ False
              ▼
   ┌────────────────────────────────┐
   │  Registro                      │ ──► 1. Incrementa placar_atual['opcao_A'] em +1
   └────────────────────────────────┘     2. Insere 'TK_USER1' em tokens_que_ja_votaram
              │
              ▼
   Broadcast disparado para todos os sockets (placar_atualizado)
```
 
**Detalhamento de cada fase:**
 
**Autenticação:** O backend executa uma busca por índice (`.includes(token)`) sobre o vetor `tokens_autorizados`. Se o identificador estiver ausente, a execução termina imediatamente, disparando um evento de erro de volta apenas ao cliente.
 
**Prevenção de Duplicidade:** O backend verifica se o token extraído já está presente (`.includes(token)`) no bloco histórico `tokens_que_ja_votaram`. Se retornar `true`, a transação é reconhecida como tentativa de fraude e bloqueada.
 
Satisfeitas as condições de execução segura, o token é inserido (`.push(token)`) no registro `tokens_que_ja_votaram`. A partir disso,  qualquer pacote recorrente contendo este token é sistematicamente negado.
 


### Testes

```bash
# Testes unitários (Jest)
npm run test

# Testes de carga (K6)
k6 run tests/load/voting-stress.js
```

---

##  Estrutura de Diretórios

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
