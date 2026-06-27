"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Clock,
  KeyRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { type Opcao } from "@/src/lib/assembly";
import { useVoter } from "@/src/hooks/use-voter";
import { cn } from "@/src/lib/utils";

const TIMER_KEY = "assembleia:timer_inicio";
const DURACAO_SEGUNDOS = 180;

function formatarTempo(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function lerOuCriarInicio(): number {
  try {
    const salvo = localStorage.getItem(TIMER_KEY);
    if (salvo) return Number(salvo);
    const novo = Date.now();
    localStorage.setItem(TIMER_KEY, String(novo));
    return novo;
  } catch {
    return Date.now();
  }
}

function useCronometro(resetKey: number) {
  const [segundosRestantes, setSegundosRestantes] = useState<number>(DURACAO_SEGUNDOS);
  const inicioRef = useRef<number>(0);

  useEffect(() => {
    if (resetKey > 0) {
      try { localStorage.removeItem(TIMER_KEY); } catch {}
    }

    inicioRef.current = lerOuCriarInicio();

    function calcRestantes() {
      const decorrido = Math.floor((Date.now() - inicioRef.current) / 1000);
      return Math.max(0, DURACAO_SEGUNDOS - decorrido);
    }

    setSegundosRestantes(calcRestantes());

    const id = setInterval(() => {
      const restantes = calcRestantes();
      setSegundosRestantes(restantes);
      if (restantes <= 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return { segundosRestantes, encerrada: segundosRestantes <= 0 };
}

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
  } = useVoter();

  const [resetKey, setResetKey] = useState(0);
  const { segundosRestantes, encerrada } = useCronometro(resetKey);

  const desabilitadoVoto =
    encerrada || !connected || gerandoToken || !token || votando !== null;
  const desabilitadoGerar =
    encerrada || !connected || gerandoToken || votando !== null;

  function handleReiniciar() {
    setResetKey((k) => k + 1); 
    setToken("");
  }

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-10 sm:py-16">
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
            onClick={gerarToken}
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
            <label
              htmlFor="token"
              className="text-xs font-semibold tracking-wider text-muted-foreground"
            >
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

          {encerrada ? (
            <Aviso
              tone="erro"
              icon={<Lock className="size-4" aria-hidden />}
              titulo="Sessão encerrada"
              descricao="O tempo limite foi atingido. Novos votos não são aceitos."
            />
          ) : feedback ? (
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

      <div className="flex items-center justify-between rounded-2xl border border-dashed border-border/60 px-5 py-3.5">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground/50">
          MODO DEMONSTRAÇÃO
        </span>
        <button
          onClick={handleReiniciar}
          className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground underline-offset-4 hover:underline"
        >
          Reiniciar sessão
        </button>
      </div>
    </div>
  );
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
  );
}

function VoteButton({
  opcao,
  onClick,
  disabled,
  loading,
}: {
  opcao: Opcao;
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  const isSim = opcao === "SIM";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Votar ${isSim ? "SIM" : "NÃO"}`}
      className={cn(
        "group relative flex aspect-[3/2] flex-col items-center justify-center overflow-hidden rounded-2xl text-center transition-all duration-200",
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
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-50"
        style={{
          background: "linear-gradient(90deg, transparent, white 50%, transparent)",
        }}
      />
      <span className="text-[10px] font-bold tracking-[0.2em] opacity-70">VOTO</span>
      <span className="mt-0.5 text-4xl font-black tracking-tight">
        {loading ? "·  ·  ·" : isSim ? "SIM" : "NÃO"}
      </span>
    </button>
  );
}

function Aviso({
  tone,
  icon,
  titulo,
  descricao,
}: {
  tone: "erro" | "sucesso";
  icon: React.ReactNode;
  titulo: string;
  descricao: string;
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
  );
}