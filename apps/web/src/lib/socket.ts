import { io, type Socket } from "socket.io-client"

export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001"

export const SOCKET_EVENTS = {
  CAST_VOTE: "cast_vote",
  CLIENT_REGISTER: "client_register",
  CLIENT_REGISTERED: "client_registered",
  GENERATE_TOKEN_REQUEST: "generate_token_request",
  GENERATE_TOKEN_RESPONSE: "generate_token_response",
  SESSION_REQUEST: "session_request",
  SESSION_DATA: "session_data",
  VOTE_ACCEPTED: "vote_accepted",
  VOTE_ERROR: "vote_error",
  CONNECTION_ACK: "connection_ack",
} as const

export interface ServerPlacar {
  sim: number
  nao: number
}

export interface ConnectionAck {
  message: string
  sessao_id: string
  placar_atual: ServerPlacar
}

export interface ClientRegistered {
  token: string
  sessao_id: string
}

export interface GenerateTokenResponse {
  token: string
}

export interface VoteErrorPayload {
  code: string
  message: string
  severity?: string
}

export interface VoteAccepted {
  token: string
  sessao_id: string
}

export function placarChannel(sessaoId: string): string {
  return `placar_atualizado_${sessaoId}`
}

let socket: Socket | null = null

export function getSocket(): Socket {
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
