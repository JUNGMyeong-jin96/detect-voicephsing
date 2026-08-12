import json
import re
from collections.abc import AsyncIterator

from anthropic import AsyncAnthropic

from app.chapter_data import (
    CHAPTER_AI_TAGS,
    CHAPTERS,
    EVALUATOR_PROMPT_TEMPLATE,
    EVALUATOR_PROMPT_TEMPLATE_ATTACKER,
    PERSONA_PROMPTS,
    SUCCESS_CRITERIA,
)
from app.config import ANTHROPIC_API_KEY, EVALUATOR_MODEL, PERSONA_MODEL
from app.models import EvaluationResult, Message, MessageRole

_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)


def _to_anthropic_messages(history: list[Message]) -> list[dict]:
    return [
        {"role": "user" if m.role == MessageRole.PLAYER else "assistant", "content": m.content}
        for m in history
    ]


async def stream_persona_response(chapter_id: str, history: list[Message]) -> AsyncIterator[str]:
    system_prompt = PERSONA_PROMPTS[chapter_id]
    async with _client.messages.stream(
        model=PERSONA_MODEL,
        max_tokens=1024,
        system=system_prompt,
        messages=_to_anthropic_messages(history),
    ) as stream:
        async for text in stream.text_stream:
            yield text


def _extract_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def _transcript(history: list[Message]) -> str:
    lines = [
        f"{'플레이어' if m.role == MessageRole.PLAYER else '상대방'}: {m.content}" for m in history
    ]
    return "\n".join(lines)


async def evaluate(chapter_id: str, history: list[Message]) -> EvaluationResult:
    role = next(c.role for c in CHAPTERS if c.id == chapter_id)
    template = EVALUATOR_PROMPT_TEMPLATE_ATTACKER if role == "attacker" else EVALUATOR_PROMPT_TEMPLATE
    prompt = template.format(
        criteria=SUCCESS_CRITERIA[chapter_id],
        ai_tags=" / ".join(CHAPTER_AI_TAGS[chapter_id]),
        transcript=_transcript(history),
    )
    response = await _client.messages.create(
        model=EVALUATOR_MODEL,
        max_tokens=500,
        thinking={"type": "disabled"},
        messages=[{"role": "user", "content": prompt}],
    )
    raw_text = next(block.text for block in response.content if block.type == "text")
    data = _extract_json(raw_text)
    return EvaluationResult(**data)
