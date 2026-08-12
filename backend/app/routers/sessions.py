from fastapi import APIRouter, HTTPException

from app.store import store

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", status_code=201)
async def create_session():
    session = await store.create_session()
    return {
        "session_id": session.session_id,
        "expires_at": session.expires_at,
        "current_chapter_id": session.current_chapter_id,
        "chapters": {},
    }


@router.get("/{session_id}")
async def get_session(session_id: str):
    session = await store.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found or expired")
    return {
        "session_id": session.session_id,
        "expires_at": session.expires_at,
        "current_chapter_id": session.current_chapter_id,
        "chapters": {
            cid: {"status": p.status.value, "attempts_used": p.attempts_used}
            for cid, p in session.chapters.items()
        },
    }


@router.delete("/{session_id}", status_code=204)
async def delete_session(session_id: str):
    await store.delete_session(session_id)
    return None
