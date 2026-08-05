import { useEffect, useRef, useState } from 'react'
import { isSessionExpiredMessage, retryChapter } from '../api/client'
import { streamMessage } from '../api/sse'
import type { ChapterMeta, ChapterStatus, ChatMessage, EvaluationResult } from '../api/types'
import { ChatBubble } from './ChatBubble'

interface ChatScreenProps {
  chapterId: string
  sessionId: string
  chapterMeta: ChapterMeta
  openingLine: string
  initialAttemptsLeft: number
  onChapterFinished: (status: ChapterStatus, attemptsLeft: number) => void
  onSessionExpired: () => void
}

export function ChatScreen({
  chapterId,
  sessionId,
  chapterMeta,
  openingLine,
  initialAttemptsLeft,
  onChapterFinished,
  onSessionExpired,
}: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'persona', content: openingLine }])
  const [input, setInput] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [attemptsLeft, setAttemptsLeft] = useState(initialAttemptsLeft)
  const [lastEvaluation, setLastEvaluation] = useState<EvaluationResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [finalStatus, setFinalStatus] = useState<ChapterStatus | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  function handleExpired() {
    onSessionExpired()
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || isStreaming || finalStatus) return

    setInput('')
    setErrorMessage(null)
    setLastEvaluation(null)
    setMessages((prev) => [...prev, { role: 'player', content: text }])
    setIsStreaming(true)
    setStreamingText('')

    await streamMessage(chapterId, sessionId, text, {
      onToken: (chunk) => setStreamingText((prev) => prev + chunk),
      onPersonaDone: (content) => {
        setMessages((prev) => [...prev, { role: 'persona', content }])
        setStreamingText('')
      },
      onEvaluation: (result) => setLastEvaluation(result),
      onChapterResult: (result) => {
        setAttemptsLeft(result.attempts_left)
        if (result.status === 'success' || result.status === 'failed_final') {
          setFinalStatus(result.status)
        }
      },
      onError: (err) => {
        if (isSessionExpiredMessage(err.message)) {
          handleExpired()
          return
        }
        setErrorMessage(err.message)
      },
    })

    setIsStreaming(false)
  }

  async function handleRestartConversation() {
    setErrorMessage(null)
    try {
      const res = await retryChapter(chapterId, sessionId)
      setMessages([{ role: 'persona', content: res.opening_line }])
      setAttemptsLeft(res.attempts_left)
      setLastEvaluation(null)
      setStreamingText('')
    } catch (err) {
      const message = String(err)
      if (isSessionExpiredMessage(message)) {
        handleExpired()
      } else {
        setErrorMessage(message)
      }
    }
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col px-4 py-6">
      <header className="mb-4">
        <p className="text-xs tracking-wide text-slate-400 uppercase">
          Ch{chapterMeta.order}. {chapterMeta.title} · {chapterMeta.fraud_type}
        </p>
        <p className="text-sm text-slate-400">
          상대: {chapterMeta.persona_name} · 남은 시도: {attemptsLeft}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-4">
        {messages.map((message, index) => (
          <ChatBubble key={index} message={message} />
        ))}
        {isStreaming && streamingText && <ChatBubble message={{ role: 'persona', content: streamingText }} />}
        {isStreaming && !streamingText && <p className="text-sm text-slate-500">입력 중...</p>}
        <div ref={bottomRef} />
      </div>

      {lastEvaluation && (
        <div
          className={`mt-3 rounded-md p-3 text-sm ${
            lastEvaluation.success ? 'bg-emerald-900/50 text-emerald-200' : 'bg-slate-800 text-slate-300'
          }`}
        >
          <p className="font-medium">
            {lastEvaluation.success ? '침착하게 잘 대응했습니다' : '아직 대화가 진행 중입니다'}
          </p>
          <p className="mt-1 text-xs opacity-80">{lastEvaluation.reason}</p>
        </div>
      )}

      {errorMessage && <p className="mt-2 text-sm text-red-400">{errorMessage}</p>}

      {finalStatus ? (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => onChapterFinished(finalStatus, attemptsLeft)}
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white"
          >
            리포트 보기
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSend()
            }}
            placeholder="어떻게 대응할지 입력하세요..."
            disabled={isStreaming}
          />
          <button
            onClick={handleRestartConversation}
            disabled={isStreaming}
            className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-300 disabled:opacity-50"
            title="대화를 처음부터 다시 시작합니다 (이미 사용한 시도 횟수는 유지됩니다)"
          >
            초기화
          </button>
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-600"
          >
            전송
          </button>
        </div>
      )}
    </div>
  )
}
