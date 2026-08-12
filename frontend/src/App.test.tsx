import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { ChapterMeta, SessionInfo } from './api/types'

const chapters: ChapterMeta[] = [
  {
    id: 'ch1',
    order: 1,
    title: '챕터1',
    fraud_type: '기관사칭형',
    difficulty: '하',
    persona_name: '정지훈',
    max_attempts: 15,
    mode: 'scripted',
    role: 'victim',
  },
  {
    id: 'ch2',
    order: 2,
    title: '챕터2',
    fraud_type: '투자리딩방',
    difficulty: '중',
    persona_name: '김민수',
    max_attempts: 15,
    mode: 'scripted',
    role: 'victim',
  },
]

const existingSession: SessionInfo = {
  session_id: 'existing-session',
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  current_chapter_id: 'ch1',
  chapters: { ch1: { status: 'success', attempts_used: 1 } },
}

vi.mock('./api/client', () => ({
  listChapters: vi.fn(() => Promise.resolve(chapters)),
  createSession: vi.fn(),
  getSession: vi.fn(() => Promise.resolve(existingSession)),
}))

describe('App - 진행 상태 복원', () => {
  beforeEach(() => {
    localStorage.setItem('vp-trainer-session-id', 'existing-session')
  })

  it('새로고침(재마운트) 후에도 이전에 클리어한 챕터를 기준으로 다음 챕터 잠금이 풀려있다', async () => {
    render(<App />)

    const victimModeButton = await screen.findByText('피해자 모드')
    fireEvent.click(victimModeButton)

    const ch2Button = await screen.findByRole('button', { name: '시작' })
    expect(ch2Button).toBeEnabled()
  })
})
