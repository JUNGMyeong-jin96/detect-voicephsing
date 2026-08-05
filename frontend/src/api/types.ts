export type ChapterStatus = 'locked' | 'in_progress' | 'success' | 'failed_final'

export interface ChapterMeta {
  id: string
  order: number
  title: string
  fraud_type: string
  difficulty: string
  persona_name: string
  max_attempts: number
}

export interface SessionInfo {
  session_id: string
  expires_at: string
  current_chapter_id: string
}

export interface StartChapterResponse {
  chapter_id: string
  attempts_left: number
  opening_line: string
}

export interface EvaluationResult {
  success: boolean
  matched_patterns: string[]
  reason: string
  feedback_hint: string
}

export interface ChapterResult {
  status: ChapterStatus
  attempts_left: number
}

export interface ChapterReport {
  chapter_id: string
  outcome: ChapterStatus
  matched_patterns_summary: string[]
  tips: string[]
}

export interface ChatMessage {
  role: 'player' | 'persona'
  content: string
}
