import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChapterSelect } from './ChapterSelect'
import type { ChapterMeta } from '../api/types'

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

const noop = vi.fn()

describe('ChapterSelect', () => {
  it('이전 챕터를 클리어하지 못했으면 다음 챕터는 잠김 상태다', () => {
    render(
      <ChapterSelect
        chapters={chapters}
        progress={{}}
        sessionId="s1"
        onBack={noop}
        onEnterChapter={noop}
        onSessionExpired={noop}
      />,
    )

    const buttons = screen.getAllByRole('button', { name: /잠김|시작/ })
    expect(buttons[0]).toHaveTextContent('시작')
    expect(buttons[1]).toHaveTextContent('잠김')
    expect(buttons[1]).toBeDisabled()
  })

  it('이전 챕터가 success면 다음 챕터가 잠금 해제된다', () => {
    render(
      <ChapterSelect
        chapters={chapters}
        progress={{ ch1: { status: 'success', attemptsLeft: 0 } }}
        sessionId="s1"
        onBack={noop}
        onEnterChapter={noop}
        onSessionExpired={noop}
      />,
    )

    const buttons = screen.getAllByRole('button', { name: /잠김|시작/ })
    expect(buttons[1]).toHaveTextContent('시작')
    expect(buttons[1]).toBeEnabled()
  })
})
