"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toServerOption, type VoteOption } from "@/src/lib/assembly"
import {
  ApiRequestError,
  checkHealth,
  castVote,
  DEFAULT_SESSION_ID,
  generateToken,
  getSession,
} from "@/src/lib/api"

type Feedback =
  | { type: "error" | "success"; message: string }
  | null

export function useVoter() {
  const [token, setToken] = useState("")
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [voting, setVoting] = useState<VoteOption | null>(null)
  const [sessionId, setSessionId] = useState(DEFAULT_SESSION_ID)
  const [connected, setConnected] = useState(false)
  const [generatingToken, setGeneratingToken] = useState(false)
  const requestQueueRef = useRef(Promise.resolve())

  const enqueueExclusive = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const next = requestQueueRef.current.then(task, task)
    requestQueueRef.current = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }, [])

  useEffect(() => {
    let cancelled = false

    async function syncServerStatus() {
      const ok = await checkHealth()
      if (cancelled) return
      setConnected(ok)

      if (ok) {
        try {
          const session = await getSession(DEFAULT_SESSION_ID)
          if (!cancelled) {
            setSessionId(session.session_id)
          }
        } catch {
          // session unavailable; keep DEFAULT_SESSION_ID
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

  const generateNewToken = useCallback(async (): Promise<string | null> => {
    return enqueueExclusive(async () => {
      if (!connected) {
        setFeedback({
          type: "error",
          message: "No connection to the server. Please wait or reload the page.",
        })
        return null
      }

      setFeedback(null)
      setToken("")
      setGeneratingToken(true)

      try {
        const data = await generateToken(sessionId || DEFAULT_SESSION_ID)
        setToken(data.token)
        setSessionId(data.session_id)
        return data.token
      } catch (error) {
        const message =
          error instanceof ApiRequestError
            ? error.message
            : "Could not generate token."
        setFeedback({ type: "error", message })
        return null
      } finally {
        setGeneratingToken(false)
      }
    })
  }, [connected, enqueueExclusive, sessionId])

  const changeToken = useCallback((value: string) => {
    setToken(value)
  }, [])

  const submitVote = useCallback(
    async (option: VoteOption) => {
      const tokenValue = token.trim()

      await enqueueExclusive(async () => {
        setFeedback(null)

        if (!tokenValue) {
          setFeedback({
            type: "error",
            message: "Please enter a token before voting.",
          })
          return
        }

        if (!connected) {
          setFeedback({
            type: "error",
            message: "No connection to the server. Please wait or reload the page.",
          })
          return
        }

        setVoting(option)

        try {
          await castVote(
            sessionId || DEFAULT_SESSION_ID,
            tokenValue,
            toServerOption(option),
          )
          setToken("")
          setFeedback({
            type: "success",
            message: "Vote successfully cast. Thank you!",
          })
        } catch (error) {
          const message =
            error instanceof ApiRequestError
              ? error.message
              : "Could not register vote."
          setFeedback({ type: "error", message })
        } finally {
          setVoting(null)
        }
      })
    },
    [token, connected, enqueueExclusive, sessionId],
  )

  const clearState = useCallback(() => {
    setToken("")
    setFeedback(null)
    setVoting(null)
  }, [])

  const showError = useCallback((message: string) => {
    setFeedback({ type: "error", message })
  }, [])

  return {
    token,
    setToken: changeToken,
    feedback,
    voting,
    sessionId,
    connected,
    generatingToken,
    generateToken: generateNewToken,
    submitVote,
    clearState,
    showError,
  }
}
