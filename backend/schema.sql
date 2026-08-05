CREATE TABLE IF NOT EXISTS sessions (
    session_id          TEXT PRIMARY KEY,
    created_at           TIMESTAMPTZ NOT NULL,
    expires_at           TIMESTAMPTZ NOT NULL,
    current_chapter_id   TEXT NOT NULL,
    chapters             JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS history (
    id           BIGSERIAL PRIMARY KEY,
    session_id   TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    chapter_id   TEXT NOT NULL,
    role         TEXT NOT NULL,
    content      TEXT NOT NULL,
    "timestamp"  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_session_chapter ON history (session_id, chapter_id, id);

CREATE TABLE IF NOT EXISTS evaluations (
    id                BIGSERIAL PRIMARY KEY,
    session_id        TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    chapter_id        TEXT NOT NULL,
    success           BOOLEAN NOT NULL,
    matched_patterns  JSONB NOT NULL DEFAULT '[]'::jsonb,
    reason            TEXT NOT NULL DEFAULT '',
    feedback_hint     TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evaluations_session_chapter ON evaluations (session_id, chapter_id, id);
