import { Clock, Radio } from "lucide-react"
import { cn } from "@/src/lib/utils"

export function SessionChip({ id }: { id: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-border bg-secondary px-3 py-1 font-mono text-xs font-medium tracking-wide text-muted-foreground">
      {id}
    </span>
  )
}

export function Countdown({
  tempo,
  encerrada,
}: {
  tempo: string
  encerrada: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-lg font-semibold tabular-nums",
        encerrada ? "text-nao" : "text-foreground",
      )}
    >
      <Clock className="size-4" aria-hidden />
      <span aria-label={`Tempo restante ${tempo}`}>{tempo}</span>
    </span>
  )
}

export function LiveBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold",
        ativo ? "bg-live text-live-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      <Radio className={cn("size-4", ativo && "animate-pulse")} aria-hidden />
      {ativo ? "AO VIVO" : "ENCERRADO"}
    </span>
  )
}
