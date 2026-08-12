# 백엔드 API 스펙 (FastAPI)

design-spec.md / scenarios.md 기반. Python 3.11+, FastAPI, Uvicorn, Pydantic.

## 0. 설계 원칙

- **인증 없음** — 게스트 세션(session_id, UUID)만으로 식별
- **상태 저장소** — Postgres(Supabase) + TTL(24h) 백그라운드 정리 태스크
- **LLM 호출 2종** — Persona(경량 모델, 스트리밍) / Evaluator(상위 모델, 비스트리밍 JSON)
- **모든 응답은 하나의 세션(session_id) 컨텍스트 안에서 동작**

---

## 1. 데이터 모델 (Pydantic)

```python
# models.py
from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from typing import Literal

class ChapterStatus(str, Enum):
    LOCKED = "locked"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED_FINAL = "failed_final"   # 재시도 소진, 페널티 부여 (다음 챕터 잠금은 유지됨 — §4 참고)

class MessageRole(str, Enum):
    PLAYER = "player"
    PERSONA = "persona"

class ChapterMeta(BaseModel):
    id: str                 # "ch1" ~ "ch5" (피해자) / "atk_intro", "atk1" ~ "atk5" (가해자)
    order: int
    title: str
    fraud_type: str         # "기관사칭형" 등
    difficulty: str          # "하" | "중" | "중상" | "상" | "최상"
    persona_name: str
    max_attempts: int
    mode: Literal["freeform", "scripted"]   # 현재 전 챕터 "scripted"
    role: Literal["victim", "attacker"]     # 피해자 모드 / 가해자 모드(외전)

class ChapterProgress(BaseModel):
    chapter_id: str
    status: ChapterStatus
    attempts_used: int
    trust_penalty: bool = False   # 재시도 소진 시 서사적 페널티 플래그

class Session(BaseModel):
    session_id: str
    created_at: datetime
    expires_at: datetime          # created_at + 24h
    current_chapter_id: str
    chapters: dict[str, ChapterProgress]

class Message(BaseModel):
    role: MessageRole
    content: str
    timestamp: datetime

class EvaluationResult(BaseModel):
    success: bool
    matched_patterns: list[str]
    reason: str
    feedback_hint: str

class ChapterReport(BaseModel):
    chapter_id: str
    outcome: ChapterStatus
    matched_patterns_summary: list[str]   # 전체 시도에서 누적된 패턴
    tips: list[str]                       # 실제 예방 수칙 매핑
```

---

## 2. 엔드포인트 목록

### 2-1. `POST /api/sessions`
게스트 세션 생성.

**Request:** 없음 (body 불필요)

**Response 201:**
```json
{
  "session_id": "b1f0...",
  "expires_at": "2026-07-31T12:00:00Z",
  "current_chapter_id": "ch1",
  "chapters": {}
}
```

---

### 2-1b. `GET /api/sessions/{session_id}`
세션 조회. 프론트엔드가 새로고침 시 챕터별 진행 상태(`chapters`)를 복원하는 데 사용.

**Response 200:**
```json
{
  "session_id": "b1f0...",
  "expires_at": "2026-07-31T12:00:00Z",
  "current_chapter_id": "ch2",
  "chapters": {
    "ch1": { "status": "success", "attempts_used": 2 }
  }
}
```

**에러:** `404` — 세션 없음/만료

---

### 2-2. `GET /api/chapters`
전체 챕터 메타데이터 (정적 콘텐츠, 로그인/세션 불필요).

**Response 200:** `ChapterMeta[]`

---

### 2-3. `POST /api/chapters/{chapter_id}/start`
챕터 시작. 대화 컨텍스트를 초기화. `mode="scripted"` 챕터(현재 전 챕터)는 응답에 첫 대화 노드(`dialogue_node`)를 함께 반환.

**Request:**
```json
{ "session_id": "b1f0..." }
```

**Response 200:**
```json
{
  "chapter_id": "ch1",
  "attempts_left": 15,
  "opening_line": "여보세요? 아, 예, 무슨 일이시죠?",
  "dialogue_node": {
    "id": "start",
    "persona_text": "...",
    "persona_expression": "neutral_official",
    "choices": [{ "id": "comply", "text": "..." }, { "id": "hesitate", "text": "..." }, { "id": "refuse", "text": "..." }]
  }
}
```

**에러:**
- `404` — 세션 없음/만료
- `409` — 이전 챕터가 `success` 상태가 아니어서 잠김(LOCKED)

---

### 2-3b. `POST /api/chapters/{chapter_id}/choice`
`mode="scripted"` 챕터에서 플레이어가 선택지를 고를 때 호출. 다음 대화 노드 + 매 선택마다의 Evaluator 판정을 함께 반환.

**Request:**
```json
{ "session_id": "b1f0...", "node_id": "start", "choice_id": "refuse" }
```

**Response 200:**
```json
{
  "dialogue_node": { "id": "...", "persona_text": "...", "persona_expression": "...", "choices": [] },
  "evaluation": { "success": true, "matched_patterns": ["..."], "reason": "...", "feedback_hint": "..." },
  "chapter_result": { "status": "success", "attempts_left": 14 }
}
```
- 대화가 종료되는 선택지(`next_node_id`가 없음)면 `dialogue_node`는 `null`
- `chapter_result.status`가 `success` 또는 `failed_final`이면 클라이언트는 `/report` 호출

**에러:**
- `404` — 세션/챕터/노드/선택지 없음
- `409` — 챕터가 `in_progress` 상태가 아님
- `502` — Evaluator LLM 호출 실패

---

### 2-4. `POST /api/chapters/{chapter_id}/message` (SSE)
플레이어 대사 입력 → Persona 응답 스트리밍 → 턴 종료 시 Evaluator 판정까지 한 번에 처리.

> **현재 상태:** 전 챕터가 `mode="scripted"`로 전환되어 있어(2-3b `/choice` 사용), 이 엔드포인트는 현재 콘텐츠 데이터로는 호출되지 않는다. 자유입력(freeform) 챕터를 다시 활성화할 경우를 위해 코드는 유지.

**Request:**
```json
{ "session_id": "b1f0...", "message": "그런 전화는 처음 듣는데요, 확인 차 대표번호로 제가 다시 걸어볼게요." }
```

**Response:** `Content-Type: text/event-stream`

SSE 이벤트 시퀀스:
```
event: token
data: {"chunk": "아, "}

event: token
data: {"chunk": "네, 무슨 일이시죠?"}

event: persona_done
data: {"content": "아, 네, 무슨 일이시죠?"}

event: evaluation
data: {"success": false, "matched_patterns": ["기관_사칭"], "reason": "...", "feedback_hint": "..."}

event: chapter_result
data: {"status": "in_progress", "attempts_left": 3}

event: done
data: {}
```

- `evaluation`은 **매 턴마다** 호출 (성공 여부를 놓치지 않기 위함)
- `chapter_result.status`가 `success` 또는 `failed_final`이면 클라이언트는 스트림 종료 후 `/report` 호출
- `failed_final`은 `attempts_left`가 0이 되는 시점에만 발생 (그 전까지는 계속 `in_progress`로 대화 지속)

**에러 이벤트:**
```
event: error
data: {"code": "persona_llm_error", "message": "..."}
```
```
event: error
data: {"code": "evaluator_llm_error", "message": "..."}
```

---

### 2-5. `POST /api/chapters/{chapter_id}/retry`
현재 시도가 실패로 판정되었고 재시도 여지가 남았을 때, 대화 컨텍스트만 초기화(시도 횟수는 유지된 상태로 차감 반영됨 — `/message`의 evaluation 실패 시 서버가 내부적으로 attempts_used를 증가시키므로, 이 엔드포인트는 단순히 대화창 리셋 용도).

**Request:**
```json
{ "session_id": "b1f0..." }
```

**Response 200:**
```json
{ "chapter_id": "ch1", "attempts_left": 2, "opening_line": "...", "dialogue_node": { "...": "..." } }
```
`dialogue_node`는 `mode="scripted"` 챕터에서만 포함됨(2-3과 동일).

**에러:** `409` — attempts_left가 0이면 재시도 불가 (이미 failed_final 처리됨)

---

### 2-6. `GET /api/chapters/{chapter_id}/report?session_id=...`
챕터 종료(성공/최종실패 무관) 후 개인 맞춤 피드백 리포트 생성. 새로운 LLM 호출 없이, 해당 챕터에서 매 턴 저장된 `matched_patterns`를 취합해 중복 제거 후 `TIPS_MAP`으로 예방 수칙에 매핑.

**Response 200:** `ChapterReport`
```json
{
  "chapter_id": "ch1",
  "outcome": "success",
  "matched_patterns_summary": ["기관_사칭", "긴급성_조성", "공포_유발"],
  "tips": [
    "실제 금감원/검찰은 전화로 계좌 이체를 요구하지 않습니다.",
    "공공기관을 사칭한 전화는 반드시 대표번호로 직접 확인하세요."
  ]
}
```

---

### 2-7. `DELETE /api/sessions/{session_id}`
플레이어가 명시적으로 종료(또는 이탈) 시 즉시 데이터 삭제. TTL 자동삭제와 별개의 수동 삭제 경로.

**Response:** `204`

---

## 3. 세션/상태 관리

- Postgres(Supabase) 저장소(`asyncpg`, `app/store.py`): `sessions`(세션 + 챕터별 진행 상태 JSON), `history`(대화 이력), `evaluations`(턴별 판정 결과) 3개 테이블
- 백그라운드 태스크(`asyncio` 주기 작업, 5분 간격)로 `expires_at` 초과 세션을 삭제
- 세션에 연결된 모든 데이터는 `session_id`가 유일한 키 — 개인 식별 정보 없음

---

## 4. 챕터 진행 규칙 (서버 로직 요약)

1. `ch{N}`(또는 `atk{N}`)은 이전 챕터의 상태가 정확히 `success`일 때만 `start` 가능 — `failed_final`이어도 잠김 유지 (실제 코드 기준. design-spec 초기 구상은 `failed_final`도 진행 허용이었으나 구현 시 `success`만 허용으로 확정됨)
2. 매 `/message`(freeform) 또는 `/choice`(scripted) 호출 시 Evaluator 실행 → `success=false`면 `attempts_used += 1`
3. `attempts_used >= max_attempts`면 `status = failed_final`, `trust_penalty = true` 로 전환하고 `chapter_result`(SSE 이벤트 또는 `/choice` 응답 필드)에 반영
4. `success=true`면 `status = success`로 전환, 즉시 챕터 종료

---

## 5. Ch5(엔딩) 차이점

- 엔드포인트 구조는 동일 (`/message`, `/retry`, `/report` 재사용)
- `EvaluationResult.matched_patterns`는 Ch5 한정으로 전용 태그 사용 (긍정: `침착한_안심유도`, `공식채널_확인_제안`, `구체적_경고신호_설명` / 위험: `일방적_다그침`)
- 성공 조건: 어머니 페르소나가 송금을 중단하고 공식 채널로 확인하겠다고 동의

---

## 6. 가해자 모드(외전) 차이점

- `ChapterMeta.role = "attacker"`인 챕터(`atk_intro`, `atk1`~`atk5`) 그룹. 엔드포인트/데이터 구조는 피해자 모드와 동일하게 재사용하되, 플레이어와 페르소나의 입장이 반전됨(플레이어가 가해자 대사를 고르고, 스크립트화된 피해자 페르소나가 반응).
- Evaluator 판정 시 `role`에 따라 `EVALUATOR_PROMPT_TEMPLATE_ATTACKER`(공격자용 성공 기준)를 사용, 태그 세트도 챕터별로 별도(`CHAPTER_AI_TAGS`).
- `atk_intro`는 선형 스토리로, 선택지 내용이 판정 결과에 영향을 주지 않음.
