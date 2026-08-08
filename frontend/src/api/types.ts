export type ChapterStatus = 'locked' | 'in_progress' | 'success' | 'failed_final'
export type ChapterMode = 'freeform' | 'scripted'

export interface ChapterMeta {
  id: string
  order: number
  title: string
  fraud_type: string
  difficulty: string
  persona_name: string
  max_attempts: number
  mode: ChapterMode
}

export interface DialogueChoice {
  id: string
  text: string
}

export interface DialogueNode {
  id: string
  persona_text: string
  persona_expression: string
  choices: DialogueChoice[]
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
  dialogue_node?: DialogueNode
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

export interface ChoiceResponse {
  dialogue_node: DialogueNode | null
  evaluation: EvaluationResult
  chapter_result: ChapterResult
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
