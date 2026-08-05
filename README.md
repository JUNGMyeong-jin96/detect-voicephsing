# 보이스피싱 역할극 시뮬레이션 게임

보이스피싱 피해를 예방하기 위해, 플레이어가 잠재적 피해자가 되어 AI가 재현하는 실제 보이스피싱 수법을 마주하고 이를 알아채고 올바르게 대응(거절·검증·통화종료)하도록 훈련시키는 웹 기반 서사형 시뮬레이션 게임입니다. LLM이 "보이스피싱범" 페르소나로 대사를 직접 입력하며 플레이어를 설득하려 시도하고, 플레이어는 이를 방어해야 합니다.

## 챕터 구성

1. Ch1 — 수상한 전화 (기관사칭형)
2. Ch2 — 투자 리딩방 스캠
3. Ch3 — 대환대출 상담 전화 (대환대출 빙자형)
4. Ch4 — 다급한 문자 한 통 (메신저피싱+협박형)
5. Ch5 — 가족을 지켜라 (목표 반전형 캡스톤)

챕터 성공/실패와 무관하게 종료 시 실제 보이스피싱 예방 수칙 기반의 개인 맞춤 피드백 리포트를 제공합니다.

## 기술 스택

- **Backend:** Python 3.11+, FastAPI, Uvicorn, Pydantic, Anthropic SDK
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS
- **통신:** RESTful API (JSON) + SSE 스트리밍
- **상태 저장:** 인메모리 세션(TTL 24h), 인증 없는 게스트 세션

자세한 설계는 [design-spec.md](design-spec.md), API 스펙은 [api-spec.md](api-spec.md)를 참고하세요.

## 프로젝트 구조

```
backend/    FastAPI 서버 (routers/, services/, models 등)
frontend/   React + Vite + TypeScript 클라이언트
```

## 시작하기

### Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate   # Windows
pip install -r requirements.txt
cp .env.example .env     # ANTHROPIC_API_KEY 값 채우기
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env     # 필요 시 VITE_API_BASE_URL 수정
npm run dev
```

기본적으로 backend는 `http://localhost:8000`, frontend는 `http://localhost:5173`에서 동작합니다.

## 환경 변수

| 위치 | 변수 | 설명 |
|------|------|------|
| `backend/.env` | `ANTHROPIC_API_KEY` | Claude API 키 |
| `frontend/.env` | `VITE_API_BASE_URL` | 백엔드 API 주소 |

`.env` 파일은 `.gitignore`에 의해 저장소에 포함되지 않으며, 각 폴더의 `.env.example`을 복사해 사용합니다.
