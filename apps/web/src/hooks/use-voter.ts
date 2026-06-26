"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  formatCastVote,
  isValidTokenFormat,
  type Opcao,
} from "@/src/lib/assembly"
import {
  connectSocket,
  getSocket,
  SOCKET_EVENTS,
  type ClientRegistered,
  type GenerateTokenResponse,
  type VoteErrorPayload,
} from "@/src/lib/socket"

type Feedback =
  | { tipo: "erro"; mensagem: string }
  | { tipo: "sucesso"; mensagem: string }
  | null

export function useVoter() {
  const [token, setToken] = useState("")
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [votando, setVotando] = useState<Opcao | null>(null)
  const [sessaoId, setSessaoId] = useState("")
  const [connected, setConnected] = useState(false)
  const [gerandoToken, setGerandoToken] = useState(false)

  const socketToken = useRef<string | null>(null)
  const pendingVote = useRef<Opcao | null>(null)
  const awaitingRegister = useRef(false)
  const awaitingTokenGeneration = useRef(false)

  useEffect(() => {
    const socket = connectSocket()

    const onConnect = () => setConnected(true)
    const onDisconnect = () => {
      setConnected(false)
      setGerandoToken(false)
      awaitingTokenGeneration.current = false
      socketToken.current = null
      setToken("")
    }

    const emitVote = (tokenValue: string, opcao: Opcao) => {
      getSocket().emit(
        SOCKET_EVENTS.CAST_VOTE,
        formatCastVote(tokenValue, opcao),
      )
    }

    const onTokenGenerated = (data: GenerateTokenResponse) => {
      if (!awaitingTokenGeneration.current) return

      awaitingTokenGeneration.current = false
      setGerandoToken(false)
      socketToken.current = data.token
      setToken(data.token)
    }

    const onRegistered = (data: ClientRegistered) => {
      awaitingRegister.current = false
      socketToken.current = data.token
      setSessaoId(data.sessao_id)

      const opcao = pendingVote.current
      if (opcao) {
        emitVote(data.token, opcao)
      } else {
        setVotando(null)
      }
    }

    const onVoteAccepted = () => {
      pendingVote.current = null
      setVotando(null)
      setToken("")
      socketToken.current = null
      setFeedback({
        tipo: "sucesso",
        mensagem: "Voto registrado com sucesso. Obrigado!",
      })
    }

    const onVoteError = (error: VoteErrorPayload) => {
      if (awaitingRegister.current) {
        awaitingRegister.current = false
        pendingVote.current = null
        setVotando(null)
        setFeedback({
          tipo: "erro",
          mensagem: error.message ?? "Token não autorizado.",
        })
        return
      }

      pendingVote.current = null
      setVotando(null)
      setFeedback({
        tipo: "erro",
        mensagem: error.message ?? "Não foi possível registrar o voto.",
      })
    }

    const onConnectionAck = (data: { sessao_id: string }) => {
      setSessaoId(data.sessao_id)
    }

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on(SOCKET_EVENTS.CLIENT_REGISTERED, onRegistered)
    socket.on(SOCKET_EVENTS.GENERATE_TOKEN_RESPONSE, onTokenGenerated)
    socket.on(SOCKET_EVENTS.VOTE_ACCEPTED, onVoteAccepted)
    socket.on(SOCKET_EVENTS.VOTE_ERROR, onVoteError)
    socket.on(SOCKET_EVENTS.CONNECTION_ACK, onConnectionAck)

    if (socket.connected) {
      onConnect()
    }

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off(SOCKET_EVENTS.CLIENT_REGISTERED, onRegistered)
      socket.off(SOCKET_EVENTS.GENERATE_TOKEN_RESPONSE, onTokenGenerated)
      socket.off(SOCKET_EVENTS.VOTE_ACCEPTED, onVoteAccepted)
      socket.off(SOCKET_EVENTS.VOTE_ERROR, onVoteError)
      socket.off(SOCKET_EVENTS.CONNECTION_ACK, onConnectionAck)
    }
  }, [])

  const gerarToken = useCallback(() => {
    if (!connected) {
      setFeedback({
        tipo: "erro",
        mensagem: "Sem conexão com o servidor. Aguarde ou recarregue a página.",
      })
      return
    }

    setFeedback(null)
    setToken("")
    socketToken.current = null
    awaitingTokenGeneration.current = true
    setGerandoToken(true)
    getSocket().emit(SOCKET_EVENTS.GENERATE_TOKEN_REQUEST)
  }, [connected])

  const alterarToken = useCallback((value: string) => {
    setToken(value)
    const trimmed = value.trim()
    if (socketToken.current && socketToken.current !== trimmed) {
      socketToken.current = null
    }
  }, [])

  const registrarVoto = useCallback(
    (opcao: Opcao) => {
      setFeedback(null)
      const tokenValue = token.trim()

      if (!tokenValue) {
        setFeedback({
          tipo: "erro",
          mensagem: "Informe um token antes de votar.",
        })
        return
      }

      if (!isValidTokenFormat(tokenValue)) {
        setFeedback({
          tipo: "erro",
          mensagem: "Token inválido. Use o código completo fornecido pela assembleia.",
        })
        return
      }

      if (!connected) {
        setFeedback({
          tipo: "erro",
          mensagem: "Sem conexão com o servidor. Aguarde ou recarregue a página.",
        })
        return
      }

      pendingVote.current = opcao
      setVotando(opcao)

      if (socketToken.current === tokenValue) {
        getSocket().emit(
          SOCKET_EVENTS.CAST_VOTE,
          formatCastVote(tokenValue, opcao),
        )
        return
      }

      awaitingRegister.current = true
      socketToken.current = null
      getSocket().emit(SOCKET_EVENTS.CLIENT_REGISTER, { token: tokenValue })
    },
    [token, connected],
  )

  return {
    token,
    setToken: alterarToken,
    feedback,
    votando,
    sessaoId,
    connected,
    gerandoToken,
    gerarToken,
    registrarVoto,
  }
}
