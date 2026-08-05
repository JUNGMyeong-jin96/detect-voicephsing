import { API_BASE } from './client'
import type { ChapterResult, EvaluationResult } from './types'

export interface StreamMessageHandlers {
  onToken?: (chunk: string) => void
  onPersonaDone?: (content: string) => void
  onEvaluation?: (result: EvaluationResult) => void
  onChapterResult?: (result: ChapterResult) => void
  onError?: (error: { code: string; message: string }) => void
}

interface ParsedEvent {
  event: string
  data: string
}

function parseBlock(block: string): ParsedEvent | null {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim())
    }
  }
  if (dataLines.length === 0) return null
  return { event, data: dataLines.join('\n') }
}

function dispatch(parsed: ParsedEvent, handlers: StreamMessageHandlers): void {
  switch (parsed.event) {
    case 'token':
      handlers.onToken?.((JSON.parse(parsed.data) as { chunk: string }).chunk)
      break
    case 'persona_done':
      handlers.onPersonaDone?.((JSON.parse(parsed.data) as { content: string }).content)
      break
    case 'evaluation':
      handlers.onEvaluation?.(JSON.parse(parsed.data) as EvaluationResult)
      break
    case 'chapter_result':
      handlers.onChapterResult?.(JSON.parse(parsed.data) as ChapterResult)
      break
    case 'error':
      handlers.onError?.(JSON.parse(parsed.data) as { code: string; message: string })
      break
    default:
      break
  }
}

/**
 * The backend streams SSE over a POST response body, so the native EventSource
 * API (GET-only, no request body) can't be used. This reads the fetch stream
 * manually and parses `event:`/`data:` blocks separated by a blank line.
 */
export async function streamMessage(
  chapterId: string,
  sessionId: string,
  message: string,
  handlers: StreamMessageHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/chapters/${chapterId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message }),
    signal,
  })

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '')
    handlers.onError?.({ code: 'request_failed', message: `${response.status} ${detail}` })
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let separatorIndex = buffer.indexOf('\n\n')
    while (separatorIndex !== -1) {
      const rawBlock = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)
      const parsed = parseBlock(rawBlock)
      if (parsed) dispatch(parsed, handlers)
      separatorIndex = buffer.indexOf('\n\n')
    }
  }
}
