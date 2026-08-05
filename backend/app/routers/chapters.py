import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app import llm_client
from app.chapter_data import CHAPTER_ORDER, CHAPTERS, OPENING_LINES, TIPS_MAP
from app.models import ChapterMeta, ChapterProgress, ChapterStatus, Message, MessageRole
from app.store import store

router = APIRouter(prefix="/api/chapters", tags=["chapters"])


class SessionRef(BaseModel):
    session_id: str


class MessageIn(BaseModel):
    session_id: str
    message: str


def _get_session(session_id: str):
    session = store.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found or expired")
    return session


def _chapter_meta(chapter_id: str) -> ChapterMeta:
    meta = next((c for c in CHAPTERS if c.id == chapter_id), None)
    if meta is None:
        raise HTTPException(status_code=404, detail="unknown chapter")
    return meta


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.get("")
def list_chapters():
    return CHAPTERS


@router.post("/{chapter_id}/start")
def start_chapter(chapter_id: str, body: SessionRef):
    session = _get_session(body.session_id)
    meta = _chapter_meta(chapter_id)

    idx = CHAPTER_ORDER.index(chapter_id)
    if idx > 0:
        prev_progress = store.get_progress(session, CHAPTER_ORDER[idx - 1])
        if prev_progress.status != ChapterStatus.SUCCESS:
            raise HTTPException(status_code=409, detail="previous chapter not completed")

    store.clear_history(session.session_id, chapter_id)
    store.set_progress(
        session,
        ChapterProgress(chapter_id=chapter_id, status=ChapterStatus.IN_PROGRESS, attempts_used=0),
    )
    session.current_chapter_id = chapter_id

    return {
        "chapter_id": chapter_id,
        "attempts_left": meta.max_attempts,
        "opening_line": OPENING_LINES[chapter_id],
    }


@router.post("/{chapter_id}/retry")
def retry_chapter(chapter_id: str, body: SessionRef):
    session = _get_session(body.session_id)
    meta = _chapter_meta(chapter_id)
    progress = store.get_progress(session, chapter_id)

    if progress.status == ChapterStatus.FAILED_FINAL:
        raise HTTPException(status_code=409, detail="no attempts left")

    store.clear_history(session.session_id, chapter_id)

    return {
        "chapter_id": chapter_id,
        "attempts_left": meta.max_attempts - progress.attempts_used,
        "opening_line": OPENING_LINES[chapter_id],
    }


@router.post("/{chapter_id}/message")
async def send_message(chapter_id: str, body: MessageIn):
    session = _get_session(body.session_id)
    meta = _chapter_meta(chapter_id)
    progress = store.get_progress(session, chapter_id)

    if progress.status != ChapterStatus.IN_PROGRESS:
        raise HTTPException(status_code=409, detail="chapter not in progress")

    history = store.get_history(session.session_id, chapter_id)
    history.append(
        Message(role=MessageRole.PLAYER, content=body.message, timestamp=datetime.now(timezone.utc))
    )

    async def event_stream():
        full_text = ""
        try:
            async for chunk in llm_client.stream_persona_response(chapter_id, history):
                full_text += chunk
                yield _sse("token", {"chunk": chunk})
        except Exception as exc:
            yield _sse("error", {"code": "persona_llm_error", "message": str(exc)})
            return

        history.append(
            Message(role=MessageRole.PERSONA, content=full_text, timestamp=datetime.now(timezone.utc))
        )
        yield _sse("persona_done", {"content": full_text})

        try:
            result = await llm_client.evaluate(chapter_id, history)
        except Exception as exc:
            yield _sse("error", {"code": "evaluator_llm_error", "message": str(exc)})
            return

        store.append_evaluation(session.session_id, chapter_id, result)
        yield _sse("evaluation", result.model_dump())

        if result.success:
            progress.status = ChapterStatus.SUCCESS
        else:
            progress.attempts_used += 1
            if progress.attempts_used >= meta.max_attempts:
                progress.status = ChapterStatus.FAILED_FINAL
                progress.trust_penalty = True
        store.set_progress(session, progress)

        attempts_left = max(meta.max_attempts - progress.attempts_used, 0)
        yield _sse("chapter_result", {"status": progress.status.value, "attempts_left": attempts_left})
        yield _sse("done", {})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{chapter_id}/report")
def get_report(chapter_id: str, session_id: str = Query(...)):
    session = _get_session(session_id)
    _chapter_meta(chapter_id)
    progress = store.get_progress(session, chapter_id)

    if progress.status not in (ChapterStatus.SUCCESS, ChapterStatus.FAILED_FINAL):
        raise HTTPException(status_code=409, detail="chapter not finished yet")

    patterns: list[str] = []
    for ev in store.get_evaluations(session.session_id, chapter_id):
        for pattern in ev.matched_patterns:
            if pattern not in patterns:
                patterns.append(pattern)

    tips = [TIPS_MAP[p] for p in patterns if p in TIPS_MAP]

    return {
        "chapter_id": chapter_id,
        "outcome": progress.status.value,
        "matched_patterns_summary": patterns,
        "tips": tips,
    }
