"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  DEFAULT_SESSION_ID,
  getSession,
} from "@/src/lib/api"
import {
  connectSocket,
  SOCKET_EVENTS,
  type ConnectionAck,
  type SessionResetPayload,
} from "@/src/lib/socket"
import {
  DURATION_SECONDS,
  TIMER_SYNC_EVENT,
  calcRemainingSeconds,
  syncSessionTimer,
  type SessionTimerAnchor,
} from "@/src/lib/timer"

const SYNC_POLL_MS = 10_000

export function useTimer(sessionId = DEFAULT_SESSION_ID) {
  const [remainingSeconds, setRemainingSeconds] = useState(DURATION_SECONDS)
  const anchorRef = useRef<SessionTimerAnchor>({
    started_at: Date.now(),
    duration_seconds: DURATION_SECONDS,
  })

  const applyAnchor = useCallback((anchor: SessionTimerAnchor) => {
    anchorRef.current = anchor
    setRemainingSeconds(
      calcRemainingSeconds(anchor.started_at, anchor.duration_seconds),
    )
  }, [])

  const fetchFromServer = useCallback(async () => {
    try {
      const session = await getSession(sessionId)
      applyAnchor({
        started_at: session.started_at,
        duration_seconds: session.duration_seconds,
        session_id: session.session_id,
      })
    } catch {
      // keep current anchor
    }
  }, [applyAnchor, sessionId])

  useEffect(() => {
    void fetchFromServer()

    const tick = setInterval(() => {
      const anchor = anchorRef.current
      setRemainingSeconds(
        calcRemainingSeconds(anchor.started_at, anchor.duration_seconds),
      )
    }, 1000)

    const poll = setInterval(() => {
      void fetchFromServer()
    }, SYNC_POLL_MS)

    const onTimerSync = (event: Event) => {
      const detail = (event as CustomEvent<SessionTimerAnchor>).detail
      if (detail) applyAnchor(detail)
    }

    const socket = connectSocket()

    const onConnectionAck = (data: ConnectionAck) => {
      if (data.session_id !== sessionId) return
      applyAnchor({
        started_at: data.started_at,
        duration_seconds: data.duration_seconds,
        session_id: data.session_id,
      })
    }

    const onSessionReset = (data: SessionResetPayload) => {
      if (data.session_id !== sessionId) return
      applyAnchor({
        started_at: data.started_at,
        duration_seconds: data.duration_seconds,
        session_id: data.session_id,
      })
    }

    window.addEventListener(TIMER_SYNC_EVENT, onTimerSync)
    socket.on(SOCKET_EVENTS.CONNECTION_ACK, onConnectionAck)
    socket.on(SOCKET_EVENTS.SESSION_RESET, onSessionReset)

    return () => {
      clearInterval(tick)
      clearInterval(poll)
      window.removeEventListener(TIMER_SYNC_EVENT, onTimerSync)
      socket.off(SOCKET_EVENTS.CONNECTION_ACK, onConnectionAck)
      socket.off(SOCKET_EVENTS.SESSION_RESET, onSessionReset)
    }
  }, [applyAnchor, fetchFromServer, sessionId])

  return { remainingSeconds, ended: remainingSeconds <= 0 }
}

export { syncSessionTimer }
