import { useEffect, useState } from 'react'
import { listChapters } from './api/client'
import type { ChapterMeta, ChapterStatus, DialogueNode } from './api/types'
import { ChapterSelect } from './components/ChapterSelect'
import { ChatScreen } from './components/ChatScreen'
import { ReportScreen } from './components/ReportScreen'
import { ScriptedChatScreen } from './components/ScriptedChatScreen'
import { useSession } from './hooks/useSession'

type View =
  | { name: 'loading' }
  | { name: 'chapter-select' }
  | { name: 'chat'; chapterId: string; openingLine: string; attemptsLeft: number; dialogueNode?: DialogueNode }
  | { name: 'report'; chapterId: string }

type Progress = Record<string, { status: ChapterStatus; attemptsLeft: number }>

function App() {
  const { sessionId, error: sessionError, resetSession } = useSession()
  const [chapters, setChapters] = useState<ChapterMeta[]>([])
  const [progress, setProgress] = useState<Progress>({})
  const [view, setView] = useState<View>({ name: 'loading' })
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    listChapters()
      .then((data) => {
        setChapters(data)
        setView({ name: 'chapter-select' })
      })
      .catch((err) => setLoadError(String(err)))
  }, [])

  function handleSessionExpired() {
    setProgress({})
    setView({ name: 'chapter-select' })
    resetSession()
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      {sessionError && <p className="p-4 text-sm text-red-400">세션 생성 실패: {sessionError}</p>}
      {loadError && <p className="p-4 text-sm text-red-400">챕터 목록을 불러오지 못했습니다: {loadError}</p>}

      {view.name === 'loading' && <p className="p-10 text-sm text-slate-400">불러오는 중...</p>}

      {view.name === 'chapter-select' && sessionId && (
        <ChapterSelect
          chapters={chapters}
          progress={progress}
          sessionId={sessionId}
          onEnterChapter={(chapterId, openingLine, attemptsLeft, dialogueNode) =>
            setView({ name: 'chat', chapterId, openingLine, attemptsLeft, dialogueNode })
          }
          onSessionExpired={handleSessionExpired}
        />
      )}

      {view.name === 'chat' &&
        sessionId &&
        (() => {
          const chapterMeta = chapters.find((c) => c.id === view.chapterId)
          if (!chapterMeta) return null

          const onChapterFinished = (status: ChapterStatus, attemptsLeft: number) => {
            setProgress((prev) => ({ ...prev, [view.chapterId]: { status, attemptsLeft } }))
            setView({ name: 'report', chapterId: view.chapterId })
          }

          if (chapterMeta.mode === 'scripted' && view.dialogueNode) {
            return (
              <ScriptedChatScreen
                chapterId={view.chapterId}
                sessionId={sessionId}
                chapterMeta={chapterMeta}
                openingLine={view.openingLine}
                initialDialogueNode={view.dialogueNode}
                initialAttemptsLeft={view.attemptsLeft}
                onChapterFinished={onChapterFinished}
                onSessionExpired={handleSessionExpired}
              />
            )
          }

          return (
            <ChatScreen
              chapterId={view.chapterId}
              sessionId={sessionId}
              chapterMeta={chapterMeta}
              openingLine={view.openingLine}
              initialAttemptsLeft={view.attemptsLeft}
              onChapterFinished={onChapterFinished}
              onSessionExpired={handleSessionExpired}
            />
          )
        })()}

      {view.name === 'report' && sessionId && (
        <ReportScreen
          chapterId={view.chapterId}
          sessionId={sessionId}
          chapters={chapters}
          onBackToChapters={() => setView({ name: 'chapter-select' })}
          onNextChapter={(chapterId, openingLine, attemptsLeft, dialogueNode) =>
            setView({ name: 'chat', chapterId, openingLine, attemptsLeft, dialogueNode })
          }
          onSessionExpired={handleSessionExpired}
        />
      )}
    </div>
  )
}

export default App
