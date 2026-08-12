from app.rate_limiter import RateLimiter


def test_allows_up_to_max_requests(monkeypatch):
    limiter = RateLimiter(max_requests=3, window_seconds=60)
    now = [1000.0]
    monkeypatch.setattr("time.monotonic", lambda: now[0])

    assert limiter.check("ip1") is True
    assert limiter.check("ip1") is True
    assert limiter.check("ip1") is True
    assert limiter.check("ip1") is False


def test_window_expiry_allows_again(monkeypatch):
    limiter = RateLimiter(max_requests=1, window_seconds=10)
    now = [1000.0]
    monkeypatch.setattr("time.monotonic", lambda: now[0])

    assert limiter.check("ip1") is True
    assert limiter.check("ip1") is False

    now[0] += 11
    assert limiter.check("ip1") is True


def test_different_keys_have_independent_limits(monkeypatch):
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    monkeypatch.setattr("time.monotonic", lambda: 1000.0)

    assert limiter.check("ip1") is True
    assert limiter.check("ip2") is True
    assert limiter.check("ip1") is False
