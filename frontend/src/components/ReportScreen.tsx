import { useEffect, useState } from 'react'
import { getReport, isSessionExpiredMessage, startChapter } from '../api/client'
import type { ChapterMeta, ChapterReport } from '../api/types'

interface ReportScreenProps {
  chapterId: string
  sessionId: string
  chapters: ChapterMeta[]
  onBackToChapters: () => void
  onNextChapter: (chapterId: string, openingLine: string, attemptsLeft: number) => void
  onSessionExpired: () => void
}

export function ReportScreen({
  chapterId,
  sessionId,
  chapters,
  onBackToChapters,
  onNextChapter,
  onSessionExpired,
}: ReportScreenProps) {
  const [report, setReport] = useState<ChapterReport | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [movingNext, setMovingNext] = useState(false)

  useEffect(() => {
    setReport(null)
    getReport(chapterId, sessionId).catch((err) => {
      const message = String(err)
      if (isSessionExpiredMessage(message)) {
        onSessionExpired()
      } else {
        setErrorMessage(message)
      }
      return null
    }).then((result) => {
      if (result) setReport(result)
    })
  }, [chapterId, sessionId, onSessionExpired])

  const currentIndex = chapters.findIndex((c) => c.id === chapterId)
  const nextChapter = chapters[currentIndex + 1]

  async function handleNext() {
    if (!nextChapter) return
    setMovingNext(true)
    setErrorMessage(null)
    try {
      const res = await startChapter(nextChapter.id, sessionId)
      onNextChapter(nextChapter.id, res.opening_line, res.attempts_left)
    } catch (err) {
      const message = String(err)
      if (isSessionExpiredMessage(message)) {
        onSessionExpired()
      } else {
        setErrorMessage(message)
      }
    } finally {
      setMovingNext(false)
    }
  }

  if (errorMessage) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-red-400">{errorMessage}</div>
  if (!report) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-400">리포트를 불러오는 중...</div>

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold text-slate-100">
        {report.outcome === 'success'
          ? '챕터 클리어 — 사기를 막아냈습니다!'
          : '챕터 종료 — 사기에 넘어갔습니다. 다시 도전해보세요.'}
      </h1>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-slate-300">이번 챕터에서 확인된 신호</h2>
        <p className="mt-1 text-xs text-slate-500">
          AI가 사용한 사기 수법과, 당신의 대응 중 주의가 필요했던 부분입니다.
        </p>
        {report.matched_patterns_summary.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">감지된 패턴이 없습니다.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {report.matched_patterns_summary.map((pattern) => (
              <li key={pattern} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
                {pattern}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-slate-300">실제 예방 수칙</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {report.tips.map((tip, index) => (
            <li key={index} className="rounded-md bg-slate-800 p-3 text-sm text-slate-200">
              {tip}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex justify-end gap-2">
        <button
          onClick={onBackToChapters}
          className="rounded-md border border-slate-600 px-4 py-3 text-sm text-slate-200"
        >
          챕터 목록
        </button>
        {report.outcome === 'success' && nextChapter && (
          <button
            onClick={handleNext}
            disabled={movingNext}
            className="rounded-md bg-indigo-500 px-4 py-3 text-sm font-medium text-white disabled:bg-slate-600"
          >
            다음 챕터로
          </button>
        )}
      </div>
    </div>
  )
}
