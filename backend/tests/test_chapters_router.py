from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app import llm_client
from app.main import app
from app.models import ChapterProgress, ChapterStatus, EvaluationResult, Session
from app.store import store

client = TestClient(app)


def _make_session(chapters=None) -> Session:
    now = datetime.now(timezone.utc)
    return Session(
        session_id="test-session",
        created_at=now,
        expires_at=now + timedelta(hours=1),
        current_chapter_id="ch1",
        chapters=chapters or {},
    )


@pytest.fixture(autouse=True)
def patch_store(monkeypatch):
    state = {"session": _make_session()}

    async def fake_get_session(session_id):
        return state["session"]

    async def fake_set_progress(session, progress):
        session.chapters[progress.chapter_id] = progress

    async def fake_clear_history(session_id, chapter_id):
        return None

    async def fake_append_message(session_id, chapter_id, message):
        return None

    async def fake_get_history(session_id, chapter_id):
        return []

    async def fake_append_evaluation(session_id, chapter_id, result):
        return None

    monkeypatch.setattr(store, "get_session", fake_get_session)
    monkeypatch.setattr(store, "set_progress", fake_set_progress)
    monkeypatch.setattr(store, "clear_history", fake_clear_history)
    monkeypatch.setattr(store, "append_message", fake_append_message)
    monkeypatch.setattr(store, "get_history", fake_get_history)
    monkeypatch.setattr(store, "append_evaluation", fake_append_evaluation)
    return state


def test_start_chapter_locked_when_previous_not_success(patch_store):
    resp = client.post("/api/chapters/ch2/start", json={"session_id": "test-session"})
    assert resp.status_code == 409


def test_start_chapter_allowed_when_previous_success(patch_store):
    patch_store["session"].chapters["ch1"] = ChapterProgress(
        chapter_id="ch1", status=ChapterStatus.SUCCESS, attempts_used=1
    )
    resp = client.post("/api/chapters/ch2/start", json={"session_id": "test-session"})
    assert resp.status_code == 200


def test_choice_success_marks_chapter_success(monkeypatch, patch_store):
    patch_store["session"].chapters["ch1"] = ChapterProgress(
        chapter_id="ch1", status=ChapterStatus.IN_PROGRESS, attempts_used=0
    )

    async def fake_evaluate(chapter_id, history):
        return EvaluationResult(success=True, matched_patterns=[], reason="", feedback_hint="")

    monkeypatch.setattr(llm_client, "evaluate", fake_evaluate)

    resp = client.post(
        "/api/chapters/ch1/choice",
        json={"session_id": "test-session", "node_id": "start", "choice_id": "refuse"},
    )

    assert resp.status_code == 200
    assert resp.json()["chapter_result"]["status"] == "success"


def test_choice_failure_exhausts_attempts_to_failed_final(monkeypatch, patch_store):
    patch_store["session"].chapters["ch1"] = ChapterProgress(
        chapter_id="ch1", status=ChapterStatus.IN_PROGRESS, attempts_used=14
    )

    async def fake_evaluate(chapter_id, history):
        return EvaluationResult(success=False, matched_patterns=[], reason="", feedback_hint="")

    monkeypatch.setattr(llm_client, "evaluate", fake_evaluate)

    resp = client.post(
        "/api/chapters/ch1/choice",
        json={"session_id": "test-session", "node_id": "start", "choice_id": "refuse"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["chapter_result"]["status"] == "failed_final"
    assert body["chapter_result"]["attempts_left"] == 0
