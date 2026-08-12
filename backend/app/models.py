from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class ChapterStatus(str, Enum):
    LOCKED = "locked"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED_FINAL = "failed_final"


class MessageRole(str, Enum):
    PLAYER = "player"
    PERSONA = "persona"


class ChapterMeta(BaseModel):
    id: str
    order: int
    title: str
    fraud_type: str
    difficulty: str
    persona_name: str
    max_attempts: int
    mode: Literal["freeform", "scripted"] = "freeform"
    role: Literal["victim", "attacker"]


class DialogueChoice(BaseModel):
    id: str
    text: str
    next_node_id: str | None = None


class DialogueNode(BaseModel):
    id: str
    persona_text: str
    persona_expression: str
    choices: list[DialogueChoice]


class ChapterProgress(BaseModel):
    chapter_id: str
    status: ChapterStatus
    attempts_used: int = 0
    trust_penalty: bool = False


class Session(BaseModel):
    session_id: str
    created_at: datetime
    expires_at: datetime
    current_chapter_id: str
    chapters: dict[str, ChapterProgress] = Field(default_factory=dict)


class Message(BaseModel):
    role: MessageRole
    content: str
    timestamp: datetime


class EvaluationResult(BaseModel):
    success: bool
    matched_patterns: list[str] = Field(default_factory=list)
    reason: str = ""
    feedback_hint: str = ""


class ChapterReport(BaseModel):
    chapter_id: str
    outcome: ChapterStatus
    matched_patterns_summary: list[str]
    tips: list[str]
