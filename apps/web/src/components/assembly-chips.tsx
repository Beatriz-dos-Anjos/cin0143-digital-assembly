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
  time,
  ended,
}: {
  time: string
  ended: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-lg font-semibold tabular-nums",
        ended ? "text-no" : "text-foreground",
      )}
    >
      <Clock className="size-4" aria-hidden />
      <span aria-label={`Remaining time ${time}`}>{time}</span>
    </span>
  )
}

export function LiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold",
        active ? "bg-live text-live-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      <Radio className={cn("size-4", active && "animate-pulse")} aria-hidden />
      {active ? "LIVE" : "ENDED"}
    </span>
  )
}
