CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    comment TEXT NOT NULL DEFAULT ''
);

CREATE TABLE term_tags (
    term_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (term_id, tag_id),
    FOREIGN KEY (term_id) REFERENCES terms (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

CREATE TABLE text_tags (
    text_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (text_id, tag_id),
    FOREIGN KEY (text_id) REFERENCES texts (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

CREATE INDEX term_tags_tag_idx ON term_tags (tag_id, term_id);
CREATE INDEX text_tags_tag_idx ON text_tags (tag_id, text_id);
