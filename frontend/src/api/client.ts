import type { ChapterMeta, ChapterReport, ChoiceResponse, SessionInfo, StartChapterResponse } from './types'

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export function isSessionExpiredMessage(message: string): boolean {
  return message.startsWith('404')
}

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`${response.status} ${response.statusText}: ${detail}`)
  }
  return response.json() as Promise<T>
}

export function createSession(): Promise<SessionInfo> {
  return fetch(`${API_BASE}/api/sessions`, { method: 'POST' }).then(asJson<SessionInfo>)
}

export function getSession(sessionId: string): Promise<SessionInfo> {
  return fetch(`${API_BASE}/api/sessions/${sessionId}`).then(asJson<SessionInfo>)
}

export function deleteSession(sessionId: string): Promise<void> {
  return fetch(`${API_BASE}/api/sessions/${sessionId}`, { method: 'DELETE' }).then(() => undefined)
}

export function listChapters(): Promise<ChapterMeta[]> {
  return fetch(`${API_BASE}/api/chapters`).then(asJson<ChapterMeta[]>)
}

export function startChapter(chapterId: string, sessionId: string): Promise<StartChapterResponse> {
  return fetch(`${API_BASE}/api/chapters/${chapterId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  }).then(asJson<StartChapterResponse>)
}

export function retryChapter(chapterId: string, sessionId: string): Promise<StartChapterResponse> {
  return fetch(`${API_BASE}/api/chapters/${chapterId}/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  }).then(asJson<StartChapterResponse>)
}

export function sendChoice(
  chapterId: string,
  sessionId: string,
  nodeId: string,
  choiceId: string,
): Promise<ChoiceResponse> {
  return fetch(`${API_BASE}/api/chapters/${chapterId}/choice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, node_id: nodeId, choice_id: choiceId }),
  }).then(asJson<ChoiceResponse>)
}

export function getReport(chapterId: string, sessionId: string): Promise<ChapterReport> {
  const url = `${API_BASE}/api/chapters/${chapterId}/report?session_id=${encodeURIComponent(sessionId)}`
  return fetch(url).then(asJson<ChapterReport>)
}
