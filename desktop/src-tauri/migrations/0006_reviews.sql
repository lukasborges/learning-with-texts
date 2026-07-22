ALTER TABLE terms ADD COLUMN last_reviewed_at TEXT;
ALTER TABLE terms ADD COLUMN next_review_at TEXT;
ALTER TABLE terms ADD COLUMN review_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE terms ADD COLUMN correct_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE review_events (
    id INTEGER PRIMARY KEY,
    term_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 0 AND 3),
    status_before INTEGER NOT NULL,
    status_after INTEGER NOT NULL,
    reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    next_review_at TEXT NOT NULL,
    FOREIGN KEY (term_id) REFERENCES terms (id) ON DELETE CASCADE
);

CREATE INDEX terms_next_review_idx ON terms (next_review_at, status);
CREATE INDEX review_events_term_idx ON review_events (term_id, reviewed_at DESC);
