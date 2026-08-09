const EXPRESSION_MAP: Record<string, { emoji: string; bg: string }> = {
  neutral_official: { emoji: '🧑‍💼', bg: 'bg-slate-700' },
  pressuring: { emoji: '😠', bg: 'bg-amber-700' },
  urgent: { emoji: '😨', bg: 'bg-orange-700' },
  urgent_final: { emoji: '😰', bg: 'bg-red-700' },
  friendly_pitch: { emoji: '🤝', bg: 'bg-sky-700' },
  reassuring_urgent: { emoji: '😅', bg: 'bg-amber-600' },
  official_pressure: { emoji: '🧑‍💼', bg: 'bg-amber-700' },
  panicked: { emoji: '😱', bg: 'bg-red-800' },
  worried: { emoji: '😟', bg: 'bg-orange-600' },
  relieved: { emoji: '😌', bg: 'bg-emerald-700' },
}

const DEFAULT_EXPRESSION = { emoji: '🙂', bg: 'bg-slate-700' }

// 실제 페르소나 일러스트로 교체 전까지 사용하는 표정 placeholder.
export function PersonaAvatar({ expression, personaName }: { expression: string; personaName: string }) {
  const { emoji, bg } = EXPRESSION_MAP[expression] ?? DEFAULT_EXPRESSION
  return (
    <div
      data-expression={expression}
      role="img"
      aria-label={`${personaName} 표정`}
      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl ${bg}`}
    >
      {emoji}
    </div>
  )
}
