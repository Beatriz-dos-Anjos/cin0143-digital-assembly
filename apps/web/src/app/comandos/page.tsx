"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Terminal,
  Key,
  ListChecks,
  Gauge,
  Database,
  RefreshCw,
  ChevronRight,
} from "lucide-react"
import { API_URL, DEFAULT_SESSION_ID } from "@/src/lib/api"

type CommandId = "tokens" | "votes" | "placar" | "session"

interface CommandDef {
  id: CommandId
  label: string
  original: string
  description: string
  icon: typeof Key
  endpoint: string
}

const COMMANDS: CommandDef[] = [
  {
    id: "tokens",
    label: "Tokens autorizados",
    original: "list_tokens",
    description: "Tokens ainda aptos a votar.",
    icon: Key,
    endpoint: "/api/tokens",
  },
  {
    id: "votes",
    label: "Votos registrados",
    original: "list_votes",
    description: "Histórico de votos com timestamp.",
    icon: ListChecks,
    endpoint: "/api/votes",
  },
  {
    id: "placar",
    label: "Placar atual",
    original: "placar",
    description: "Contagem de SIM e NÃO em tempo real.",
    icon: Gauge,
    endpoint: "/api/score",
  },
  {
    id: "session",
    label: "Sessão ativa",
    original: "session",
    description: "Visão completa: placar, aptos e já votaram.",
    icon: Database,
    endpoint: "/api/session",
  },
]

type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: unknown }

export default function ComandosPage() {
  const [active, setActive] = useState<CommandId | null>(null)
  const [results, setResults] = useState<Record<CommandId, ResultState>>({
    tokens: { status: "idle" },
    votes: { status: "idle" },
    placar: { status: "idle" },
    session: { status: "idle" },
  })

  const runCommand = useCallback(async (cmd: CommandDef) => {
    setActive(cmd.id)
    setResults((prev) => ({ ...prev, [cmd.id]: { status: "loading" } }))

    try {
      const res = await fetch(
        `${API_URL}${cmd.endpoint}?sessionId=${encodeURIComponent(DEFAULT_SESSION_ID)}`,
      )
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`)
      }
      const data = await res.json()
      setResults((prev) => ({ ...prev, [cmd.id]: { status: "success", data } }))
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [cmd.id]: {
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        },
      }))
    }
  }, [])

  const activeCommand = COMMANDS.find((c) => c.id === active) ?? null
  const activeResult = active ? results[active] : { status: "idle" as const }

  return (
    <main className="relative mx-auto min-h-svh max-w-5xl px-6 py-14">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 50% 35% at 50% 0%, hsl(160 70% 45% / 0.07) 0%, transparent 70%)",
        }}
      />

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
        Home
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
          <Terminal className="size-5" strokeWidth={1.5} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Comandos gerenciais</h1>
          <p className="text-sm text-muted-foreground">
            Mesmos dados do console de autenticação, consultados via API do servidor.
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Commands List */}
        <nav className="flex flex-col gap-2">
          {COMMANDS.map((cmd) => {
            const Icon = cmd.icon
            const isActive = active === cmd.id
            const state = results[cmd.id]
            return (
              <button
                key={cmd.id}
                onClick={() => runCommand(cmd)}
                className={`group flex items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
                  isActive
                    ? "border-emerald-500/40 bg-emerald-500/[0.06] shadow-[0_4px_20px_hsl(160_70%_45%/0.08)]"
                    : "border-border bg-card hover:border-emerald-500/30 hover:-translate-y-0.5"
                }`}
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="size-4" strokeWidth={1.5} aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-card-foreground">
                    {cmd.label}
                  </span>
                  <span className="block font-mono text-[11px] tracking-wide text-muted-foreground/70">
                    {cmd.original}
                  </span>
                </span>
                {state.status === "loading" ? (
                  <RefreshCw className="size-4 animate-spin text-emerald-500" strokeWidth={1.5} aria-hidden />
                ) : (
                  <ChevronRight
                    className={`size-4 text-muted-foreground transition-transform ${isActive ? "translate-x-0.5" : ""}`}
                    strokeWidth={1.5}
                    aria-hidden
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Results Panel */}
        <section className="rounded-3xl border border-border bg-card p-7">
          {!activeCommand ? (
            <EmptyState />
          ) : (
            <ResultPanel
              command={activeCommand}
              result={activeResult}
              onRefresh={() => runCommand(activeCommand)}
            />
          )}
        </section>
      </div>
    </main>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 text-center">
      <Terminal className="size-8 text-muted-foreground/40" strokeWidth={1.5} aria-hidden />
      <p className="text-sm font-medium text-muted-foreground">
        Escolha um comando à esquerda
      </p>
      <p className="text-xs text-muted-foreground/60">
        Os dados são consultados em tempo real no servidor de votação.
      </p>
    </div>
  )
}

function ResultPanel({
  command,
  result,
  onRefresh,
}: {
  command: CommandDef
  result: ResultState
  onRefresh: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-card-foreground">
            {command.label}
          </h2>
          <p className="text-sm text-muted-foreground">{command.description}</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={result.status === "loading"}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-emerald-500/40 hover:text-emerald-500 disabled:opacity-50"
        >
          <RefreshCw
            className={`size-3.5 ${result.status === "loading" ? "animate-spin" : ""}`}
            strokeWidth={1.5}
            aria-hidden
          />
          Atualizar
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-muted/40 p-5">
        {result.status === "idle" && (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        )}

        {result.status === "loading" && (
          <p className="text-sm text-muted-foreground">Querying server…</p>
        )}

        {result.status === "error" && (
          <p className="text-sm font-medium text-red-500">✗ {result.message}</p>
        )}

        {result.status === "success" && (
          <CommandOutput commandId={command.id} data={result.data} />
        )}
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CommandOutput({ commandId, data }: { commandId: CommandId; data: any }) {
  if (commandId === "tokens") {
    const tokens: string[] = data?.authorized_tokens ?? []
    return (
      <div>
        <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground">
          TOKENS AUTORIZADOS A VOTAR ({tokens.length})
        </p>
        {tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum token disponível ou todos já votaram.</p>
        ) : (
          <TokenList tokens={tokens} />
        )}
      </div>
    )
  }

  if (commandId === "votes") {
    const votes: { token: string; vote: string; timestamp: string }[] = data?.votes ?? []
    return (
      <div>
        <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground">
          VOTOS REGISTRADOS ({votes.length})
        </p>
        {votes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum voto registrado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {votes.map((v, i) => (
              <li
                key={`${v.token}-${i}`}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm"
              >
                <code className="truncate font-mono text-xs text-muted-foreground">{v.token}</code>
                <span className="text-muted-foreground/50">→</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    v.vote === "SIM"
                      ? "bg-blue-500/10 text-blue-500"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {v.vote.toUpperCase()}
                </span>
                <span className="ml-auto text-xs text-muted-foreground/60">{v.timestamp}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (commandId === "placar") {
    const sim = data?.sim ?? 0
    const nao = data?.nao ?? 0
    return (
      <div className="flex gap-4">
        <PlacarStat label="SIM" value={sim} accent="blue" />
        <PlacarStat label="NÃO" value={nao} accent="red" />
      </div>
    )
  }

  if (commandId === "session") {
    const eligible: string[] = data?.authorized_tokens ?? []
    const voted: string[] = data?.voted_tokens ?? []
    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground">SESSION</p>
          <p className="font-mono text-sm text-card-foreground">{data?.session_id}</p>
        </div>

        <div className="flex gap-4">
          <PlacarStat label="SIM" value={data?.current_score?.sim ?? 0} accent="blue" />
          <PlacarStat label="NÃO" value={data?.current_score?.nao ?? 0} accent="red" />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground">
            AINDA APTOS A VOTAR ({eligible.length})
          </p>
          {eligible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum token apto a votar.</p>
          ) : (
            <TokenList tokens={eligible} />
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground">
            JÁ VOTARAM ({voted.length})
          </p>
          {voted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum token já votou.</p>
          ) : (
            <TokenList tokens={voted} />
          )}
        </div>
      </div>
    )
  }

  return null
}

function TokenList({ tokens }: { tokens: string[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {tokens.map((token) => (
        <li key={token} className="truncate rounded-lg bg-card px-3 py-1.5">
          <code className="font-mono text-xs text-card-foreground">{token}</code>
        </li>
      ))}
    </ul>
  )
}

function PlacarStat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: "blue" | "red"
}) {
  const colorClass = accent === "blue" ? "text-blue-500" : "text-red-400"
  return (
    <div className="flex-1 rounded-xl bg-card p-4 text-center">
      <p className={`text-3xl font-black tracking-tight ${colorClass}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}