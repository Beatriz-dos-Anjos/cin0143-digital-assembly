import Link from "next/link"
import { BarChart3, Vote, Terminal } from "lucide-react"

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-svh max-w-3xl flex-col items-center justify-center px-6 py-20 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 20%, hsl(220 80% 60% / 0.08) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 80% 70%, hsl(0 75% 55% / 0.06) 0%, transparent 60%)",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="mb-10 flex flex-col items-center gap-5 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
          <Vote className="size-7 text-foreground" strokeWidth={1.5} aria-hidden />
        </div>

        <div>
          <h1 className="text-5xl font-black tracking-tighter text-balance sm:text-6xl">
            Assembleia Digital
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground text-pretty">
            Votação em tempo real com autenticação por token e apuração pública ao vivo.
          </p>
        </div>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Link
          href="/voting-booth"
          className="group relative overflow-hidden rounded-3xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-[0_8px_32px_hsl(220_80%_60%/0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 30% 50%, hsl(220 80% 60% / 0.07) 0%, transparent 70%)",
            }}
          />

          <span className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20">
            <Vote className="size-5" strokeWidth={1.5} aria-hidden />
          </span>

          <h2 className="mt-5 text-xl font-bold tracking-tight text-card-foreground">
            Cabine de Votação
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Autentique com seu token e registre seu voto de forma privada.
          </p>

          <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-blue-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            ENTRAR <span aria-hidden>→</span>
          </div>
        </Link>

        <Link
          href="/painel"
          className="group relative overflow-hidden rounded-3xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-red-500/40 hover:shadow-[0_8px_32px_hsl(0_75%_55%/0.10)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
        >
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 70% 50%, hsl(0 75% 55% / 0.07) 0%, transparent 70%)",
            }}
          />

          <span className="flex size-11 items-center justify-center rounded-xl bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
            <BarChart3 className="size-5" strokeWidth={1.5} aria-hidden />
          </span>

          <h2 className="mt-5 text-xl font-bold tracking-tight text-card-foreground">
            Painel público
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Acompanhe a apuração ao vivo, atualizada a cada voto registrado.
          </p>

          <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-red-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            ACOMPANHAR <span aria-hidden>→</span>
          </div>
        </Link>

        <Link
          href="/commands"
          className="group relative overflow-hidden rounded-3xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-[0_8px_32px_hsl(160_70%_45%/0.10)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 sm:col-span-2"
        >
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 50%, hsl(160 70% 45% / 0.07) 0%, transparent 70%)",
            }}
          />

          <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
            <Terminal className="size-5" strokeWidth={1.5} aria-hidden />
          </span>

          <h2 className="mt-5 text-xl font-bold tracking-tight text-card-foreground">
            Comandos gerenciais
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Consulte tokens, votos e o estado da sessão — os mesmos dados do console de autenticação.
          </p>

          <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-emerald-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            ABRIR PAINEL <span aria-hidden>→</span>
          </div>
        </Link>
      </div>

      <p className="mt-8 text-xs text-muted-foreground/50 tracking-wide">
        SESSÃO ATIVA · TEMPO REAL
      </p>
    </main>
  )
}