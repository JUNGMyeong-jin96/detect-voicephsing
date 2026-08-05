import os

from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
PERSONA_MODEL = os.environ.get("PERSONA_MODEL", "claude-haiku-4-5-20251001")
EVALUATOR_MODEL = os.environ.get("EVALUATOR_MODEL", "claude-sonnet-5")
SESSION_TTL_HOURS = 24

DATABASE_URL = os.environ.get("DATABASE_URL", "")
CORS_ORIGINS = [
    o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()
]
RATE_LIMIT_MAX_REQUESTS = int(os.environ.get("RATE_LIMIT_MAX_REQUESTS", "10"))
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("RATE_LIMIT_WINDOW_SECONDS", "60"))
