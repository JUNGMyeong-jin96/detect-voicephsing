import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app import llm_client
from app.chapter_data import CHAPTER_ORDER_BY_ROLE, CHAPTERS, DIALOGUE_TREES, OPENING_LINES, TIPS_MAP
from app.models import ChapterMeta, ChapterProgress, ChapterStatus, DialogueNode, Message, MessageRole
from app.rate_limiter import check_message_rate_limit
from app.store import store

MAX_MESSAGE_LENGTH = 350  # frontend/src/components/ChatScreen.tsx의 MAX_MESSAGE_LENGTH와 동기화

router = APIRouter(prefix="/api/chapters", tags=["chapters"])


class SessionRef(BaseModel):
    session_id: str


class MessageIn(BaseModel):
    session_id: str
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class ChoiceIn(BaseModel):
    session_id: str
    node_id: str
    choice_id: str


async def _get_session(session_id: str):
    session = await store.get_session(session_id)
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


def _dialogue_node_payload(node: DialogueNode) -> dict:
    return {
        "id": node.id,
        "persona_text": node.persona_text,
        "persona_expression": node.persona_expression,
        "choices": [{"id": c.id, "text": c.text} for c in node.choices],
    }


@router.get("")
def list_chapters():
    return CHAPTERS


@router.post("/{chapter_id}/start")
async def start_chapter(chapter_id: str, body: SessionRef):
    session = await _get_session(body.session_id)
    meta = _chapter_meta(chapter_id)

    order = CHAPTER_ORDER_BY_ROLE[meta.role]
    idx = order.index(chapter_id)
    if idx > 0:
        prev_progress = store.get_progress(session, order[idx - 1])
        if prev_progress.status != ChapterStatus.SUCCESS:
            raise HTTPException(status_code=409, detail="previous chapter not completed")

    await store.clear_history(session.session_id, chapter_id)
    await store.set_progress(
        session,
        ChapterProgress(chapter_id=chapter_id, status=ChapterStatus.IN_PROGRESS, attempts_used=0),
    )
    session.current_chapter_id = chapter_id

    response = {
        "chapter_id": chapter_id,
        "attempts_left": meta.max_attempts,
        "opening_line": OPENING_LINES[chapter_id],
    }
    if meta.mode == "scripted":
        response["dialogue_node"] = _dialogue_node_payload(DIALOGUE_TREES[chapter_id]["start"])
    return response


@router.post("/{chapter_id}/retry")
async def retry_chapter(chapter_id: str, body: SessionRef):
    session = await _get_session(body.session_id)
    meta = _chapter_meta(chapter_id)
    progress = store.get_progress(session, chapter_id)

    if progress.status == ChapterStatus.FAILED_FINAL:
        raise HTTPException(status_code=409, detail="no attempts left")

    await store.clear_history(session.session_id, chapter_id)

    response = {
        "chapter_id": chapter_id,
        "attempts_left": meta.max_attempts - progress.attempts_used,
        "opening_line": OPENING_LINES[chapter_id],
    }
    if meta.mode == "scripted":
        response["dialogue_node"] = _dialogue_node_payload(DIALOGUE_TREES[chapter_id]["start"])
    return response


@router.post("/{chapter_id}/message", dependencies=[Depends(check_message_rate_limit)])
async def send_message(chapter_id: str, body: MessageIn):
    session = await _get_session(body.session_id)
    meta = _chapter_meta(chapter_id)
    progress = store.get_progress(session, chapter_id)

    if progress.status != ChapterStatus.IN_PROGRESS:
        raise HTTPException(status_code=409, detail="chapter not in progress")

    history = await store.get_history(session.session_id, chapter_id)
    player_message = Message(
        role=MessageRole.PLAYER, content=body.message, timestamp=datetime.now(timezone.utc)
    )
    history.append(player_message)
    await store.append_message(session.session_id, chapter_id, player_message)

    async def event_stream():
        full_text = ""
        try:
            async for chunk in llm_client.stream_persona_response(chapter_id, history):
                full_text += chunk
                yield _sse("token", {"chunk": chunk})
        except Exception as exc:
            yield _sse("error", {"code": "persona_llm_error", "message": str(exc)})
            return

        persona_message = Message(
            role=MessageRole.PERSONA, content=full_text, timestamp=datetime.now(timezone.utc)
        )
        history.append(persona_message)
        await store.append_message(session.session_id, chapter_id, persona_message)
        yield _sse("persona_done", {"content": full_text})

        try:
            result = await llm_client.evaluate(chapter_id, history)
        except Exception as exc:
            yield _sse("error", {"code": "evaluator_llm_error", "message": str(exc)})
            return

        await store.append_evaluation(session.session_id, chapter_id, result)
        yield _sse("evaluation", result.model_dump())

        if result.success:
            progress.status = ChapterStatus.SUCCESS
        else:
            progress.attempts_used += 1
            if progress.attempts_used >= meta.max_attempts:
                progress.status = ChapterStatus.FAILED_FINAL
                progress.trust_penalty = True
        await store.set_progress(session, progress)

        attempts_left = max(meta.max_attempts - progress.attempts_used, 0)
        yield _sse("chapter_result", {"status": progress.status.value, "attempts_left": attempts_left})
        yield _sse("done", {})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/{chapter_id}/choice", dependencies=[Depends(check_message_rate_limit)])
async def send_choice(chapter_id: str, body: ChoiceIn):
    session = await _get_session(body.session_id)
    meta = _chapter_meta(chapter_id)
    progress = store.get_progress(session, chapter_id)

    if progress.status != ChapterStatus.IN_PROGRESS:
        raise HTTPException(status_code=409, detail="chapter not in progress")

    tree = DIALOGUE_TREES.get(chapter_id)
    if tree is None:
        raise HTTPException(status_code=409, detail="chapter has no dialogue tree")

    node = tree.get(body.node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="unknown dialogue node")

    choice = next((c for c in node.choices if c.id == body.choice_id), None)
    if choice is None:
        raise HTTPException(status_code=404, detail="unknown choice")

    history = await store.get_history(session.session_id, chapter_id)
    player_message = Message(
        role=MessageRole.PLAYER, content=choice.text, timestamp=datetime.now(timezone.utc)
    )
    history.append(player_message)
    await store.append_message(session.session_id, chapter_id, player_message)

    next_node = tree[choice.next_node_id] if choice.next_node_id else None
    if next_node is not None:
        persona_message = Message(
            role=MessageRole.PERSONA, content=next_node.persona_text, timestamp=datetime.now(timezone.utc)
        )
        history.append(persona_message)
        await store.append_message(session.session_id, chapter_id, persona_message)

    try:
        result = await llm_client.evaluate(chapter_id, history)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"evaluator_llm_error: {exc}")

    await store.append_evaluation(session.session_id, chapter_id, result)

    if result.success:
        progress.status = ChapterStatus.SUCCESS
    else:
        progress.attempts_used += 1
        if progress.attempts_used >= meta.max_attempts:
            progress.status = ChapterStatus.FAILED_FINAL
            progress.trust_penalty = True
    await store.set_progress(session, progress)

    attempts_left = max(meta.max_attempts - progress.attempts_used, 0)

    return {
        "dialogue_node": _dialogue_node_payload(next_node) if next_node else None,
        "evaluation": result.model_dump(),
        "chapter_result": {"status": progress.status.value, "attempts_left": attempts_left},
    }


@router.get("/{chapter_id}/report")
async def get_report(chapter_id: str, session_id: str = Query(...)):
    session = await _get_session(session_id)
    _chapter_meta(chapter_id)
    progress = store.get_progress(session, chapter_id)

    if progress.status not in (ChapterStatus.SUCCESS, ChapterStatus.FAILED_FINAL):
        raise HTTPException(status_code=409, detail="chapter not finished yet")

    patterns: list[str] = []
    for ev in await store.get_evaluations(session.session_id, chapter_id):
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
