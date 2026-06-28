"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fromServerScore,
  type AssemblyState,
  type Score,
} from "@/src/lib/assembly"
import { DEFAULT_SESSION_ID, getSession, type ServerScore } from "@/src/lib/api"
import {
  connectSocket,
  scoreChannel,
  SOCKET_EVENTS,
  type ConnectionAck,
  type SessionResetPayload,
} from "@/src/lib/socket"

const EMPTY_SCORE: Score = { sim: 0, nao: 0 }

export function useSocketSession() {
  const [state, setState] = useState<AssemblyState>({
    session_id: "",
    current_score: EMPTY_SCORE,
    connected: false,
  })

  useEffect(() => {
    const socket = connectSocket()
    let active = true
    let activeScoreChannel: string | null = null

    const onConnect = () => {
      setState((prev) => ({ ...prev, connected: true }))
    }

    const onDisconnect = () => {
      setState((prev) => ({ ...prev, connected: false }))
    }

    const onScore = (score: ServerScore) => {
      setState((prev) => ({
        ...prev,
        current_score: fromServerScore(score),
        connected: true,
      }))
    }

    const subscribeScore = (sessionId: string) => {
      const channel = scoreChannel(sessionId)
      if (activeScoreChannel === channel) {
        return
      }

      if (activeScoreChannel) {
        socket.off(activeScoreChannel, onScore)
      }

      activeScoreChannel = channel
      socket.on(channel, onScore)
    }

    const applySession = (sessionId: string, score: ServerScore) => {
      subscribeScore(sessionId)
      setState((prev) => ({
        session_id: sessionId,
        current_score: fromServerScore(score),
        connected: prev.connected || socket.connected,
      }))
    }

    const onConnectionAck = (data: ConnectionAck) => {
      applySession(data.session_id, data.current_score)
    }

    const onSessionReset = (data: SessionResetPayload) => {
      applySession(data.session_id, data.current_score)
    }

    async function bootstrap() {
      try {
        const session = await getSession(DEFAULT_SESSION_ID)
        if (!active) return
        applySession(session.session_id, session.current_score)
      } catch {
        // connection_ack or reconnection might hydrate later
      }
    }

    void bootstrap()

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on(SOCKET_EVENTS.CONNECTION_ACK, onConnectionAck)
    socket.on(SOCKET_EVENTS.SESSION_RESET, onSessionReset)

    if (socket.connected) {
      onConnect()
    }

    return () => {
      active = false
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off(SOCKET_EVENTS.CONNECTION_ACK, onConnectionAck)
      socket.off(SOCKET_EVENTS.SESSION_RESET, onSessionReset)

      if (activeScoreChannel) {
        socket.off(activeScoreChannel, onScore)
      }
    }
  }, [])

  const requestSession = useCallback(async () => {
    const sessionId = state.session_id || DEFAULT_SESSION_ID

    try {
      const session = await getSession(sessionId)
      setState((prev) => ({
        ...prev,
        session_id: session.session_id,
        current_score: fromServerScore(session.current_score),
      }))
    } catch {
      // keep current state; socket continues as live source
    }
  }, [state.session_id])

  return { state, requestSession }
}

/** Kept for compatibility with existing imports in components. */
export function useAssembly() {
  const { state, requestSession } = useSocketSession()

  return {
    state: state.session_id
      ? {
          session_id: state.session_id,
          current_score: state.current_score,
        }
      : null,
    remainingSeconds: 0,
    ended: !state.connected,
    reset: requestSession,
    connected: state.connected,
  }
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}
