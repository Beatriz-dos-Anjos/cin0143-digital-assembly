"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  DEFAULT_SESSAO_ID,
  getSession,
} from "@/src/lib/api"
import {
  connectSocket,
  SOCKET_EVENTS,
  type ConnectionAck,
  type SessionResetPayload,
} from "@/src/lib/socket"
import {
  DURACAO_SEGUNDOS,
  TIMER_SYNC_EVENT,
  calcSegundosRestantes,
  syncSessionTimer,
  type SessionTimerAnchor,
} from "@/src/lib/timer"

const SYNC_POLL_MS = 10_000

export function useCronometro(sessaoId = DEFAULT_SESSAO_ID) {
  const [segundosRestantes, setSegundosRestantes] = useState(DURACAO_SEGUNDOS)
  const anchorRef = useRef<SessionTimerAnchor>({
    iniciada_em: Date.now(),
    duracao_segundos: DURACAO_SEGUNDOS,
  })

  const applyAnchor = useCallback((anchor: SessionTimerAnchor) => {
    anchorRef.current = anchor
    setSegundosRestantes(
      calcSegundosRestantes(anchor.iniciada_em, anchor.duracao_segundos),
    )
  }, [])

  const fetchFromServer = useCallback(async () => {
    try {
      const session = await getSession(sessaoId)
      applyAnchor({
        iniciada_em: session.iniciada_em,
        duracao_segundos: session.duracao_segundos,
        sessao_id: session.sessao_id,
      })
    } catch {
      // mantém âncora atual
    }
  }, [applyAnchor, sessaoId])

  useEffect(() => {
    void fetchFromServer()

    const tick = setInterval(() => {
      const anchor = anchorRef.current
      setSegundosRestantes(
        calcSegundosRestantes(anchor.iniciada_em, anchor.duracao_segundos),
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
      if (data.sessao_id !== sessaoId) return
      applyAnchor({
        iniciada_em: data.iniciada_em,
        duracao_segundos: data.duracao_segundos,
        sessao_id: data.sessao_id,
      })
    }

    const onSessionReset = (data: SessionResetPayload) => {
      if (data.sessao_id !== sessaoId) return
      applyAnchor({
        iniciada_em: data.iniciada_em,
        duracao_segundos: data.duracao_segundos,
        sessao_id: data.sessao_id,
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
  }, [applyAnchor, fetchFromServer, sessaoId])

  return { segundosRestantes, encerrada: segundosRestantes <= 0 }
}

export { syncSessionTimer }
