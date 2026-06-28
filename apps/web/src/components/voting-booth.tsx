"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  KeyRound,
  Wifi,
  WifiOff,
} from "lucide-react"
import { ToastContainer, toast } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { type Opcao } from "@/src/lib/assembly"
import { useVoter } from "@/src/hooks/use-voter"
import { useAssembly } from "@/src/hooks/use-assembly"
import { API_URL } from "@/src/lib/api"
import { useCronometro, syncSessionTimer } from "@/src/hooks/use-cronometro"
import {
  ApiRequestError,
  DEFAULT_SESSAO_ID,
  getSession,
  resetSession,
} from "@/src/lib/api"
import { formatarTempo } from "@/src/lib/timer"
import { cn } from "@/src/lib/utils"

const TOKENS_AUTORIZADOS_INICIAIS = [
  "550e8400-e29b-41d4-a716-446655440000",
  "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
  "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
  "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "a987fbc9-4bed-3078-cf07-9141ba07c9f3",
  "b8659fc7-5b65-4c38-8a8b-bedd779e64e9",
  "d9428888-122b-11e1-b85c-61cd3cbb3210",
  "f47ac10b-58cc-4372-a567-0e02b2c3d479",
]

export function VotingBooth() {
  const {
    token,
    setToken,
    feedback,
    votando,
    sessaoId,
    connected,
    gerandoToken,
    gerarToken,
    registrarVoto,
    limparEstado,
    mostrarErro,
  } = useVoter()

  const { state } = useAssembly()

  const [resetKey, setResetKey] = useState(0)
  const { segundosRestantes, encerrada } = useCronometro(resetKey)

  const [tokensList, setTokensList] = useState<string[]>(TOKENS_AUTORIZADOS_INICIAIS)
  const [tokensVotados, setTokensVotados] = useState<string[]>([])

  // Toast ao mudar placar (mesmo mecanismo do painel)
  const placarAnteriorRef = useRef({ SIM: 0, NAO: 0 })
  const primeiroRenderRef = useRef(true)
  const placar = state?.placar_atual ?? { SIM: 0, NAO: 0 }

  useEffect(() => {
    if (primeiroRenderRef.current) {
      primeiroRenderRef.current = false
      placarAnteriorRef.current = { ...placar }
      return
    }

    const anterior = placarAnteriorRef.current

    if (placar.SIM > anterior.SIM) {
      toast.success("Novo voto SIM registrado", { autoClose: 4000 })
    } else if (placar.NAO > anterior.NAO) {
      toast.error("Novo voto NÃO registrado", { autoClose: 4000 })
    }

    placarAnteriorRef.current = { ...placar }
  }, [placar.SIM, placar.NAO])

  useEffect(() => {
    if (token && !tokensList.includes(token)) {
      setTokensList((prev) => [...prev, token])
    }
  }, [token, tokensList])
  function adicionarTokenGerado(novoToken: string) {
    setTokensList((prev) =>
      prev.includes(novoToken) ? prev : [...prev, novoToken],
    )
  }

  async function handleGerarToken() {
    const novoToken = await gerarToken()
    if (novoToken) adicionarTokenGerado(novoToken)
  }

  useEffect(() => {
    let active = true
    async function carregarDadosSessao() {
      if (!connected) return
      try {
        const data = await getSession(sessaoId || DEFAULT_SESSAO_ID)
        if (!active) return

        syncSessionTimer({
          iniciada_em: data.iniciada_em,
          duracao_segundos: data.duracao_segundos,
          sessao_id: data.sessao_id,
        })

        if (data.votos_realizados) {
          const votados = data.votos_realizados.map((v: { token: string }) => v.token)
          setTokensVotados(votados)
        } else {
          setTokensVotados([])
        }
      } catch (err) {
        console.error("Erro ao carregar dados da sessao:", err)
      }
    }

    carregarDadosSessao()
    const interval = setInterval(carregarDadosSessao, 5000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [connected, sessaoId, feedback])

  const desabilitadoVoto =
    encerrada || !connected || gerandoToken || !token || votando !== null
  const desabilitadoGerar =
    encerrada || !connected || gerandoToken || votando !== null

  function handleReiniciar() {
    setResetKey((k) => k + 1)
    setToken("")
  }

  async function gerarNovoToken() {
    if (gerandoToken) return
    await gerarToken()
  async function handleReiniciar() {
    if (reiniciando) return

    limparEstado()
    setTokensVotados([])
    setTokensList([...TOKENS_AUTORIZADOS_INICIAIS])
    setReiniciando(true)

    try {
      const result = await resetSession(sessaoId || DEFAULT_SESSAO_ID)
      syncSessionTimer({
        iniciada_em: result.iniciada_em,
        duracao_segundos: result.duracao_segundos,
        sessao_id: result.sessao_id,
      })
    } catch (error) {
      const mensagem =
        error instanceof ApiRequestError
          ? error.message
          : "Não foi possível reiniciar a sessão no servidor."
      mostrarErro(mensagem)
    } finally {
      setReiniciando(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-10 sm:py-16">
      <ToastContainer
        position="top-right"
        theme="dark"
        pauseOnHover
        closeOnClick
        newestOnTop
        style={{ zIndex: 9999 }}
      />

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar
      </Link>

      <section className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(220 80% 70% / 0.4) 40%, hsl(0 75% 60% / 0.4) 60%, transparent)",
          }}
        />

        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 font-mono text-xs font-semibold tracking-wider text-secondary-foreground">
              {sessaoId ?? "ASSEMBLEIA"}
            </span>

            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums",
                  encerrada ? "text-red-400" : "text-muted-foreground",
                )}
              >
                <Clock className="size-3.5" aria-hidden />
                <span>{formatarTempo(segundosRestantes)}</span>
              </div>

              <ConnectionBadge connected={connected} />
            </div>
          </div>

          <h1 className="mt-6 text-3xl font-black tracking-tight text-card-foreground">
            Cabine de Votação
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Gere um token ou informe outro manualmente. Cada token é válido para um único voto.
          </p>

          <button
            type="button"
            onClick={handleGerarToken}
            disabled={desabilitadoGerar}
            className={cn(
              "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition-all",
              "hover:bg-secondary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <KeyRound className="size-4" aria-hidden />
            {gerandoToken ? "Gerando token…" : "Gerar token para votação"}
          </button>

          <div className="mt-5">
            <label htmlFor="token" className="text-xs font-semibold tracking-wider text-muted-foreground">
              TOKEN
            </label>
            <input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={encerrada || gerandoToken || votando !== null}
              placeholder={gerandoToken ? "Gerando token…" : "Gere ou cole seu token aqui"}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 font-mono text-sm tracking-widest outline-none transition-all placeholder:text-muted-foreground/50 focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/10 disabled:cursor-not-allowed disabled:opacity-40"
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <VoteButton
              opcao="SIM"
              onClick={() => registrarVoto("SIM")}
              disabled={desabilitadoVoto}
              loading={votando === "SIM"}
            />
            <VoteButton
              opcao="NAO"
              onClick={() => registrarVoto("NAO")}
              disabled={desabilitadoVoto}
              loading={votando === "NAO"}
            />
          </div>

          {feedback ? (
            <Aviso
              tone={feedback.tipo}
              icon={
                feedback.tipo === "sucesso" ? (
                  <CheckCircle2 className="size-4" aria-hidden />
                ) : (
                  <AlertCircle className="size-4" aria-hidden />
                )
              }
              titulo={feedback.tipo === "sucesso" ? "Voto confirmado" : "Voto rejeitado"}
              descricao={feedback.mensagem}
            />
          ) : null}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-bold text-card-foreground flex items-center gap-1.5">
          <KeyRound className="size-4 text-blue-500" aria-hidden />
          Tokens Autorizados
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Lista de tokens válidos simulados no backend. Clique em um token disponível para carregá-lo na cabine de votação ou gere um novo.
        </p>

        <button
          type="button"
          disabled={encerrada}
          onClick={handleGerarToken}
          className={cn(
            "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-xs font-semibold text-secondary-foreground transition-all",
            "hover:bg-secondary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <KeyRound className="size-3.5" aria-hidden />
          {gerandoToken ? "Gerando token…" : "Gerar Novo Token Válido"}
        </button>

        <div className="mt-4 max-h-36 overflow-y-auto rounded-xl border border-border bg-background p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tokensList.map((t) => {
              const jaVotou = tokensVotados.includes(t)
              const selecionado = t === token
              return (
                <button
                  key={t}
                  type="button"
                  disabled={encerrada}
                  onClick={() => setToken(t)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 font-mono text-[10px] font-semibold transition-all text-center",
                    selecionado
                      ? jaVotou
                        ? "border-red-500 bg-red-500/10 text-red-400"
                        : "border-blue-500 bg-blue-500/10 text-blue-500"
                      : jaVotou
                        ? "border-red-500/15 bg-red-500/5 text-red-400 hover:border-red-500/40 hover:bg-red-500/10"
                        : "border-border hover:border-foreground/20 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                  {jaVotou && " (votou)"}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between rounded-2xl border border-dashed border-border/60 px-5 py-3.5">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground/50">
          MODO DEMONSTRAÇÃO
        </span>
        <button
          onClick={handleReiniciar}
          disabled={reiniciando}
          className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground underline-offset-4 hover:underline disabled:opacity-50"
        >
          {reiniciando ? "Reiniciando…" : "Reiniciar sessao"}
        </button>
      </div>
    </div>
  )
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider",
        connected
          ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
          : "border-border bg-secondary text-muted-foreground",
      )}
    >
      {connected ? (
        <>
          <Wifi className="size-3" aria-hidden />
          ONLINE
        </>
      ) : (
        <>
          <WifiOff className="size-3" aria-hidden />
          OFFLINE
        </>
      )}
    </div>
  )
}

function VoteButton({
  opcao,
  onClick,
  disabled,
  loading,
}: {
  opcao: Opcao
  onClick: () => void
  disabled: boolean
  loading: boolean
}) {
  const isSim = opcao === "SIM"

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Votar ${isSim ? "SIM" : "NÃO"}`}
      className={cn(
        "group relative flex aspect-3/2 flex-col items-center justify-center overflow-hidden rounded-2xl text-center transition-all duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-40",
        !disabled && "hover:scale-[1.02] active:scale-[0.97]",
        isSim
          ? [
              "bg-blue-600 text-white",
              "focus-visible:outline-blue-500",
              "shadow-[0_4px_24px_hsl(220_80%_55%/0.35)]",
              !disabled && "hover:bg-blue-500 hover:shadow-[0_8px_32px_hsl(220_80%_55%/0.45)]",
            ]
          : [
              "bg-red-500 text-white",
              "focus-visible:outline-red-400",
              "shadow-[0_4px_24px_hsl(0_75%_55%/0.30)]",
              !disabled && "hover:bg-red-400 hover:shadow-[0_8px_32px_hsl(0_75%_55%/0.40)]",
            ],
      )}
    >
      <span className="text-[10px] font-bold tracking-[0.2em] opacity-70">VOTO</span>
      <span className="mt-0.5 text-4xl font-black tracking-tight">
        {loading ? "·  ·  ·" : isSim ? "SIM" : "NÃO"}
      </span>
    </button>
  )
}

function Aviso({
  tone,
  icon,
  titulo,
  descricao,
}: {
  tone: "erro" | "sucesso"
  icon: React.ReactNode
  titulo: string
  descricao: string
}) {
  return (
    <div
      role={tone === "erro" ? "alert" : "status"}
      className={cn(
        "mt-5 flex items-start gap-3 rounded-2xl border p-4",
        tone === "erro"
          ? "border-red-500/20 bg-red-500/8 text-card-foreground"
          : "border-blue-500/20 bg-blue-500/8 text-card-foreground",
      )}
    >
      <span
        className={cn(
          "mt-0.5 shrink-0",
          tone === "erro" ? "text-red-400" : "text-blue-400",
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{descricao}</p>
      </div>
    </div>
  )
}