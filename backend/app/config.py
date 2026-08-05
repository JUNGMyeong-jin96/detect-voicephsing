import os

from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
PERSONA_MODEL = os.environ.get("PERSONA_MODEL", "claude-haiku-4-5-20251001")
EVALUATOR_MODEL = os.environ.get("EVALUATOR_MODEL", "claude-sonnet-5")
SESSION_TTL_HOURS = 24
