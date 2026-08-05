from fastapi import APIRouter, HTTPException

from app.store import store

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", status_code=201)
def create_session():
    session = store.create_session()
    return {
        "session_id": session.session_id,
        "expires_at": session.expires_at,
        "current_chapter_id": session.current_chapter_id,
    }


@router.get("/{session_id}")
def get_session(session_id: str):
    session = store.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found or expired")
    return {
        "session_id": session.session_id,
        "expires_at": session.expires_at,
        "current_chapter_id": session.current_chapter_id,
    }


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: str):
    store.delete_session(session_id)
    return None
