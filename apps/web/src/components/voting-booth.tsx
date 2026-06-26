"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertCircle, ArrowLeft, CheckCircle2, Lock } from "lucide-react"
import { castVote, type CastVoteResult, type Opcao } from "@/src/lib/assembly"
import { formatarTempo, useAssembly } from "@/src/hooks/use-assembly"
import { Countdown, SessionChip } from "@/src/components/assembly-chips"
import { cn } from "@/src/lib/utils"

type Feedback =
  | { tipo: "erro"; mensagem: string }
  | { tipo: "sucesso"; mensagem: string }
  | null

export function VotingBooth() {
  const { state, segundosRestantes, encerrada, reiniciar } = useAssembly()
  const [token, setToken] = useState("")
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [votando, setVotando] = useState<Opcao | null>(null)

  const sessaoId = state?.sessao_id ?? "ASSEMBLEIA"
  const desabilitado = encerrada || votando !== null

  function registrarVoto(opcao: Opcao) {
    setFeedback(null)

    if (!token.trim()) {
      setFeedback({ tipo: "erro", mensagem: "Informe seu token de delegado antes de votar." })
      return
    }

    setVotando(opcao)
    // simula a latência de ida/volta ao servidor (socket.emit -> ack)
    setTimeout(() => {
      const resultado: CastVoteResult = castVote(token, opcao)
      if (resultado.ok) {
        setFeedback({ tipo: "sucesso", mensagem: `Voto "${opcao}" registrado com sucesso. Obrigado!` })
        setToken("")
      } else {
        setFeedback({ tipo: "erro", mensagem: resultado.mensagem ?? "Não foi possível registrar o voto." })
      }
      setVotando(null)
    }, 350)
  }

  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar
      </Link>

      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <header className="flex items-start justify-between gap-4">
          <SessionChip id={sessaoId} />
          <Countdown tempo={formatarTempo(segundosRestantes)} encerrada={encerrada} />
        </header>

        <h1 className="mt-5 text-3xl font-bold tracking-tight text-card-foreground">Cabine do delegado</h1>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          Insira seu token de autenticação e registre seu voto. Cada token vota uma única vez.
        </p>

        <div className="mt-6">
          <label htmlFor="token" className="text-sm font-semibold text-card-foreground">
            Token de delegado
          </label>
          <input
            id="token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={encerrada}
            placeholder="DELEGADO-XXX"
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 font-mono text-sm tracking-wide outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <VoteButton
            opcao="SIM"
            onClick={() => registrarVoto("SIM")}
            disabled={desabilitado}
            loading={votando === "SIM"}
          />
          <VoteButton
            opcao="NAO"
            onClick={() => registrarVoto("NAO")}
            disabled={desabilitado}
            loading={votando === "NAO"}
          />
        </div>

        {encerrada ? (
          <Aviso
            tone="erro"
            icon={<Lock className="size-5" aria-hidden />}
            titulo="Sessão encerrada"
            descricao="O tempo limite foi atingido. Não é mais possível registrar votos."
          />
        ) : feedback ? (
          <Aviso
            tone={feedback.tipo}
            icon={
              feedback.tipo === "sucesso" ? (
                <CheckCircle2 className="size-5" aria-hidden />
              ) : (
                <AlertCircle className="size-5" aria-hidden />
              )
            }
            titulo={feedback.tipo === "sucesso" ? "Voto confirmado" : "Voto rejeitado"}
            descricao={feedback.mensagem}
          />
        ) : null}
      </section>

      <section className="flex items-center justify-between rounded-2xl border border-dashed border-border px-5 py-4">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground">MODO DEMONSTRAÇÃO</span>
        <button
          onClick={() => {
            reiniciar()
            setFeedback(null)
            setToken("")
          }}
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Reiniciar sessão
        </button>
      </section>
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
        "flex aspect-[4/3] flex-col items-center justify-center rounded-2xl text-center transition-all",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-55",
        !disabled && "hover:scale-[1.02] active:scale-95",
        isSim
          ? "bg-sim text-sim-foreground focus-visible:outline-sim"
          : "bg-nao text-nao-foreground focus-visible:outline-nao",
      )}
    >
      <span className="text-xs font-semibold tracking-widest opacity-80">VOTO</span>
      <span className="text-4xl font-extrabold tracking-tight">{loading ? "..." : isSim ? "SIM" : "NÃO"}</span>
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
        "mt-6 flex items-start gap-3 rounded-2xl border p-4",
        tone === "erro"
          ? "border-nao/30 bg-nao-soft text-card-foreground"
          : "border-sim/30 bg-sim-soft text-card-foreground",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", tone === "erro" ? "text-nao" : "text-sim")}>{icon}</span>
      <div>
        <p className="font-semibold">{titulo}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{descricao}</p>
      </div>
    </div>
  )
}
