import Link from "next/link"
import { BarChart3, Vote } from "lucide-react"

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-4xl flex-col items-center justify-center px-6 py-16">
      <span className="mb-6 inline-flex items-center rounded-full bg-secondary px-4 py-1.5 text-xs font-semibold tracking-wide text-secondary-foreground">
        EQUIPE 07 · ENTREGA 3
      </span>

      <h1 className="text-center text-5xl font-extrabold tracking-tight text-balance sm:text-6xl">
        Assembleia Digital
      </h1>

      <p className="mt-4 max-w-2xl text-center text-lg leading-relaxed text-muted-foreground text-pretty">
        Votação em tempo real com autenticação por token, validação no servidor e broadcast automático do placar para o
        painel público.
      </p>

      <div className="mt-12 grid w-full gap-6 sm:grid-cols-2">
        <Link
          href="/cabine"
          className="group rounded-2xl border border-border bg-card p-8 transition-all hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sim"
        >
          <span className="flex size-12 items-center justify-center rounded-xl bg-sim-soft text-sim">
            <Vote className="size-6" aria-hidden />
          </span>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-card-foreground">Cabine do delegado</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Entre com seu token e registre seu voto de forma privada.
          </p>
        </Link>

        <Link
          href="/painel"
          className="group rounded-2xl border border-border bg-card p-8 transition-all hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nao"
        >
          <span className="flex size-12 items-center justify-center rounded-xl bg-nao-soft text-nao">
            <BarChart3 className="size-6" aria-hidden />
          </span>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-card-foreground">Painel público</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Acompanhe a apuração ao vivo, atualizada por broadcast.
          </p>
        </Link>
      </div>
    </main>
  )
}
