import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS, DATABASE_URL
from app.rate_limiter import cleanup_loop as rate_limiter_cleanup_loop
from app.routers import chapters, sessions
from app.store import store


@asynccontextmanager
async def lifespan(app: FastAPI):
    await store.init_pool(DATABASE_URL)
    cleanup_task = asyncio.create_task(store.cleanup_loop())
    rl_cleanup_task = asyncio.create_task(rate_limiter_cleanup_loop())
    yield
    cleanup_task.cancel()
    rl_cleanup_task.cancel()
    await store.close_pool()


app = FastAPI(title="Voice Phishing Trainer API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(chapters.router)
