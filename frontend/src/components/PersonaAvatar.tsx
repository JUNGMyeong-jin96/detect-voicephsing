import ch1Neutral from '../assets/personas/ch1/neutral_official.png'
import ch1Urgent from '../assets/personas/ch1/urgent.png'
import ch1Secretive from '../assets/personas/ch1/secretive.png'
import ch1UrgentFinal from '../assets/personas/ch1/urgent_final.png'
import ch1Ended from '../assets/personas/ch1/ended.png'

const PERSONA_IMAGES: Record<string, Record<string, string>> = {
  ch1: {
    neutral_official: ch1Neutral,
    urgent: ch1Urgent,
    secretive: ch1Secretive,
    urgent_final: ch1UrgentFinal,
    ended: ch1Ended,
  },
}

type BrowStyle = 'flat' | 'angry' | 'worried' | 'raised'
type EyeStyle = 'normal' | 'wide' | 'closed'
type MouthStyle = 'flat' | 'frown' | 'smile' | 'open' | 'openWide' | 'wave'

type ExpressionConfig = {
  brow: BrowStyle
  eye: EyeStyle
  mouth: MouthStyle
  sweat: number
  bg: string
}

const EXPRESSION_MAP: Record<string, ExpressionConfig> = {
  neutral_official: { brow: 'flat', eye: 'normal', mouth: 'flat', sweat: 0, bg: 'bg-slate-700' },
  pressuring: { brow: 'angry', eye: 'normal', mouth: 'frown', sweat: 0, bg: 'bg-amber-700' },
  urgent: { brow: 'raised', eye: 'wide', mouth: 'open', sweat: 1, bg: 'bg-orange-700' },
  urgent_final: { brow: 'raised', eye: 'wide', mouth: 'openWide', sweat: 2, bg: 'bg-red-700' },
  friendly_pitch: { brow: 'flat', eye: 'normal', mouth: 'smile', sweat: 0, bg: 'bg-sky-700' },
  reassuring_urgent: { brow: 'worried', eye: 'normal', mouth: 'smile', sweat: 1, bg: 'bg-amber-600' },
  official_pressure: { brow: 'angry', eye: 'normal', mouth: 'flat', sweat: 0, bg: 'bg-amber-700' },
  panicked: { brow: 'raised', eye: 'wide', mouth: 'openWide', sweat: 2, bg: 'bg-red-800' },
  worried: { brow: 'worried', eye: 'normal', mouth: 'wave', sweat: 0, bg: 'bg-orange-600' },
  relieved: { brow: 'flat', eye: 'closed', mouth: 'smile', sweat: 0, bg: 'bg-emerald-700' },
  secretive: { brow: 'worried', eye: 'normal', mouth: 'flat', sweat: 0, bg: 'bg-indigo-800' },
  ended: { brow: 'flat', eye: 'normal', mouth: 'flat', sweat: 0, bg: 'bg-slate-600' },
}

const DEFAULT_EXPRESSION: ExpressionConfig = { brow: 'flat', eye: 'normal', mouth: 'smile', sweat: 0, bg: 'bg-slate-700' }

const BROW_PATHS: Record<BrowStyle, { left: string; right: string }> = {
  flat: { left: 'M9,12 L15,12', right: 'M25,12 L31,12' },
  angry: { left: 'M9,10 L15,13', right: 'M31,10 L25,13' },
  worried: { left: 'M9,13 L15,10', right: 'M31,13 L25,10' },
  raised: { left: 'M9,9 L15,9', right: 'M25,9 L31,9' },
}

const MOUTH_PATHS: Record<'flat' | 'frown' | 'smile' | 'wave', string> = {
  flat: 'M14,26 L26,26',
  frown: 'M14,28 Q20,24 26,28',
  smile: 'M14,25 Q20,29 26,25',
  wave: 'M14,26 Q17,23.5 20,26 Q23,28.5 26,26',
}

function Eyes({ style }: { style: EyeStyle }) {
  if (style === 'closed') {
    return (
      <>
        <path d="M11,17 Q14,14 17,17" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M23,17 Q26,14 29,17" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    )
  }
  const r = style === 'wide' ? 3.2 : 2.2
  const pupilR = style === 'wide' ? 1.3 : 1
  return (
    <>
      <circle cx="14" cy="17" r={r} fill="white" />
      <circle cx="14" cy="17" r={pupilR} fill="#0f172a" />
      <circle cx="26" cy="17" r={r} fill="white" />
      <circle cx="26" cy="17" r={pupilR} fill="#0f172a" />
    </>
  )
}

function Mouth({ style }: { style: MouthStyle }) {
  if (style === 'open') {
    return <ellipse cx="20" cy="26.5" rx="3.5" ry="3" fill="#0f172a" stroke="white" strokeWidth="1" />
  }
  if (style === 'openWide') {
    return <ellipse cx="20" cy="27" rx="4.5" ry="4.5" fill="#0f172a" stroke="white" strokeWidth="1" />
  }
  return <path d={MOUTH_PATHS[style]} stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
}

function Sweat({ count }: { count: number }) {
  if (!count) return null
  return (
    <>
      <path d="M31,7 Q33.2,10.5 31,13 Q28.8,10.5 31,7 Z" fill="#7dd3fc" opacity="0.9" />
      {count > 1 && <path d="M35,12 Q36.6,14.7 35,17 Q33.4,14.7 35,12 Z" fill="#7dd3fc" opacity="0.9" />}
    </>
  )
}

export function PersonaAvatar({
  expression,
  personaName,
  chapterId,
}: {
  expression: string
  personaName: string
  chapterId?: string
}) {
  const imageUrl = chapterId ? PERSONA_IMAGES[chapterId]?.[expression] : undefined
  const config = EXPRESSION_MAP[expression] ?? DEFAULT_EXPRESSION
  const brows = BROW_PATHS[config.brow]
  return (
    <div
      data-expression={expression}
      role="img"
      aria-label={`${personaName} 표정`}
      className="h-16 w-16 shrink-0 overflow-hidden rounded-full"
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className={`flex h-full w-full items-center justify-center ${config.bg}`}>
          <svg viewBox="0 0 40 40" className="h-11 w-11" aria-hidden="true">
            <path d={brows.left} stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            <path d={brows.right} stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            <Eyes style={config.eye} />
            <Mouth style={config.mouth} />
            <Sweat count={config.sweat} />
          </svg>
        </div>
      )}
    </div>
  )
}
