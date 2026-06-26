/**
 * Camada de comunicação em tempo real (simulada).
 *
 * No ambiente real, a Entrega 1/2 expõe um servidor WebSocket/Socket.io que mantém
 * a sessão em memória e faz broadcast do placar. Aqui simulamos esse "servidor"
 * no próprio cliente usando:
 *   - localStorage  -> estado compartilhado e persistente da sessão (em memória do servidor)
 *   - BroadcastChannel -> canal de broadcast em tempo real entre as abas/telas
 *
 * Para plugar no back-end real, basta substituir `castVote` por um `socket.emit`
 * e `subscribe` por um `socket.on("placar_atualizado", ...)`. A interface pública
 * deste módulo (tipos + funções) permanece a mesma.
 */

export type Opcao = "SIM" | "NAO"

export interface Placar {
  SIM: number
  NAO: number
}

export interface SessaoState {
  sessao_id: string
  placar_atual: Placar
  tokens_que_ja_votaram: string[]
  iniciada_em: number // timestamp (ms)
  duracao_segundos: number
}

export interface CastVoteResult {
  ok: boolean
  /** código de erro retornado pelo "servidor" quando o voto é rejeitado */
  error?: "TOKEN_INVALIDO" | "VOTO_DUPLICADO" | "SESSAO_ENCERRADA"
  mensagem?: string
}

export const DURACAO_SEGUNDOS = 180

/** Lista de tokens autorizados (em produção, isto vive no servidor). */
export const TOKENS_AUTORIZADOS: string[] = Array.from(
  { length: 30 },
  (_, i) => `DELEGADO-${String(i + 1).padStart(3, "0")}`,
)

function gerarSessaoId(): string {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = String(hoje.getMonth() + 1).padStart(2, "0")
  const dia = String(hoje.getDate()).padStart(2, "0")
  return `ASSEMBLEIA-${ano}-${mes}-${dia}`
}

export const SESSAO_ID = gerarSessaoId()

const STORAGE_KEY = "assembleia:sessao"
const CHANNEL_NAME = "assembleia:broadcast"

type Listener = (state: SessaoState) => void

const listeners = new Set<Listener>()
let channel: BroadcastChannel | null = null

function isBrowser() {
  return typeof window !== "undefined"
}

function estadoInicial(): SessaoState {
  return {
    sessao_id: gerarSessaoId(),
    placar_atual: { SIM: 0, NAO: 0 },
    tokens_que_ja_votaram: [],
    iniciada_em: Date.now(),
    duracao_segundos: DURACAO_SEGUNDOS,
  }
}

function lerEstado(): SessaoState {
  if (!isBrowser()) return estadoInicial()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const inicial = estadoInicial()
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inicial))
      return inicial
    }

    const salvo = JSON.parse(raw) as SessaoState

    if (salvo.sessao_id !== gerarSessaoId()) {
      const nova = estadoInicial()
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nova))
      return nova
    }

    return salvo
  } catch {
    return estadoInicial()
  }
}

function gravarEstado(state: SessaoState) {
  if (!isBrowser()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function getChannel(): BroadcastChannel | null {
  if (!isBrowser() || typeof BroadcastChannel === "undefined") return null
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent<SessaoState>) => {
      notificarLocal(event.data)
    }
  }
  return channel
}

function notificarLocal(state: SessaoState) {
  listeners.forEach((l) => l(state))
}

/** Faz o broadcast do placar (servidor -> todos os clientes conectados). */
function broadcast(state: SessaoState) {
  gravarEstado(state)
  getChannel()?.postMessage(state)
  notificarLocal(state)
}

/** Retorna os segundos restantes da sessão (0 = encerrada). */
export function segundosRestantes(state: SessaoState): number {
  const decorrido = Math.floor((Date.now() - state.iniciada_em) / 1000)
  return Math.max(0, state.duracao_segundos - decorrido)
}

export function sessaoEncerrada(state: SessaoState): boolean {
  return segundosRestantes(state) <= 0
}

export function totalVotos(placar: Placar): number {
  return placar.SIM + placar.NAO
}

export function percentual(valor: number, total: number): number {
  if (total <= 0) return 0
  return (valor / total) * 100
}

/** Lê o estado atual da sessão. */
export function getEstado(): SessaoState {
  return lerEstado()
}

/**
 * Processa o comando CAST_VOTE|<token>|<opcao>.
 * Replica a validação do servidor: token autorizado + voto único + sessão aberta.
 */
export function castVote(token: string, opcao: Opcao): CastVoteResult {
  const tokenNormalizado = token.trim().toUpperCase()
  const state = lerEstado()

  // protocolo central: CAST_VOTE|<token>|<opcao>
  console.log(`[v0] CAST_VOTE|${tokenNormalizado}|${opcao}`)

  if (sessaoEncerrada(state)) {
    console.log("[v0] Voto rejeitado: SESSAO_ENCERRADA")
    return { ok: false, error: "SESSAO_ENCERRADA", mensagem: "A sessão de votação já foi encerrada." }
  }

  if (!TOKENS_AUTORIZADOS.includes(tokenNormalizado)) {
    console.log("[v0] Voto rejeitado: TOKEN_INVALIDO")
    return { ok: false, error: "TOKEN_INVALIDO", mensagem: "Token não autorizado para esta assembleia." }
  }

  if (state.tokens_que_ja_votaram.includes(tokenNormalizado)) {
    console.log("[v0] Voto rejeitado: VOTO_DUPLICADO")
    return { ok: false, error: "VOTO_DUPLICADO", mensagem: "Este token já registrou um voto." }
  }

  // voto válido -> computa e faz broadcast do novo placar
  const novoEstado: SessaoState = {
    ...state,
    placar_atual: {
      ...state.placar_atual,
      [opcao]: state.placar_atual[opcao] + 1,
    },
    tokens_que_ja_votaram: [...state.tokens_que_ja_votaram, tokenNormalizado],
  }

  broadcast(novoEstado)
  console.log("[v0] Voto computado. Placar:", novoEstado.placar_atual)
  return { ok: true }
}

/** Reinicia a sessão (modo demonstração). */
export function reiniciarSessao(): SessaoState {
  const inicial = estadoInicial()
  broadcast(inicial)
  return inicial
}

/**
 * Inscreve um listener para receber atualizações do placar em tempo real.
 * Retorna uma função de cleanup.
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  getChannel() // garante que o canal está ativo

  // também escuta mudanças vindas de outras abas via storage (fallback)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        notificarLocal(JSON.parse(e.newValue) as SessaoState)
      } catch {
        /* ignora */
      }
    }
  }
  if (isBrowser()) window.addEventListener("storage", onStorage)

  return () => {
    listeners.delete(listener)
    if (isBrowser()) window.removeEventListener("storage", onStorage)
  }
}