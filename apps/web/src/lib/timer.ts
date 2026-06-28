export const DURATION_SECONDS = 180
export const TIMER_SYNC_EVENT = "assembly:timer_sync"

export interface SessionTimerAnchor {
  started_at: number
  duration_seconds: number
  session_id?: string
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function calcRemainingSeconds(
  started_at: number,
  duration_seconds: number,
): number {
  const elapsed = Math.floor((Date.now() - started_at) / 1000)
  return Math.max(0, duration_seconds - elapsed)
}

export function syncSessionTimer(anchor: SessionTimerAnchor): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<SessionTimerAnchor>(TIMER_SYNC_EVENT, { detail: anchor }),
  )
}
