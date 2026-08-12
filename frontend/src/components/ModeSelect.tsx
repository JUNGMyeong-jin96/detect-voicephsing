import type { ChapterRole } from '../api/types'

interface ModeSelectProps {
  onSelectMode: (role: ChapterRole) => void
}

export function ModeSelect({ onSelectMode }: ModeSelectProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-100">보이스피싱 대응 훈련 시뮬레이션</h1>
      <p className="mt-1 text-sm text-slate-400">모드를 선택해 시작하세요.</p>

      <div className="mt-6 flex flex-col gap-3">
        <button
          onClick={() => onSelectMode('victim')}
          className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-left hover:border-indigo-500"
        >
          <h2 className="text-lg font-medium text-slate-100">피해자 모드</h2>
          <p className="mt-1 text-sm text-slate-400">
            걸려오는 보이스피싱을 직접 겪으며 침착하게 대응하는 법을 훈련합니다.
          </p>
        </button>

        <button
          onClick={() => onSelectMode('attacker')}
          className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-left hover:border-indigo-500"
        >
          <h2 className="text-lg font-medium text-slate-100">가해자 모드 (외전)</h2>
          <p className="mt-1 text-sm text-slate-400">
            보이스피싱 조직원의 시점에서 수법을 역으로 체험하며, 실제 상황에서 알아챌 수
            있도록 훈련합니다.
          </p>
        </button>
      </div>
    </div>
  )
}
