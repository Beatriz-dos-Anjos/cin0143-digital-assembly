export const API_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001"

export const DEFAULT_SESSION_ID =
  process.env.NEXT_PUBLIC_DEFAULT_SESSION_ID ?? "assembleia-2026-06"

export interface ServerScore {
  sim: number
  nao: number
}

export interface SessionTimerFields {
  started_at: number
  duration_seconds: number
}

export interface SessionResponse extends SessionTimerFields {
  session_id: string
  current_score: ServerScore
  total_authorized: number
  total_voted: number
  votes_cast?: { token: string; vote: string; timestamp: string }[]
}

export interface GenerateTokenResponse {
  token: string
  session_id: string
}

export interface VoteResponse {
  success: true
  token: string
  session_id: string
  current_score: ServerScore
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
    throw new ApiRequestError(res.statusText || "Request failed")
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

export async function getSession(sessionId: string): Promise<SessionResponse> {
  return request<SessionResponse>(`/sessions/${encodeURIComponent(sessionId)}`)
}

export async function generateToken(
  sessionId: string,
): Promise<GenerateTokenResponse> {
  return request<GenerateTokenResponse>(
    `/api/sessions/${encodeURIComponent(sessionId)}/tokens/generate`,
    { method: "POST" },
  )
}

export async function castVote(
  sessionId: string,
  token: string,
  option: "sim" | "nao",
): Promise<VoteResponse> {
  return request<VoteResponse>(
    `/api/sessions/${encodeURIComponent(sessionId)}/votes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, option }),
    },
  )
}

export interface ResetSessionResponse extends SessionTimerFields {
  success: true
  session_id: string
  current_score: ServerScore
}

export async function resetSession(
  sessionId: string,
): Promise<ResetSessionResponse> {
  return request<ResetSessionResponse>(
    `/api/sessions/${encodeURIComponent(sessionId)}/reset`,
    { method: "POST" },
  )
}

export interface AuthorizedTokensResponse {
  authorized_tokens: string[]
}

export interface RegisteredVotesResponse {
  votes: { token: string; vote: string; timestamp: string }[]
}

export interface PlacarResponse {
  sim: number
  nao: number
}

export interface SessionSnapshotResponse extends SessionTimerFields {
  session_id: string
  current_score: ServerScore
  authorized_tokens: string[]
  voted_tokens: string[]
}

export async function getAuthorizedTokens(
  sessionId: string,
): Promise<AuthorizedTokensResponse> {
  return request<AuthorizedTokensResponse>(
    `/api/tokens?sessionId=${encodeURIComponent(sessionId)}`,
  )
}

export async function getRegisteredVotes(
  sessionId: string,
): Promise<RegisteredVotesResponse> {
  return request<RegisteredVotesResponse>(
    `/api/votes?sessionId=${encodeURIComponent(sessionId)}`,
  )
}

export async function getScore(sessionId: string): Promise<PlacarResponse> {
  return request<PlacarResponse>(
    `/api/score?sessionId=${encodeURIComponent(sessionId)}`,
  )
}

export async function getSessionSnapshot(
  sessionId: string,
): Promise<SessionSnapshotResponse> {
  return request<SessionSnapshotResponse>(
    `/api/session?sessionId=${encodeURIComponent(sessionId)}`,
  )
}
