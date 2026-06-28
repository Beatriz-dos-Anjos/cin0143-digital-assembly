export const DURACAO_SEGUNDOS = 180
export const TIMER_SYNC_EVENT = "assembleia:timer_sync"

export interface SessionTimerAnchor {
  iniciada_em: number
  duracao_segundos: number
  sessao_id?: string
}

export function formatarTempo(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function calcSegundosRestantes(
  iniciada_em: number,
  duracao_segundos: number,
): number {
  const decorrido = Math.floor((Date.now() - iniciada_em) / 1000)
  return Math.max(0, duracao_segundos - decorrido)
}

export function syncSessionTimer(anchor: SessionTimerAnchor): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<SessionTimerAnchor>(TIMER_SYNC_EVENT, { detail: anchor }),
  )
}
