import { useState } from 'react'
import { isSessionExpiredMessage, startChapter } from '../api/client'
import type { ChapterMeta, ChapterStatus, DialogueNode } from '../api/types'

interface ChapterSelectProps {
  chapters: ChapterMeta[]
  progress: Record<string, { status: ChapterStatus; attemptsLeft: number }>
  sessionId: string
  onEnterChapter: (
    chapterId: string,
    openingLine: string,
    attemptsLeft: number,
    dialogueNode?: DialogueNode,
  ) => void
  onSessionExpired: () => void
}

function statusLabel(status: ChapterStatus | undefined): string {
  switch (status) {
    case 'success':
      return '성공'
    case 'failed_final':
      return '최종 실패 (다시 도전하세요)'
    case 'in_progress':
      return '진행 중'
    default:
      return ''
  }
}

export function ChapterSelect({
  chapters,
  progress,
  sessionId,
  onEnterChapter,
  onSessionExpired,
}: ChapterSelectProps) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function isUnlocked(index: number): boolean {
    if (index === 0) return true
    const prevStatus = progress[chapters[index - 1].id]?.status
    return prevStatus === 'success'
  }

  async function handleStart(chapterId: string) {
    setErrorMessage(null)
    setPendingId(chapterId)
    try {
      const res = await startChapter(chapterId, sessionId)
      onEnterChapter(chapterId, res.opening_line, res.attempts_left, res.dialogue_node)
    } catch (err) {
      const message = String(err)
      if (isSessionExpiredMessage(message)) {
        onSessionExpired()
      } else {
        setErrorMessage(message)
      }
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-100">보이스피싱 대응 훈련 시뮬레이션</h1>
      <p className="mt-1 text-sm text-slate-400">챕터를 선택해 시작하세요.</p>

      {errorMessage && <p className="mt-4 text-sm text-red-400">{errorMessage}</p>}

      <ul className="mt-6 flex flex-col gap-3">
        {chapters.map((chapter, index) => {
          const unlocked = isUnlocked(index)
          const status = progress[chapter.id]?.status
          return (
            <li
              key={chapter.id}
              className={`rounded-lg border border-slate-700 p-4 ${
                unlocked ? 'bg-slate-800' : 'bg-slate-900 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs tracking-wide text-slate-400 uppercase">
                    {chapter.difficulty} · {chapter.fraud_type}
                  </p>
                  <h2 className="text-lg font-medium text-slate-100">
                    Ch{chapter.order}. {chapter.title}
                  </h2>
                </div>
                <button
                  disabled={!unlocked || pendingId === chapter.id}
                  onClick={() => handleStart(chapter.id)}
                  className="rounded-md bg-indigo-500 px-3 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-600"
                >
                  {!unlocked ? '잠김' : status ? '다시 시작' : '시작'}
                </button>
              </div>
              {status && <p className="mt-2 text-xs text-slate-400">{statusLabel(status)}</p>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
