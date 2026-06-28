"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
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
import { type VoteOption } from "@/src/lib/assembly"
import { useVoter } from "@/src/hooks/use-voter"
import { useAssembly } from "@/src/hooks/use-assembly"
import { useTimer, syncSessionTimer } from "@/src/hooks/use-timer"
import {
  ApiRequestError,
  DEFAULT_SESSION_ID,
  getSession,
  resetSession,
} from "@/src/lib/api"
import { formatTime } from "@/src/lib/timer"
import { cn } from "@/src/lib/utils"

const INITIAL_AUTHORIZED_TOKENS = [
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
    voting,
    sessionId,
    connected,
    generatingToken,
    generateToken,
    submitVote,
    clearState,
    showError,
  } = useVoter()

  const { state } = useAssembly()

  const [resetKey, setResetKey] = useState(0)
  const { remainingSeconds, ended } = useTimer(resetKey)

  const [tokensList, setTokensList] = useState<string[]>(INITIAL_AUTHORIZED_TOKENS)
  const [votedTokens, setVotedTokens] = useState<string[]>([])
  const [resetting, setResetting] = useState(false)

  // Toast notification when score changes
  const previousScoreRef = useRef({ sim: 0, nao: 0 })
  const firstRenderRef = useRef(true)
  const score = state?.current_score ?? { sim: 0, nao: 0 }

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      previousScoreRef.current = { ...score }
      return
    }

    const previous = previousScoreRef.current

    if (score.sim > previous.sim) {
      toast.success("New sim vote registered", { autoClose: 4000 })
    } else if (score.nao > previous.nao) {
      toast.error("New nao vote registered", { autoClose: 4000 })
    }

    previousScoreRef.current = { ...score }
  }, [score.sim, score.nao])

  useEffect(() => {
    if (token && !tokensList.includes(token)) {
      setTokensList((prev) => [...prev, token])
    }
  }, [token, tokensList])

  function addGeneratedToken(newToken: string) {
    setTokensList((prev) =>
      prev.includes(newToken) ? prev : [...prev, newToken],
    )
  }

  async function handleGenerateToken() {
    const newToken = await generateToken()
    if (newToken) addGeneratedToken(newToken)
  }

  useEffect(() => {
    let active = true
    async function loadSessionData() {
      if (!connected) return
      try {
        const data = await getSession(sessionId || DEFAULT_SESSION_ID)
        if (!active) return

        syncSessionTimer({
          started_at: data.started_at,
          duration_seconds: data.duration_seconds,
          session_id: data.session_id,
        })

        if (data.votes_cast) {
          const voted = data.votes_cast.map((v: { token: string }) => v.token)
          setVotedTokens(voted)
        } else {
          setVotedTokens([])
        }
      } catch (err) {
        console.error("Error loading session data:", err)
      }
    }

    loadSessionData()
    const interval = setInterval(loadSessionData, 5000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [connected, sessionId, feedback])

  const voteDisabled =
    ended || !connected || generatingToken || !token || voting !== null
  const generateDisabled =
    ended || !connected || generatingToken || voting !== null

  async function handleReset() {
    if (resetting) return

    clearState()
    setVotedTokens([])
    setTokensList([...INITIAL_AUTHORIZED_TOKENS])
    setToken("")
    setResetting(true)

    try {
      const result = await resetSession(sessionId || DEFAULT_SESSION_ID)
      setResetKey((k) => k + 1)
      syncSessionTimer({
        started_at: result.started_at,
        duration_seconds: result.duration_seconds,
        session_id: result.session_id,
      })
    } catch (error) {
      const message =
        error instanceof ApiRequestError
          ? error.message
          : "Could not reset session on the server."
      showError(message)
    } finally {
      setResetting(false)
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
        Back
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
              {sessionId ?? "ASSEMBLY"}
            </span>

            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums",
                  ended ? "text-red-400" : "text-muted-foreground",
                )}
              >
                <Clock className="size-3.5" aria-hidden />
                <span>{formatTime(remainingSeconds)}</span>
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
            onClick={handleGenerateToken}
            disabled={generateDisabled}
            className={cn(
              "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition-all",
              "hover:bg-secondary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <KeyRound className="size-4" aria-hidden />
            {generatingToken ? "Gerando token..." : "Gere um token válido"}
          </button>

          <div className="mt-5">
            <label htmlFor="token" className="text-xs font-semibold tracking-wider text-muted-foreground">
              TOKEN
            </label>
            <input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={ended || generatingToken || voting !== null}
              placeholder={generatingToken ? "Gerando token..." : "Gere ou cole seu token aqui"}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 font-mono text-sm tracking-widest outline-none transition-all placeholder:text-muted-foreground/50 focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/10 disabled:cursor-not-allowed disabled:opacity-40"
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <VoteButton
              option="SIM"
              onClick={() => submitVote("SIM")}
              disabled={voteDisabled}
              loading={voting === "SIM"}
            />
            <VoteButton
              option="NÃO"
              onClick={() => submitVote("NÃO")}
              disabled={voteDisabled}
              loading={voting === "NÃO"}
            />
          </div>

          {feedback ? (
            <Notice
              tone={feedback.type}
              icon={
                feedback.type === "success" ? (
                  <CheckCircle2 className="size-4" aria-hidden />
                ) : (
                  <AlertCircle className="size-4" aria-hidden />
                )
              }
              title={feedback.type === "success" ? "Vote confirmed" : "Vote rejected"}
              description={feedback.message}
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
          disabled={ended}
          onClick={handleGenerateToken}
          className={cn(
            "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-xs font-semibold text-secondary-foreground transition-all",
            "hover:bg-secondary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <KeyRound className="size-3.5" aria-hidden />
          {generatingToken ? "Generando token..." : "Gerando novo token válido"}
        </button>

        <div className="mt-4 max-h-36 overflow-y-auto rounded-xl border border-border bg-background p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tokensList.map((t) => {
              const hasVoted = votedTokens.includes(t)
              const selected = t === token
              return (
                <button
                  key={t}
                  type="button"
                  disabled={ended}
                  onClick={() => setToken(t)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 font-mono text-[10px] font-semibold transition-all text-center",
                    selected
                      ? hasVoted
                        ? "border-red-500 bg-red-500/10 text-red-400"
                        : "border-blue-500 bg-blue-500/10 text-blue-500"
                      : hasVoted
                        ? "border-red-500/15 bg-red-500/5 text-red-400 hover:border-red-500/40 hover:bg-red-500/10"
                        : "border-border hover:border-foreground/20 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                  {hasVoted && " (voted)"}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between rounded-2xl border border-dashed border-border/60 px-5 py-3.5">
        <button
          onClick={handleReset}
          disabled={resetting}
          className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground underline-offset-4 hover:underline disabled:opacity-50"
        >
          {resetting ? "Resetando..." : "Resete a sessão"}
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
  option,
  onClick,
  disabled,
  loading,
}: {
  option: VoteOption
  onClick: () => void
  disabled: boolean
  loading: boolean
}) {
  const issim = option === "SIM"

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Vote ${issim ? "SIM" : "NAO"}`}
      className={cn(
        "group relative flex aspect-3/2 flex-col items-center justify-center overflow-hidden rounded-2xl text-center transition-all duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-40",
        !disabled && "hover:scale-[1.02] active:scale-[0.97]",
        issim
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
      <span className="text-[10px] font-bold tracking-[0.2em] opacity-70">VOTE</span>
      <span className="mt-0.5 text-4xl font-black tracking-tight">
        {loading ? "·  ·  ·" : issim ? "SIM" : "NÃO"}
      </span>
    </button>
  )
}

function Notice({
  tone,
  icon,
  title,
  description,
}: {
  tone: "error" | "success"
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mt-5 flex items-start gap-3 rounded-2xl border p-4",
        tone === "error"
          ? "border-red-500/20 bg-red-500/8 text-card-foreground"
          : "border-blue-500/20 bg-blue-500/8 text-card-foreground",
      )}
    >
      <span
        className={cn(
          "mt-0.5 shrink-0",
          tone === "error" ? "text-red-400" : "text-blue-400",
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}