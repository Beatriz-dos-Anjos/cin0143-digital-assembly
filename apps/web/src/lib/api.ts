export const API_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001"

export const DEFAULT_SESSAO_ID =
  process.env.NEXT_PUBLIC_DEFAULT_SESSAO_ID ?? "assembleia-2026-06"

export interface ServerPlacar {
  sim: number
  nao: number
}

export interface SessionResponse {
  sessao_id: string
  placar_atual: ServerPlacar
  total_autorizados: number
  total_votaram: number
  
}

export interface GenerateTokenResponse {
  token: string
  sessao_id: string
}

export interface VoteResponse {
  success: true
  token: string
  sessao_id: string
  placar_atual: ServerPlacar
}

export interface ApiErrorBody {
  code: string
  message: string
  severity?: string
}

export class ApiRequestError extends Error {
  code: string

  constructor(message: string, code = "REQUEST_FAILED") {
    super(message)
    this.code = code
    this.name = "ApiRequestError"
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T
  } catch {
    return {} as T
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init)
  const data = await parseJson<{ error?: ApiErrorBody | string } & T>(res)

  if (!res.ok) {
    const err = data.error
    if (typeof err === "object" && err !== null && "message" in err) {
      throw new ApiRequestError(err.message, err.code)
    }
    if (typeof err === "string") {
      throw new ApiRequestError(err)
    }
    throw new ApiRequestError(res.statusText || "Falha na requisição")
  }

  return data
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`)
    return res.ok
  } catch {
    return false
  }
}

export async function getSession(sessaoId: string): Promise<SessionResponse> {
  return request<SessionResponse>(`/sessions/${encodeURIComponent(sessaoId)}`)
}

export async function generateToken(
  sessaoId: string,
): Promise<GenerateTokenResponse> {
  return request<GenerateTokenResponse>(
    `/api/sessions/${encodeURIComponent(sessaoId)}/tokens/generate`,
    { method: "POST" },
  )
}

export async function castVote(
  sessaoId: string,
  token: string,
  opcao: "sim" | "nao",
): Promise<VoteResponse> {
  return request<VoteResponse>(
    `/api/sessions/${encodeURIComponent(sessaoId)}/votes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, opcao }),
    },
  )
}