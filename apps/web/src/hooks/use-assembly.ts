"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fromServerPlacar,
  type AssemblyState,
  type Placar,
} from "@/src/lib/assembly"
import { DEFAULT_SESSAO_ID, getSession, type ServerPlacar } from "@/src/lib/api"
import {
  connectSocket,
  placarChannel,
  SOCKET_EVENTS,
  type ConnectionAck,
} from "@/src/lib/socket"

const EMPTY_PLACAR: Placar = { SIM: 0, NAO: 0 }

export function useSocketSession() {
  const [state, setState] = useState<AssemblyState>({
    sessao_id: "",
    placar_atual: EMPTY_PLACAR,
    connected: false,
  })

  useEffect(() => {
    const socket = connectSocket()
    let activePlacarChannel: string | null = null

    const onConnect = () => {
      setState((prev) => ({ ...prev, connected: true }))
    }

    const onDisconnect = () => {
      setState((prev) => ({ ...prev, connected: false }))
    }

    const onPlacar = (placar: ServerPlacar) => {
      setState((prev) => ({
        ...prev,
        placar_atual: fromServerPlacar(placar),
        connected: true,
      }))
    }

    const subscribePlacar = (sessaoId: string) => {
      const channel = placarChannel(sessaoId)
      if (activePlacarChannel === channel) {
        return
      }

      if (activePlacarChannel) {
        socket.off(activePlacarChannel, onPlacar)
      }

      activePlacarChannel = channel
      socket.on(channel, onPlacar)
    }

    const applySession = (sessaoId: string, placar: ServerPlacar) => {
      subscribePlacar(sessaoId)
      setState((prev) => ({
        sessao_id: sessaoId,
        placar_atual: fromServerPlacar(placar),
        connected: prev.connected || socket.connected,
      }))
    }

    const onConnectionAck = (data: ConnectionAck) => {
      applySession(data.sessao_id, data.placar_atual)
    }

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on(SOCKET_EVENTS.CONNECTION_ACK, onConnectionAck)

    if (socket.connected) {
      onConnect()
    }

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off(SOCKET_EVENTS.CONNECTION_ACK, onConnectionAck)

      if (activePlacarChannel) {
        socket.off(activePlacarChannel, onPlacar)
      }
    }
  }, [])

  const requestSession = useCallback(async () => {
    const sessaoId = state.sessao_id || DEFAULT_SESSAO_ID

    try {
      const session = await getSession(sessaoId)
      setState((prev) => ({
        ...prev,
        sessao_id: session.sessao_id,
        placar_atual: fromServerPlacar(session.placar_atual),
      }))
    } catch {
      // mantém estado atual; socket continua como fonte ao vivo
    }
  }, [state.sessao_id])

  return { state, requestSession }
}

/** Mantido para compatibilidade com imports existentes nos componentes. */
export function useAssembly() {
  const { state, requestSession } = useSocketSession()

  return {
    state: state.sessao_id
      ? {
          sessao_id: state.sessao_id,
          placar_atual: state.placar_atual,
        }
      : null,
    segundosRestantes: 0,
    encerrada: !state.connected,
    reiniciar: requestSession,
    connected: state.connected,
  }
}

export function formatarTempo(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}
