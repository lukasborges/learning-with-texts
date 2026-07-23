CREATE TABLE languages (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    dictionary_uri_1 TEXT NOT NULL DEFAULT '',
    dictionary_uri_2 TEXT,
    google_translate_uri TEXT,
    export_template TEXT,
    text_size INTEGER NOT NULL DEFAULT 100 CHECK (text_size > 0),
    character_substitutions TEXT NOT NULL DEFAULT '',
    regexp_split_sentences TEXT NOT NULL DEFAULT '',
    exceptions_split_sentences TEXT NOT NULL DEFAULT '',
    regexp_word_characters TEXT NOT NULL DEFAULT '',
    remove_spaces INTEGER NOT NULL DEFAULT 0 CHECK (remove_spaces IN (0, 1)),
    split_each_character INTEGER NOT NULL DEFAULT 0 CHECK (split_each_character IN (0, 1)),
    right_to_left INTEGER NOT NULL DEFAULT 0 CHECK (right_to_left IN (0, 1))
);

CREATE TABLE texts (
    id INTEGER PRIMARY KEY,
    language_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    annotated_content TEXT NOT NULL DEFAULT '',
    audio_uri TEXT,
    source_uri TEXT,
    last_opened_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (language_id) REFERENCES languages (id) ON DELETE RESTRICT
);

CREATE INDEX texts_language_id_idx ON texts (language_id);
CREATE INDEX texts_last_opened_at_idx ON texts (last_opened_at DESC);
