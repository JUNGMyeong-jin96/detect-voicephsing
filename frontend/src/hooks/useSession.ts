import { useCallback, useEffect, useState } from 'react'
import { createSession, getSession } from '../api/client'
import type { SessionInfo } from '../api/types'

const STORAGE_KEY = 'vp-trainer-session-id'

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [initialSession, setInitialSession] = useState<SessionInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startNewSession = useCallback(() => {
    return createSession()
      .then((session) => {
        localStorage.setItem(STORAGE_KEY, session.session_id)
        setInitialSession(session)
        setSessionId(session.session_id)
        setError(null)
      })
      .catch((err) => setError(String(err)))
  }, [])

  useEffect(() => {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) {
      getSession(existing)
        .then((session) => {
          setInitialSession(session)
          setSessionId(existing)
        })
        .catch(() => startNewSession())
      return
    }
    void startNewSession()
  }, [startNewSession])

  const resetSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSessionId(null)
    void startNewSession()
  }, [startNewSession])

  return { sessionId, initialSession, error, resetSession }
}
