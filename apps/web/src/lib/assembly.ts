import type { ServerScore } from "@/src/lib/api"

export type { ServerScore }

export type VoteOption = "SIM" | "NÃO"

export interface Score {
  sim: number
  nao: number
}

export interface AssemblyState {
  session_id: string
  current_score: Score
  connected: boolean
}

export function fromServerScore(score: ServerScore): Score {
  return { sim: score.sim, nao: score.nao }
}

export function toServerOption(option: VoteOption): "SIM" | "NÃO" {
  return option === "SIM" ? "SIM" : "NÃO"
}

export function formatCastVote(token: string, option: VoteOption): string {
  return `CAST_VOTE|${token.trim()}|${toServerOption(option)}`
}

export function totalVotes(score: Score): number {
  return score.sim + score.nao
}

export function percentage(value: number, total: number): number {
  if (total <= 0) return 0
  return (value / total) * 100
}

export function isValidTokenFormat(token: string): boolean {
  const trimmed = token.trim()
  return trimmed.length >= 32 && trimmed.length <= 256
}
