CREATE TABLE app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    library_page_size INTEGER NOT NULL DEFAULT 25 CHECK (library_page_size BETWEEN 5 AND 500),
    archived_page_size INTEGER NOT NULL DEFAULT 25 CHECK (archived_page_size BETWEEN 5 AND 500),
    tag_page_size INTEGER NOT NULL DEFAULT 50 CHECK (tag_page_size BETWEEN 5 AND 500),
    show_word_counts INTEGER NOT NULL DEFAULT 1 CHECK (show_word_counts IN (0, 1)),
    review_delay_ms INTEGER NOT NULL DEFAULT 0 CHECK (review_delay_ms BETWEEN 0 AND 10000)
);

INSERT INTO app_settings (id) VALUES (1);
