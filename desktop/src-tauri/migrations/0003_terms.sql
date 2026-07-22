CREATE TABLE terms (
    id INTEGER PRIMARY KEY,
    language_id INTEGER NOT NULL,
    display_text TEXT NOT NULL,
    normalized TEXT NOT NULL,
    status INTEGER NOT NULL CHECK (status IN (1, 2, 3, 4, 5, 98, 99)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (language_id) REFERENCES languages (id) ON DELETE RESTRICT,
    UNIQUE (language_id, normalized)
);

CREATE INDEX terms_language_status_idx ON terms (language_id, status);
