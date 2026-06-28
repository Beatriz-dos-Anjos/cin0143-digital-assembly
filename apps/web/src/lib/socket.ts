import { io, type Socket } from "socket.io-client"
import type { ServerScore } from "@/src/lib/api"
import { DURATION_SECONDS } from "@/src/lib/timer"

export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001"

/** Events received from server (listeners only on frontend). */
export const SOCKET_EVENTS = {
  CONNECTION_ACK: "connection_ack",
  SESSION_RESET: "session_reset",
} as const

export type { ServerScore }

export interface SessionTimerFields {
  started_at: number
  duration_seconds: number
}

export interface ConnectionAck extends SessionTimerFields {
  message: string
  session_id: string
  current_score: ServerScore
}

export interface SessionResetPayload extends SessionTimerFields {
  session_id: string
  current_score: ServerScore
}

export function scoreChannel(sessionId: string): string {
  return `score_updated_${sessionId}`
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

export { DURATION_SECONDS }
