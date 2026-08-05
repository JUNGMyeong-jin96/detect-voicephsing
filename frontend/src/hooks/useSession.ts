import { useCallback, useEffect, useState } from 'react'
import { createSession, getSession } from '../api/client'

const STORAGE_KEY = 'vp-trainer-session-id'

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startNewSession = useCallback(() => {
    return createSession()
      .then((session) => {
        localStorage.setItem(STORAGE_KEY, session.session_id)
        setSessionId(session.session_id)
        setError(null)
      })
      .catch((err) => setError(String(err)))
  }, [])

  useEffect(() => {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) {
      getSession(existing)
        .then(() => setSessionId(existing))
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

  return { sessionId, error, resetSession }
}
