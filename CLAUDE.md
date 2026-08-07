# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

# Project Tech Stack (MVP)
- Backend: Python 3.11+, FastAPI, Uvicorn, Pydantic
- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- API Communication: RESTful API (JSON)

# Backend Architecture Rules (KISS Principle)
1. 복잡한 계층 구조(Layered Architecture)나 불필요한 추상화를 엄격히 배제합니다.
2. 디렉토리 구조는 최대한 단순하게 유지합니다. (예: `main.py`, `routers/`, `services/`, `models/`)
3. 모든 엔드포인트는 비동기(`async def`)로 작성하며, 데이터 검증은 Pydantic을 활용합니다.
4. AI/LLM 에이전트 호출 로직은 라우터(Controller)가 아닌 `services/` 폴더 내에 단일 책임으로 격리합니다.

# 🎨 UI/UX 디자인 작업 규칙

디자인, 프론트엔드 컴포넌트 개발, UI 개선 및 레이아웃 관련 작업을 진행할 때는 **반드시** [`ui-ux.md`](./ui-ux.md) 문서에 정의된 UI/UX 디자인 원칙을 참조하고 준수해야 합니다.

## 체크리스트:
1. **단순성 & 간결성**: 불필요한 장식이나 요소를 추가하지 않았는가?
2. **일관성**: 기존 디자인 시스템, 버튼/폰트/컬러 규격을 준수하고 있는가?
3. **시각적 계층 구조**: 중요도에 따른 크기, 대비, 여백이 명확한가?
4. **피드백 & 상태 전달**: 호버, 클릭, 로딩, 에러 등 사용자 피드백이 즉각적인가?
5. **통제권 보장**: 취소, 뒤로가기, 닫기 등 유저의 자유로운 액션이 보장되는가?
6. **접근성**: 텍스트 대비율 및 가독성이 충분히 확보되었는가?

자세한 원칙 및 항목별 지침은 [`ui-ux.md`](./ui-ux.md)를 참고하세요.