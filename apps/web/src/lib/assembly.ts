import type { ServerPlacar } from "@/src/lib/socket"

export type Opcao = "SIM" | "NAO"

export interface Placar {
  SIM: number
  NAO: number
}

export interface AssemblyState {
  sessao_id: string
  placar_atual: Placar
  connected: boolean
}

export function fromServerPlacar(placar: ServerPlacar): Placar {
  return { SIM: placar.sim, NAO: placar.nao }
}

export function toServerOpcao(opcao: Opcao): "sim" | "nao" {
  return opcao === "SIM" ? "sim" : "nao"
}

export function formatCastVote(token: string, opcao: Opcao): string {
  return `CAST_VOTE|${token.trim()}|${toServerOpcao(opcao)}`
}

export function totalVotos(placar: Placar): number {
  return placar.SIM + placar.NAO
}

export function percentual(valor: number, total: number): number {
  if (total <= 0) return 0
  return (valor / total) * 100
}

export function isValidTokenFormat(token: string): boolean {
  const trimmed = token.trim()
  return trimmed.length >= 32 && trimmed.length <= 256
}
