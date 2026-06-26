"use client"

import { useCallback, useEffect, useState } from "react"
import {
  getEstado,
  reiniciarSessao,
  segundosRestantes,
  sessaoEncerrada,
  subscribe,
  type SessaoState,
} from "@/src/lib/assembly"

/**
 * Hook que mantém o estado da sessão sincronizado em tempo real:
 *  - escuta o broadcast do placar (subscribe)
 *  - atualiza o cronômetro a cada segundo
 */
export function useAssembly() {
  const [state, setState] = useState<SessaoState | null>(null)
  const [restante, setRestante] = useState<number>(0)

  useEffect(() => {
    // estado inicial vindo do "servidor"
    const inicial = getEstado()
    setState(inicial)
    setRestante(segundosRestantes(inicial))

    // recebe atualizações de placar via broadcast
    const unsubscribe = subscribe((novo) => {
      setState(novo)
      setRestante(segundosRestantes(novo))
    })

    return unsubscribe
  }, [])

  // tick do cronômetro
  useEffect(() => {
    if (!state) return
    const id = setInterval(() => {
      setRestante(segundosRestantes(state))
    }, 250)
    return () => clearInterval(id)
  }, [state])

  const reiniciar = useCallback(() => {
    const novo = reiniciarSessao()
    setState(novo)
    setRestante(segundosRestantes(novo))
  }, [])

  return {
    state,
    segundosRestantes: restante,
    encerrada: state ? sessaoEncerrada(state) || restante <= 0 : false,
    reiniciar,
  }
}

export function formatarTempo(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}
