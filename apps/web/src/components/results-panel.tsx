"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { percentual, totalVotos, type Opcao } from "@/src/lib/assembly"
import { formatarTempo, useAssembly } from "@/src/hooks/use-assembly"
import { Countdown, LiveBadge, SessionChip } from "@/src/components/assembly-chips"
import { cn } from "@/src/lib/utils"

export function ResultsPanel() {
  const { state, segundosRestantes, encerrada } = useAssembly()

  const placar = state?.placar_atual ?? { SIM: 0, NAO: 0 }
  const total = totalVotos(placar)
  const pctSim = percentual(placar.SIM, total)
  const pctNao = percentual(placar.NAO, total)

  return (
    <div className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SessionChip id={state?.sessao_id ?? "ASSEMBLEIA"} />
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-balance">Apuração em tempo real</h1>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Painel público — atualizado por broadcast a cada voto válido.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <LiveBadge ativo={!encerrada} />
          <Countdown tempo={formatarTempo(segundosRestantes)} encerrada={encerrada} />
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <ScoreCard opcao="SIM" valor={placar.SIM} percentual={pctSim} />
        <ScoreCard opcao="NAO" valor={placar.NAO} percentual={pctNao} />
      </div>

      <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-card-foreground">Distribuição</h2>
          <span className="font-mono text-sm text-muted-foreground">
            {total} voto(s) computado(s)
          </span>
        </div>

        <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="bg-sim transition-all duration-500 ease-out" style={{ width: `${pctSim}%` }} />
          <div className="bg-nao transition-all duration-500 ease-out" style={{ width: `${pctNao}%` }} />
        </div>

        <div className="mt-3 flex items-center justify-between font-mono text-xs text-muted-foreground">
          <span>SIM · {pctSim.toFixed(1)}%</span>
          <span>NÃO · {pctNao.toFixed(1)}%</span>
        </div>
      </section>
    </div>
  )
}

function ScoreCard({
  opcao,
  valor,
  percentual,
}: {
  opcao: Opcao
  valor: number
  percentual: number
}) {
  const isSim = opcao === "SIM"
  return (
    <div
      className={cn(
        "rounded-3xl border p-6 sm:p-8",
        isSim ? "border-sim/20 bg-sim-soft" : "border-nao/20 bg-nao-soft",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-widest text-muted-foreground">
          {isSim ? "SIM" : "NÃO"}
        </span>
        <span className="font-mono text-sm text-muted-foreground">{percentual.toFixed(1)}%</span>
      </div>

      <p
        className={cn(
          "mt-3 text-7xl font-extrabold tabular-nums tracking-tight transition-all",
          isSim ? "text-sim" : "text-nao",
        )}
      >
        {valor}
      </p>

      <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-card">
        <div
          className={cn("h-full transition-all duration-500 ease-out", isSim ? "bg-sim" : "bg-nao")}
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  )
}
