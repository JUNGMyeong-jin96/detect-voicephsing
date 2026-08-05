import asyncio
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.config import RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS


class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> bool:
        """True면 허용, False면 초과."""
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] > self.window_seconds:
            q.popleft()
        if len(q) >= self.max_requests:
            return False
        q.append(now)
        return True

    def cleanup(self) -> None:
        now = time.monotonic()
        stale = [k for k, q in self._hits.items() if not q or now - q[-1] > self.window_seconds]
        for k in stale:
            del self._hits[k]


message_rate_limiter = RateLimiter(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS)


async def cleanup_loop(interval_seconds: int = 300) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        message_rate_limiter.cleanup()


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_message_rate_limit(request: Request) -> None:
    if not message_rate_limiter.check(get_client_ip(request)):
        raise HTTPException(
            status_code=429,
            detail="요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
            headers={"Retry-After": str(RATE_LIMIT_WINDOW_SECONDS)},
        )
