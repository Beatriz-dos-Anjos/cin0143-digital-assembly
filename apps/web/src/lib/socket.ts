import { io, type Socket } from "socket.io-client"
import type { ServerPlacar } from "@/src/lib/api"

export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001"

/** Eventos recebidos do servidor (somente listeners no front). */
export const SOCKET_EVENTS = {
  CONNECTION_ACK: "connection_ack",
} as const

export type { ServerPlacar }

export interface ConnectionAck {
  message: string
  sessao_id: string
  placar_atual: ServerPlacar
}

export function placarChannel(sessaoId: string): string {
  return `placar_atualizado_${sessaoId}`
}

let socket: Socket | null = null

function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      reconnection: true,
    })
  }
  return socket
}

export function connectSocket(): Socket {
  const s = getSocket()
  if (!s.connected) {
    s.connect()
  }
  return s
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect()
  }
}
