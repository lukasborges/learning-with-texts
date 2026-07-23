ALTER TABLE texts ADD COLUMN completed_at TEXT;

CREATE TABLE lesson_completions (
    id INTEGER PRIMARY KEY,
    text_id INTEGER NOT NULL,
    completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    previous_completed_at TEXT,
    undone_at TEXT,
    FOREIGN KEY (text_id) REFERENCES texts (id) ON DELETE CASCADE
);

CREATE TABLE lesson_completion_terms (
    completion_id INTEGER NOT NULL,
    term_id INTEGER NOT NULL,
    PRIMARY KEY (completion_id, term_id),
    FOREIGN KEY (completion_id) REFERENCES lesson_completions (id) ON DELETE CASCADE,
    FOREIGN KEY (term_id) REFERENCES terms (id) ON DELETE CASCADE
);

CREATE INDEX lesson_completions_text_idx
    ON lesson_completions (text_id, completed_at DESC);
