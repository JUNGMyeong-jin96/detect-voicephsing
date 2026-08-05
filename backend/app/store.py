import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from app.config import SESSION_TTL_HOURS
from app.models import ChapterProgress, ChapterStatus, EvaluationResult, Message, Session


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._history: dict[tuple[str, str], list[Message]] = {}
        self._evaluations: dict[tuple[str, str], list[EvaluationResult]] = {}

    def create_session(self) -> Session:
        now = datetime.now(timezone.utc)
        session = Session(
            session_id=str(uuid.uuid4()),
            created_at=now,
            expires_at=now + timedelta(hours=SESSION_TTL_HOURS),
            current_chapter_id="ch1",
        )
        self._sessions[session.session_id] = session
        return session

    def get_session(self, session_id: str) -> Session | None:
        session = self._sessions.get(session_id)
        if session is None:
            return None
        if session.expires_at < datetime.now(timezone.utc):
            self.delete_session(session_id)
            return None
        return session

    def delete_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        for key in [k for k in self._history if k[0] == session_id]:
            self._history.pop(key, None)
        for key in [k for k in self._evaluations if k[0] == session_id]:
            self._evaluations.pop(key, None)

    def get_progress(self, session: Session, chapter_id: str) -> ChapterProgress:
        return session.chapters.get(
            chapter_id,
            ChapterProgress(chapter_id=chapter_id, status=ChapterStatus.LOCKED),
        )

    def set_progress(self, session: Session, progress: ChapterProgress) -> None:
        session.chapters[progress.chapter_id] = progress

    def get_history(self, session_id: str, chapter_id: str) -> list[Message]:
        return self._history.setdefault((session_id, chapter_id), [])

    def clear_history(self, session_id: str, chapter_id: str) -> None:
        self._history[(session_id, chapter_id)] = []

    def append_evaluation(self, session_id: str, chapter_id: str, result: EvaluationResult) -> None:
        self._evaluations.setdefault((session_id, chapter_id), []).append(result)

    def get_evaluations(self, session_id: str, chapter_id: str) -> list[EvaluationResult]:
        return self._evaluations.get((session_id, chapter_id), [])

    async def cleanup_loop(self, interval_seconds: int = 300) -> None:
        while True:
            await asyncio.sleep(interval_seconds)
            now = datetime.now(timezone.utc)
            expired = [sid for sid, s in self._sessions.items() if s.expires_at < now]
            for sid in expired:
                self.delete_session(sid)


store = SessionStore()
