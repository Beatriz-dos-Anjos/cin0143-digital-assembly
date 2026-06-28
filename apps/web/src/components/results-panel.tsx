"use client"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { ArrowLeft, Clock, WifiOff } from "lucide-react"
import { ToastContainer, toast } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { percentual, totalVotos, type Opcao } from "@/src/lib/assembly"
import { useAssembly } from "@/src/hooks/use-assembly"
import { useCronometro } from "@/src/hooks/use-cronometro"
import { formatarTempo } from "@/src/lib/timer"
import { cn } from "@/src/lib/utils"

// ─── Cronômetro ───────────────────────────────────────────────────────────────
const TIMER_KEY = "assembleia:timer_inicio"
const DURACAO_SEGUNDOS = 180

function formatarTempo(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function lerOuCriarInicio(): number {
  try {
    const salvo = localStorage.getItem(TIMER_KEY)
    if (salvo) return Number(salvo)
    const novo = Date.now()
    localStorage.setItem(TIMER_KEY, String(novo))
    return novo
  } catch {
    return Date.now()
  }
}

function useCronometro() {
  const [segundosRestantes, setSegundosRestantes] = useState<number>(DURACAO_SEGUNDOS)
  const inicioRef = useRef<number>(0)

  useEffect(() => {
    inicioRef.current = lerOuCriarInicio()

    function calcRestantes() {
      const decorrido = Math.floor((Date.now() - inicioRef.current) / 1000)
      return Math.max(0, DURACAO_SEGUNDOS - decorrido)
    }

    setSegundosRestantes(calcRestantes())

    const id = setInterval(() => {
      const restantes = calcRestantes()
      setSegundosRestantes(restantes)
      if (restantes <= 0) clearInterval(id)
    }, 1000)

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TIMER_KEY) {
        inicioRef.current = lerOuCriarInicio()
        setSegundosRestantes(calcRestantes())
      }
    }
    window.addEventListener("storage", handleStorageChange)

    return () => {
      clearInterval(id)
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [])

  return { segundosRestantes, encerrada: segundosRestantes <= 0 }
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function ResultsPanel() {
  const { state, connected } = useAssembly()
  const { segundosRestantes, encerrada } = useCronometro()

  const placar = state?.placar_atual ?? { SIM: 0, NAO: 0 }
  const total = totalVotos(placar)
  const pctSim = percentual(placar.SIM, total)
  const pctNao = percentual(placar.NAO, total)
  const aoVivo = connected
  const urgente = segundosRestantes > 0 && segundosRestantes < 30

  // Detecta mudança no placar e dispara toast
  const placarAnteriorRef = useRef({ SIM: 0, NAO: 0 })
  const primeiroRenderRef = useRef(true)

  useEffect(() => {
    // Ignora o primeiro render (estado inicial zerado)
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:py-16">
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

      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 font-mono text-xs font-semibold tracking-wider text-secondary-foreground">
            {state?.sessao_id ?? "assembleia"}
          </span>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-balance">
            Apuração em tempo real
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Painel público sincronizado com o servidor de votação.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold tracking-wider tabular-nums font-mono transition-colors",
              encerrada
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : urgente
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400 animate-pulse"
                  : "border-muted-foreground/30 bg-secondary text-muted-foreground",
            )}
          >
            <Clock className={cn("size-3.5", urgente && "text-amber-400")} aria-hidden />
            <span>{formatarTempo(segundosRestantes)}</span>
          </div>

          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wider",
              aoVivo
                ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                : "border-border bg-secondary text-muted-foreground",
            )}
          >
            {aoVivo ? (
              <>
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
                </span>
                AO VIVO
              </>
            ) : (
              <>
                <WifiOff className="size-3.5" aria-hidden />
                DESCONECTADO
              </>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <ScoreCard opcao="SIM" valor={placar.SIM} percentual={pctSim} />
        <ScoreCard opcao="NAO" valor={placar.NAO} percentual={pctNao} />
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-40"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.6) 50%, transparent)",
          }}
        />

        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-card-foreground">Distribuição</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {total} voto{total !== 1 ? "s" : ""}
          </span>
        </div>

        <div
          className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-muted"
          aria-hidden
          role="presentation"
        >
          <div
            className="h-full bg-blue-600 transition-all duration-700 ease-out"
            style={{ width: `${pctSim}%` }}
          />
          <div
            className="h-full bg-red-500 transition-all duration-700 ease-out"
            style={{ width: `${pctNao}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-blue-600" aria-hidden />
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              SIM <span className="ml-1 text-foreground">{pctSim.toFixed(1)}%</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              NÃO <span className="mr-1 text-foreground">{pctNao.toFixed(1)}%</span>
            </span>
            <span className="size-2.5 rounded-full bg-red-500" aria-hidden />
          </div>
        </div>
      </section>
    </div>
  )
}

function ScoreCard({
  opcao,
  valor,
  percentual: pct,
}: {
  opcao: Opcao
  valor: number
  percentual: number
}) {
  const isSim = opcao === "SIM"

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border p-6 sm:p-8",
        isSim ? "border-blue-500/20 bg-blue-500/6" : "border-red-500/20 bg-red-500/6",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 size-32 -translate-y-1/2 translate-x-1/2 rounded-full blur-2xl"
        style={{
          background: isSim ? "hsl(220 80% 60% / 0.12)" : "hsl(0 75% 55% / 0.10)",
        }}
      />

      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-bold tracking-[0.18em]", isSim ? "text-blue-400" : "text-red-400")}>
          {isSim ? "SIM" : "NÃO"}
        </span>
        <span className="font-mono text-xs font-semibold text-muted-foreground">
          {pct.toFixed(1)}%
        </span>
      </div>

      <p className={cn("mt-3 text-7xl font-black tabular-nums tracking-tight transition-all duration-300", isSim ? "text-blue-500" : "text-red-500")}>
        {valor}
      </p>

      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-card/60">
        <div
          className={cn("h-full transition-all duration-700 ease-out", isSim ? "bg-blue-500" : "bg-red-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}