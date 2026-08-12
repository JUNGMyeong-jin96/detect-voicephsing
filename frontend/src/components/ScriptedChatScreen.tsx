import { useEffect, useRef, useState } from 'react'
import { isSessionExpiredMessage, retryChapter, sendChoice } from '../api/client'
import type { ChapterMeta, ChapterStatus, ChatMessage, DialogueNode, EvaluationResult } from '../api/types'
import { ChatBubble } from './ChatBubble'
import { PersonaAvatar } from './PersonaAvatar'

interface ScriptedChatScreenProps {
  chapterId: string
  sessionId: string
  chapterMeta: ChapterMeta
  openingLine: string
  initialDialogueNode: DialogueNode
  initialAttemptsLeft: number
  onChapterFinished: (status: ChapterStatus, attemptsLeft: number) => void
  onSessionExpired: () => void
}

export function ScriptedChatScreen({
  chapterId,
  sessionId,
  chapterMeta,
  openingLine,
  initialDialogueNode,
  initialAttemptsLeft,
  onChapterFinished,
  onSessionExpired,
}: ScriptedChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'persona', content: openingLine }])
  const [currentNode, setCurrentNode] = useState<DialogueNode | null>(initialDialogueNode)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attemptsLeft, setAttemptsLeft] = useState(initialAttemptsLeft)
  const [lastEvaluation, setLastEvaluation] = useState<EvaluationResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [finalStatus, setFinalStatus] = useState<ChapterStatus | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleExpired() {
    onSessionExpired()
  }

  async function handleChoice(choiceId: string, choiceText: string) {
    if (isSubmitting || finalStatus || !currentNode) return

    setErrorMessage(null)
    setLastEvaluation(null)
    setMessages((prev) => [...prev, { role: 'player', content: choiceText }])
    setIsSubmitting(true)

    try {
      const res = await sendChoice(chapterId, sessionId, currentNode.id, choiceId)
      if (res.dialogue_node) {
        setMessages((prev) => [...prev, { role: 'persona', content: res.dialogue_node!.persona_text }])
      }
      setCurrentNode(res.dialogue_node)
      setLastEvaluation(res.evaluation)
      setAttemptsLeft(res.chapter_result.attempts_left)
      if (res.chapter_result.status === 'success' || res.chapter_result.status === 'failed_final') {
        setFinalStatus(res.chapter_result.status)
      }
    } catch (err) {
      const message = String(err)
      if (isSessionExpiredMessage(message)) {
        handleExpired()
      } else {
        setErrorMessage(message)
      }
    }

    setIsSubmitting(false)
  }

  async function handleRetry() {
    setErrorMessage(null)
    try {
      const res = await retryChapter(chapterId, sessionId)
      setMessages([{ role: 'persona', content: res.opening_line }])
      setCurrentNode(res.dialogue_node ?? null)
      setAttemptsLeft(res.attempts_left)
      setLastEvaluation(null)
    } catch (err) {
      const message = String(err)
      if (isSessionExpiredMessage(message)) {
        handleExpired()
      } else {
        setErrorMessage(message)
      }
    }
  }

  const personaExpression = currentNode?.persona_expression ?? 'ended'

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col px-4 py-6">
      <header className="mb-4 flex items-center gap-3">
        <PersonaAvatar expression={personaExpression} personaName={chapterMeta.persona_name} chapterId={chapterId} />
        <div>
          <p className="text-xs tracking-wide text-slate-400 uppercase">
            Ch{chapterMeta.order}. {chapterMeta.title} · {chapterMeta.fraud_type}
          </p>
          <p className="text-sm text-slate-400">
            상대: {chapterMeta.persona_name} · 남은 시도: {attemptsLeft}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-4">
        <div className="flex min-h-full flex-col justify-end">
          {messages.map((message, index) => (
            <ChatBubble key={index} message={message} />
          ))}
          {isSubmitting && <p className="text-sm text-slate-400">응답 처리 중...</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      {lastEvaluation && (
        <div
          className={`mt-3 rounded-md p-3 text-sm ${
            lastEvaluation.success ? 'bg-emerald-900/50 text-emerald-200' : 'bg-slate-800 text-slate-300'
          }`}
        >
          <p className="font-medium">
            {lastEvaluation.success
              ? chapterMeta.role === 'attacker'
                ? '피해자를 성공적으로 설득했습니다'
                : '침착하게 잘 대응했습니다'
              : '아직 대화가 진행 중입니다'}
          </p>
          <p className="mt-1 text-xs opacity-80">{lastEvaluation.reason}</p>
        </div>
      )}

      {errorMessage && <p className="mt-2 text-sm text-red-400">{errorMessage}</p>}

      {finalStatus ? (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => onChapterFinished(finalStatus, attemptsLeft)}
            className="rounded-md bg-indigo-500 px-4 py-3 text-sm font-medium text-white"
          >
            리포트 보기
          </button>
        </div>
      ) : currentNode ? (
        <div className="mt-3 flex flex-col gap-2">
          {currentNode.choices.map((choice) => (
            <button
              key={choice.id}
              onClick={() => handleChoice(choice.id, choice.text)}
              disabled={isSubmitting}
              className="rounded-md border border-slate-600 bg-slate-800 px-4 py-3 text-left text-sm text-slate-100 disabled:opacity-50"
            >
              {choice.text}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleRetry}
            className="rounded-md border border-slate-600 px-4 py-3 text-sm text-slate-300"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  )
}
