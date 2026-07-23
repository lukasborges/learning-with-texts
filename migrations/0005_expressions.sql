ALTER TABLE terms ADD COLUMN word_count INTEGER NOT NULL DEFAULT 1
    CHECK (word_count BETWEEN 1 AND 9);

CREATE TABLE expression_occurrences (
    id INTEGER PRIMARY KEY,
    term_id INTEGER NOT NULL,
    text_id INTEGER NOT NULL,
    sentence_id INTEGER NOT NULL,
    start_position INTEGER NOT NULL,
    end_position INTEGER NOT NULL CHECK (end_position >= start_position),
    FOREIGN KEY (term_id) REFERENCES terms (id) ON DELETE CASCADE,
    FOREIGN KEY (text_id) REFERENCES texts (id) ON DELETE CASCADE,
    FOREIGN KEY (sentence_id) REFERENCES sentences (id) ON DELETE CASCADE,
    UNIQUE (term_id, sentence_id, start_position, end_position)
);

CREATE INDEX expression_occurrences_text_idx
    ON expression_occurrences (text_id, sentence_id, start_position);
