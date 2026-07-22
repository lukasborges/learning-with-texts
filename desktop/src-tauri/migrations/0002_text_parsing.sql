CREATE TABLE sentences (
    id INTEGER PRIMARY KEY,
    language_id INTEGER NOT NULL,
    text_id INTEGER NOT NULL,
    position INTEGER NOT NULL CHECK (position > 0),
    content TEXT NOT NULL,
    FOREIGN KEY (language_id) REFERENCES languages (id) ON DELETE RESTRICT,
    FOREIGN KEY (text_id) REFERENCES texts (id) ON DELETE CASCADE,
    UNIQUE (text_id, position)
);

CREATE TABLE text_items (
    id INTEGER PRIMARY KEY,
    language_id INTEGER NOT NULL,
    text_id INTEGER NOT NULL,
    sentence_id INTEGER NOT NULL,
    position INTEGER NOT NULL CHECK (position > 0),
    surface TEXT NOT NULL,
    normalized TEXT NOT NULL,
    is_word INTEGER NOT NULL CHECK (is_word IN (0, 1)),
    FOREIGN KEY (language_id) REFERENCES languages (id) ON DELETE RESTRICT,
    FOREIGN KEY (text_id) REFERENCES texts (id) ON DELETE CASCADE,
    FOREIGN KEY (sentence_id) REFERENCES sentences (id) ON DELETE CASCADE,
    UNIQUE (sentence_id, position)
);

CREATE INDEX sentences_text_id_idx ON sentences (text_id, position);
CREATE INDEX text_items_text_id_idx ON text_items (text_id);
CREATE INDEX text_items_sentence_id_idx ON text_items (sentence_id, position);
CREATE INDEX text_items_normalized_idx ON text_items (language_id, normalized)
    WHERE is_word = 1;
