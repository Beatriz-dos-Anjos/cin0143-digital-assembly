"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fromServerPlacar,
  type AssemblyState,
  type Placar,
} from "@/src/lib/assembly"
import {
  connectSocket,
  getSocket,
  placarChannel,
  SOCKET_EVENTS,
  type ConnectionAck,
  type ServerPlacar,
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
      socket.emit(SOCKET_EVENTS.SESSION_REQUEST)
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

    const onSessionData = (data: {
      sessao_id: string
      placar_atual: ServerPlacar
    }) => {
      applySession(data.sessao_id, data.placar_atual)
    }

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on(SOCKET_EVENTS.CONNECTION_ACK, onConnectionAck)
    socket.on(SOCKET_EVENTS.SESSION_DATA, onSessionData)

    if (socket.connected) {
      onConnect()
    } else {
      socket.emit(SOCKET_EVENTS.SESSION_REQUEST)
    }

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off(SOCKET_EVENTS.CONNECTION_ACK, onConnectionAck)
      socket.off(SOCKET_EVENTS.SESSION_DATA, onSessionData)

      if (activePlacarChannel) {
        socket.off(activePlacarChannel, onPlacar)
      }
    }
  }, [])

  const requestSession = useCallback(() => {
    getSocket().emit(SOCKET_EVENTS.SESSION_REQUEST)
  }, [])

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
