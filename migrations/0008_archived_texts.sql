ALTER TABLE texts
ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1));

CREATE INDEX texts_archived_idx ON texts (archived, last_opened_at DESC);
