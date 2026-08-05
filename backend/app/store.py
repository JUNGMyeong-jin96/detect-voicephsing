import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg

from app.config import SESSION_TTL_HOURS
from app.models import ChapterProgress, ChapterStatus, EvaluationResult, Message, Session


class SessionStore:
    def __init__(self) -> None:
        self.pool: asyncpg.Pool | None = None

    async def init_pool(self, dsn: str) -> None:
        self.pool = await asyncpg.create_pool(
            dsn=dsn, min_size=1, max_size=10, statement_cache_size=0
        )

    async def close_pool(self) -> None:
        if self.pool:
            await self.pool.close()

    async def create_session(self) -> Session:
        now = datetime.now(timezone.utc)
        session = Session(
            session_id=str(uuid.uuid4()),
            created_at=now,
            expires_at=now + timedelta(hours=SESSION_TTL_HOURS),
            current_chapter_id="ch1",
        )
        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO sessions (session_id, created_at, expires_at, current_chapter_id, chapters) "
                "VALUES ($1, $2, $3, $4, $5)",
                session.session_id,
                session.created_at,
                session.expires_at,
                session.current_chapter_id,
                "{}",
            )
        return session

    async def get_session(self, session_id: str) -> Session | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM sessions WHERE session_id = $1", session_id)
        if row is None:
            return None
        if row["expires_at"] < datetime.now(timezone.utc):
            await self.delete_session(session_id)
            return None
        chapters_raw = json.loads(row["chapters"])
        chapters = {k: ChapterProgress(**v) for k, v in chapters_raw.items()}
        return Session(
            session_id=row["session_id"],
            created_at=row["created_at"],
            expires_at=row["expires_at"],
            current_chapter_id=row["current_chapter_id"],
            chapters=chapters,
        )

    async def delete_session(self, session_id: str) -> None:
        async with self.pool.acquire() as conn:
            await conn.execute("DELETE FROM sessions WHERE session_id = $1", session_id)

    def get_progress(self, session: Session, chapter_id: str) -> ChapterProgress:
        return session.chapters.get(
            chapter_id,
            ChapterProgress(chapter_id=chapter_id, status=ChapterStatus.LOCKED),
        )

    async def set_progress(self, session: Session, progress: ChapterProgress) -> None:
        session.chapters[progress.chapter_id] = progress
        payload = json.dumps({k: v.model_dump(mode="json") for k, v in session.chapters.items()})
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE sessions SET chapters = $1 WHERE session_id = $2",
                payload,
                session.session_id,
            )

    async def append_message(self, session_id: str, chapter_id: str, message: Message) -> None:
        async with self.pool.acquire() as conn:
            await conn.execute(
                'INSERT INTO history (session_id, chapter_id, role, content, "timestamp") '
                "VALUES ($1, $2, $3, $4, $5)",
                session_id,
                chapter_id,
                message.role.value,
                message.content,
                message.timestamp,
            )

    async def get_history(self, session_id: str, chapter_id: str) -> list[Message]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                'SELECT role, content, "timestamp" FROM history '
                "WHERE session_id = $1 AND chapter_id = $2 ORDER BY id",
                session_id,
                chapter_id,
            )
        return [
            Message(role=r["role"], content=r["content"], timestamp=r["timestamp"]) for r in rows
        ]

    async def clear_history(self, session_id: str, chapter_id: str) -> None:
        async with self.pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM history WHERE session_id = $1 AND chapter_id = $2",
                session_id,
                chapter_id,
            )

    async def append_evaluation(self, session_id: str, chapter_id: str, result: EvaluationResult) -> None:
        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO evaluations (session_id, chapter_id, success, matched_patterns, reason, feedback_hint) "
                "VALUES ($1, $2, $3, $4, $5, $6)",
                session_id,
                chapter_id,
                result.success,
                json.dumps(result.matched_patterns),
                result.reason,
                result.feedback_hint,
            )

    async def get_evaluations(self, session_id: str, chapter_id: str) -> list[EvaluationResult]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT success, matched_patterns, reason, feedback_hint FROM evaluations "
                "WHERE session_id = $1 AND chapter_id = $2 ORDER BY id",
                session_id,
                chapter_id,
            )
        return [
            EvaluationResult(
                success=r["success"],
                matched_patterns=json.loads(r["matched_patterns"]),
                reason=r["reason"],
                feedback_hint=r["feedback_hint"],
            )
            for r in rows
        ]

    async def cleanup_loop(self, interval_seconds: int = 300) -> None:
        while True:
            await asyncio.sleep(interval_seconds)
            async with self.pool.acquire() as conn:
                await conn.execute("DELETE FROM sessions WHERE expires_at < now()")


store = SessionStore()
