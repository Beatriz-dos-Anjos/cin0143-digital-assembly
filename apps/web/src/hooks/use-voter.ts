"use client"

import { useCallback, useEffect, useState } from "react"
import { isValidTokenFormat, toServerOpcao, type Opcao } from "@/src/lib/assembly"
import {
  ApiRequestError,
  checkHealth,
  castVote,
  DEFAULT_SESSAO_ID,
  generateToken,
  getSession,
} from "@/src/lib/api"

type Feedback =
  | { tipo: "erro"; mensagem: string }
  | { tipo: "sucesso"; mensagem: string }
  | null

export function useVoter() {
  const [token, setToken] = useState("")
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [votando, setVotando] = useState<Opcao | null>(null)
  const [sessaoId, setSessaoId] = useState(DEFAULT_SESSAO_ID)
  const [connected, setConnected] = useState(false)
  const [gerandoToken, setGerandoToken] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function syncServerStatus() {
      const ok = await checkHealth()
      if (cancelled) return
      setConnected(ok)

      if (ok) {
        try {
          const session = await getSession(DEFAULT_SESSAO_ID)
          if (!cancelled) {
            setSessaoId(session.sessao_id)
          }
        } catch {
          // sessão indisponível; mantém DEFAULT_SESSAO_ID
        }
      }
    }

    void syncServerStatus()
    const interval = setInterval(() => {
      void syncServerStatus()
    }, 10_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const gerarToken = useCallback(async () => {
    if (!connected) {
      setFeedback({
        tipo: "erro",
        mensagem: "Sem conexão com o servidor. Aguarde ou recarregue a página.",
      })
      return
    }

    setFeedback(null)
    setToken("")
    setGerandoToken(true)

    try {
      const data = await generateToken(sessaoId || DEFAULT_SESSAO_ID)
      setToken(data.token)
      setSessaoId(data.sessao_id)
    } catch (error) {
      const mensagem =
        error instanceof ApiRequestError
          ? error.message
          : "Não foi possível gerar o token."
      setFeedback({ tipo: "erro", mensagem })
    } finally {
      setGerandoToken(false)
    }
  }, [connected, sessaoId])

  const alterarToken = useCallback((value: string) => {
    setToken(value)
  }, [])

  const registrarVoto = useCallback(
    async (opcao: Opcao) => {
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

      setVotando(opcao)

      try {
        await castVote(
          sessaoId || DEFAULT_SESSAO_ID,
          tokenValue,
          toServerOpcao(opcao),
        )
        setToken("")
        setFeedback({
          tipo: "sucesso",
          mensagem: "Voto registrado com sucesso. Obrigado!",
        })
      } catch (error) {
        const mensagem =
          error instanceof ApiRequestError
            ? error.message
            : "Não foi possível registrar o voto."
        setFeedback({ tipo: "erro", mensagem })
      } finally {
        setVotando(null)
      }
    },
    [token, connected, sessaoId],
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