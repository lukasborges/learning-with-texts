use crate::parser::parse_text;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

const INITIAL_MIGRATION: &str = include_str!("../migrations/0001_initial.sql");
const TEXT_PARSING_MIGRATION: &str = include_str!("../migrations/0002_text_parsing.sql");
const TERMS_MIGRATION: &str = include_str!("../migrations/0003_terms.sql");
const TERM_DETAILS_MIGRATION: &str = include_str!("../migrations/0004_term_details.sql");
const EXPRESSIONS_MIGRATION: &str = include_str!("../migrations/0005_expressions.sql");
const REVIEWS_MIGRATION: &str = include_str!("../migrations/0006_reviews.sql");
const LATEST_SCHEMA_VERSION: i64 = 6;
const MIGRATIONS: [(i64, &str); 6] = [
    (1, INITIAL_MIGRATION),
    (2, TEXT_PARSING_MIGRATION),
    (3, TERMS_MIGRATION),
    (4, TERM_DETAILS_MIGRATION),
    (5, EXPRESSIONS_MIGRATION),
    (LATEST_SCHEMA_VERSION, REVIEWS_MIGRATION),
];

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryText {
    pub id: i64,
    pub title: String,
    pub language: String,
    pub known_terms: i64,
    pub total_terms: i64,
    pub last_opened: String,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextDetails {
    pub id: i64,
    pub title: String,
    pub language: String,
    pub known_terms: i64,
    pub total_terms: i64,
    pub last_opened: String,
    pub content: String,
    pub source_uri: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTextInput {
    pub language: String,
    pub title: String,
    pub content: String,
    pub source_uri: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTextInput {
    pub id: i64,
    pub language: String,
    pub title: String,
    pub content: String,
    pub source_uri: Option<String>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingItem {
    pub position: i64,
    pub surface: String,
    pub normalized: String,
    pub is_word: bool,
    pub status: i64,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingSentence {
    pub id: i64,
    pub position: i64,
    pub items: Vec<ReadingItem>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingText {
    pub id: i64,
    pub title: String,
    pub language: String,
    pub known_terms: i64,
    pub total_terms: i64,
    pub sentences: Vec<ReadingSentence>,
    pub expressions: Vec<ReadingExpression>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingExpression {
    pub normalized: String,
    pub display_text: String,
    pub status: i64,
    pub translation: String,
    pub romanization: String,
    pub word_count: i64,
    pub sentence_id: i64,
    pub start_position: i64,
    pub end_position: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetTermStatusInput {
    pub text_id: i64,
    pub normalized: String,
    pub status: i64,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TermProgress {
    pub normalized: String,
    pub status: i64,
    pub known_terms: i64,
    pub total_terms: i64,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TermDetails {
    pub normalized: String,
    pub display_text: String,
    pub status: i64,
    pub translation: String,
    pub romanization: String,
    pub word_count: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTermInput {
    pub text_id: i64,
    pub normalized: String,
    pub status: i64,
    pub translation: String,
    pub romanization: String,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedTerm {
    pub term: TermDetails,
    pub known_terms: i64,
    pub total_terms: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateExpressionInput {
    pub text_id: i64,
    pub sentence_id: i64,
    pub start_position: i64,
    pub end_position: i64,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedExpression {
    pub term: TermDetails,
    pub sentence_id: i64,
    pub start_position: i64,
    pub end_position: i64,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewCard {
    pub id: i64,
    pub display_text: String,
    pub language: String,
    pub translation: String,
    pub romanization: String,
    pub status: i64,
    pub word_count: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordReviewInput {
    pub term_id: i64,
    pub rating: i64,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewOutcome {
    pub term_id: i64,
    pub status: i64,
    pub next_review_at: String,
    pub due_terms: i64,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageStatistics {
    pub language: String,
    pub total_terms: i64,
    pub learning_terms: i64,
    pub known_terms: i64,
    pub reviews: i64,
    pub correct_reviews: i64,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewStatistics {
    pub total_terms: i64,
    pub learning_terms: i64,
    pub known_terms: i64,
    pub ignored_terms: i64,
    pub due_terms: i64,
    pub reviews_today: i64,
    pub correct_today: i64,
    pub reviews_last_7_days: i64,
    pub correct_last_7_days: i64,
    pub legacy_due_today: i64,
    pub legacy_due_tomorrow: i64,
    pub languages: Vec<LanguageStatistics>,
}

fn legacy_score(status: i64, days_since_change: i64, tomorrow: bool) -> f64 {
    if status > 5 {
        return 100.0;
    }
    let offset = if tomorrow { 2.0 } else { 1.0 };
    (((2.4_f64.powi(status as i32) + status as f64 - days_since_change as f64 - offset)
        / status as f64)
        - 2.4)
        / 0.143_252_48
}

struct ValidatedTextInput {
    language: String,
    title: String,
    content: String,
    source_uri: Option<String>,
}

fn validate_text_input(
    language: String,
    title: String,
    content: String,
    source_uri: Option<String>,
) -> Result<ValidatedTextInput, String> {
    let language = language.trim().to_string();
    let title = title.trim().to_string();
    let content = content.replace('\u{00ad}', "");
    let source_uri = source_uri
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if language.is_empty() {
        return Err("Language is required".to_string());
    }
    if language.chars().count() > 40 {
        return Err("Language must not exceed 40 characters".to_string());
    }
    if title.is_empty() {
        return Err("Title is required".to_string());
    }
    if title.chars().count() > 200 {
        return Err("Title must not exceed 200 characters".to_string());
    }
    if content.trim().is_empty() {
        return Err("Text content is required".to_string());
    }
    if content.len() > 65_000 {
        return Err("Text content must not exceed 65,000 bytes".to_string());
    }
    if source_uri
        .as_deref()
        .is_some_and(|value| value.chars().count() > 1_000)
    {
        return Err("Source URI must not exceed 1,000 characters".to_string());
    }

    Ok(ValidatedTextInput {
        language,
        title,
        content,
        source_uri,
    })
}

fn find_or_create_language(
    transaction: &Transaction<'_>,
    language: &str,
) -> Result<(i64, String), String> {
    transaction
        .execute(
            "INSERT INTO languages (name) VALUES (?1)
             ON CONFLICT(name) DO NOTHING",
            [language],
        )
        .map_err(|error| format!("Unable to create the language: {error}"))?;

    transaction
        .query_row(
            "SELECT id, name FROM languages WHERE name = ?1 COLLATE NOCASE",
            [language],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|error| format!("Unable to load the text language: {error}"))
}

fn is_saved_term_status(status: i64) -> bool {
    matches!(status, 1..=5 | 98 | 99)
}

pub struct Database {
    connection: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| {
                format!("Unable to create the application data directory: {error}")
            })?;
        }

        let mut connection = Connection::open_with_flags(
            path,
            OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE,
        )
        .map_err(|error| format!("Unable to open the desktop database: {error}"))?;

        Self::configure_and_migrate(&mut connection)?;

        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    fn configure_and_migrate(connection: &mut Connection) -> Result<(), String> {
        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;
                 PRAGMA journal_mode = WAL;
                 PRAGMA busy_timeout = 5000;",
            )
            .map_err(|error| format!("Unable to configure SQLite: {error}"))?;

        let current_version: i64 = connection
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .map_err(|error| format!("Unable to read the schema version: {error}"))?;

        for (version, migration) in MIGRATIONS {
            if current_version >= version {
                continue;
            }
            let transaction = connection
                .transaction()
                .map_err(|error| format!("Unable to start the schema migration: {error}"))?;

            transaction
                .execute_batch(migration)
                .map_err(|error| format!("Unable to apply schema version {version}: {error}"))?;
            if version == 2 {
                Self::backfill_text_parsing(&transaction)?;
            }
            transaction
                .pragma_update(None, "user_version", version)
                .map_err(|error| format!("Unable to record the schema version: {error}"))?;
            transaction
                .commit()
                .map_err(|error| format!("Unable to commit the schema migration: {error}"))?;
        }

        Ok(())
    }

    fn backfill_text_parsing(transaction: &Transaction<'_>) -> Result<(), String> {
        let texts = {
            let mut statement = transaction
                .prepare("SELECT id, language_id, content FROM texts ORDER BY id")
                .map_err(|error| format!("Unable to prepare the text parsing backfill: {error}"))?;
            let rows = statement
                .query_map([], |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                })
                .map_err(|error| format!("Unable to read texts for parsing: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode texts for parsing: {error}"))?
        };

        for (text_id, language_id, content) in texts {
            Self::persist_text_parsing(transaction, text_id, language_id, &content)?;
        }
        Ok(())
    }

    fn persist_text_parsing(
        transaction: &Transaction<'_>,
        text_id: i64,
        language_id: i64,
        content: &str,
    ) -> Result<(), String> {
        transaction
            .execute("DELETE FROM sentences WHERE text_id = ?1", [text_id])
            .map_err(|error| format!("Unable to clear the previous text analysis: {error}"))?;

        for (sentence_index, sentence) in parse_text(content).into_iter().enumerate() {
            transaction
                .execute(
                    "INSERT INTO sentences (language_id, text_id, position, content)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![
                        language_id,
                        text_id,
                        (sentence_index + 1) as i64,
                        sentence.content
                    ],
                )
                .map_err(|error| format!("Unable to save a parsed sentence: {error}"))?;
            let sentence_id = transaction.last_insert_rowid();

            for (item_index, item) in sentence.items.into_iter().enumerate() {
                transaction
                    .execute(
                        "INSERT INTO text_items
                            (language_id, text_id, sentence_id, position, surface, normalized, is_word)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        params![
                            language_id,
                            text_id,
                            sentence_id,
                            (item_index + 1) as i64,
                            item.surface,
                            item.normalized,
                            item.is_word
                        ],
                    )
                    .map_err(|error| format!("Unable to save a parsed text item: {error}"))?;
            }
        }

        Ok(())
    }

    fn text_progress(transaction: &Transaction<'_>, text_id: i64) -> Result<(i64, i64), String> {
        transaction
            .query_row(
                "SELECT
                    (SELECT COUNT(DISTINCT text_items.normalized)
                     FROM text_items
                     INNER JOIN terms
                        ON terms.language_id = text_items.language_id
                       AND terms.normalized = text_items.normalized
                     WHERE text_items.text_id = ?1
                       AND text_items.is_word = 1
                       AND terms.status IN (5, 99)),
                    (SELECT COUNT(DISTINCT normalized)
                     FROM text_items
                     WHERE text_id = ?1 AND is_word = 1)",
                [text_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|error| format!("Unable to calculate text progress: {error}"))
    }

    fn find_text_term(
        transaction: &Transaction<'_>,
        text_id: i64,
        normalized: &str,
    ) -> Result<(i64, String, i64), String> {
        let word = transaction
            .query_row(
                "SELECT text_items.language_id, text_items.surface
                 FROM text_items
                 WHERE text_items.text_id = ?1
                   AND text_items.normalized = ?2
                   AND text_items.is_word = 1
                 ORDER BY text_items.id
                 LIMIT 1",
                params![text_id, normalized],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, 1)),
            )
            .optional()
            .map_err(|error| format!("Unable to load the parsed term: {error}"))?;
        if let Some(word) = word {
            return Ok(word);
        }

        transaction
            .query_row(
                "SELECT terms.language_id, terms.display_text, terms.word_count
                 FROM expression_occurrences
                 INNER JOIN terms ON terms.id = expression_occurrences.term_id
                 WHERE expression_occurrences.text_id = ?1 AND terms.normalized = ?2
                 ORDER BY expression_occurrences.id
                 LIMIT 1",
                params![text_id, normalized],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()
            .map_err(|error| format!("Unable to load the expression: {error}"))?
            .ok_or_else(|| "Term was not found in this text".to_string())
    }

    pub fn list_texts(&self) -> Result<Vec<LibraryText>, String> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let mut statement = connection
            .prepare(
                "SELECT texts.id,
                        texts.title,
                        languages.name,
                        (SELECT COUNT(DISTINCT text_items.normalized)
                         FROM text_items
                         INNER JOIN terms
                            ON terms.language_id = text_items.language_id
                           AND terms.normalized = text_items.normalized
                         WHERE text_items.text_id = texts.id
                           AND text_items.is_word = 1
                           AND terms.status IN (5, 99)) AS known_terms,
                        (SELECT COUNT(DISTINCT text_items.normalized)
                         FROM text_items
                         WHERE text_items.text_id = texts.id
                           AND text_items.is_word = 1) AS total_terms,
                        COALESCE(texts.last_opened_at, '')
                 FROM texts
                 INNER JOIN languages ON languages.id = texts.language_id
                 ORDER BY texts.last_opened_at DESC, texts.title COLLATE NOCASE",
            )
            .map_err(|error| format!("Unable to prepare the library query: {error}"))?;

        let rows = statement
            .query_map([], |row| {
                Ok(LibraryText {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    language: row.get(2)?,
                    known_terms: row.get(3)?,
                    total_terms: row.get(4)?,
                    last_opened: row.get(5)?,
                })
            })
            .map_err(|error| format!("Unable to read the text library: {error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Unable to decode the text library: {error}"))
    }

    pub fn create_text(&self, input: CreateTextInput) -> Result<LibraryText, String> {
        let input =
            validate_text_input(input.language, input.title, input.content, input.source_uri)?;

        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Unable to start text creation: {error}"))?;

        let (language_id, stored_language) =
            find_or_create_language(&transaction, &input.language)?;

        transaction
            .execute(
                "INSERT INTO texts (language_id, title, content, source_uri)
                 VALUES (?1, ?2, ?3, ?4)",
                params![language_id, input.title, input.content, input.source_uri],
            )
            .map_err(|error| format!("Unable to create the text: {error}"))?;
        let id = transaction.last_insert_rowid();
        Self::persist_text_parsing(&transaction, id, language_id, &input.content)?;
        let (known_terms, total_terms) = Self::text_progress(&transaction, id)?;

        transaction
            .commit()
            .map_err(|error| format!("Unable to save the text: {error}"))?;

        Ok(LibraryText {
            id,
            title: input.title,
            language: stored_language,
            known_terms,
            total_terms,
            last_opened: String::new(),
        })
    }

    pub fn get_text(&self, id: i64) -> Result<TextDetails, String> {
        if id <= 0 {
            return Err("Text was not found".to_string());
        }

        let connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        connection
            .query_row(
                "SELECT texts.id,
                        texts.title,
                        languages.name,
                        (SELECT COUNT(DISTINCT text_items.normalized)
                         FROM text_items
                         INNER JOIN terms
                            ON terms.language_id = text_items.language_id
                           AND terms.normalized = text_items.normalized
                         WHERE text_items.text_id = texts.id
                           AND text_items.is_word = 1
                           AND terms.status IN (5, 99)) AS known_terms,
                        (SELECT COUNT(DISTINCT text_items.normalized)
                         FROM text_items
                         WHERE text_items.text_id = texts.id
                           AND text_items.is_word = 1) AS total_terms,
                        COALESCE(texts.last_opened_at, ''),
                        texts.content,
                        texts.source_uri
                 FROM texts
                 INNER JOIN languages ON languages.id = texts.language_id
                 WHERE texts.id = ?1",
                [id],
                |row| {
                    Ok(TextDetails {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        language: row.get(2)?,
                        known_terms: row.get(3)?,
                        total_terms: row.get(4)?,
                        last_opened: row.get(5)?,
                        content: row.get(6)?,
                        source_uri: row.get(7)?,
                    })
                },
            )
            .optional()
            .map_err(|error| format!("Unable to load the text: {error}"))?
            .ok_or_else(|| "Text was not found".to_string())
    }

    pub fn update_text(&self, input: UpdateTextInput) -> Result<LibraryText, String> {
        if input.id <= 0 {
            return Err("Text was not found".to_string());
        }
        let id = input.id;
        let input =
            validate_text_input(input.language, input.title, input.content, input.source_uri)?;

        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Unable to start text update: {error}"))?;
        let (language_id, stored_language) =
            find_or_create_language(&transaction, &input.language)?;

        let changed = transaction
            .execute(
                "UPDATE texts
                 SET language_id = ?1,
                     title = ?2,
                     content = ?3,
                     source_uri = ?4,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?5",
                params![
                    language_id,
                    input.title,
                    input.content,
                    input.source_uri,
                    id
                ],
            )
            .map_err(|error| format!("Unable to update the text: {error}"))?;
        if changed == 0 {
            return Err("Text was not found".to_string());
        }
        Self::persist_text_parsing(&transaction, id, language_id, &input.content)?;
        let (known_terms, total_terms) = Self::text_progress(&transaction, id)?;

        transaction
            .commit()
            .map_err(|error| format!("Unable to save the text update: {error}"))?;

        Ok(LibraryText {
            id,
            title: input.title,
            language: stored_language,
            known_terms,
            total_terms,
            last_opened: String::new(),
        })
    }

    pub fn get_reading_text(&self, id: i64) -> Result<ReadingText, String> {
        if id <= 0 {
            return Err("Text was not found".to_string());
        }

        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Unable to start the reading session: {error}"))?;
        let metadata = transaction
            .query_row(
                "SELECT texts.title, languages.name
                 FROM texts
                 INNER JOIN languages ON languages.id = texts.language_id
                 WHERE texts.id = ?1",
                [id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .optional()
            .map_err(|error| format!("Unable to load the reading text: {error}"))?
            .ok_or_else(|| "Text was not found".to_string())?;

        transaction
            .execute(
                "UPDATE texts SET last_opened_at = CURRENT_TIMESTAMP WHERE id = ?1",
                [id],
            )
            .map_err(|error| format!("Unable to record the reading session: {error}"))?;

        let sentence_rows = {
            let mut statement = transaction
                .prepare("SELECT id, position FROM sentences WHERE text_id = ?1 ORDER BY position")
                .map_err(|error| format!("Unable to prepare the reading sentences: {error}"))?;
            let rows = statement
                .query_map([id], |row| {
                    Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
                })
                .map_err(|error| format!("Unable to load the reading sentences: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode the reading sentences: {error}"))?
        };

        let mut sentences = Vec::with_capacity(sentence_rows.len());
        for (sentence_id, position) in sentence_rows {
            let items = {
                let mut statement = transaction
                    .prepare(
                        "SELECT text_items.position,
                                text_items.surface,
                                text_items.normalized,
                                text_items.is_word,
                                COALESCE(terms.status, 0)
                         FROM text_items
                         LEFT JOIN terms
                            ON terms.language_id = text_items.language_id
                           AND terms.normalized = text_items.normalized
                         WHERE text_items.sentence_id = ?1
                         ORDER BY text_items.position",
                    )
                    .map_err(|error| format!("Unable to prepare the reading items: {error}"))?;
                let rows = statement
                    .query_map([sentence_id], |row| {
                        Ok(ReadingItem {
                            position: row.get(0)?,
                            surface: row.get(1)?,
                            normalized: row.get(2)?,
                            is_word: row.get(3)?,
                            status: row.get(4)?,
                        })
                    })
                    .map_err(|error| format!("Unable to load the reading items: {error}"))?;
                rows.collect::<Result<Vec<_>, _>>()
                    .map_err(|error| format!("Unable to decode the reading items: {error}"))?
            };
            sentences.push(ReadingSentence {
                id: sentence_id,
                position,
                items,
            });
        }

        let expressions = {
            let mut statement = transaction
                .prepare(
                    "SELECT terms.normalized,
                            terms.display_text,
                            terms.status,
                            terms.translation,
                            COALESCE(terms.romanization, ''),
                            terms.word_count,
                            expression_occurrences.sentence_id,
                            expression_occurrences.start_position,
                            expression_occurrences.end_position
                     FROM expression_occurrences
                     INNER JOIN terms ON terms.id = expression_occurrences.term_id
                     WHERE expression_occurrences.text_id = ?1
                     ORDER BY expression_occurrences.sentence_id,
                              expression_occurrences.start_position",
                )
                .map_err(|error| format!("Unable to prepare expressions: {error}"))?;
            let rows = statement
                .query_map([id], |row| {
                    Ok(ReadingExpression {
                        normalized: row.get(0)?,
                        display_text: row.get(1)?,
                        status: row.get(2)?,
                        translation: row.get(3)?,
                        romanization: row.get(4)?,
                        word_count: row.get(5)?,
                        sentence_id: row.get(6)?,
                        start_position: row.get(7)?,
                        end_position: row.get(8)?,
                    })
                })
                .map_err(|error| format!("Unable to load expressions: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode expressions: {error}"))?
        };

        let (known_terms, total_terms) = Self::text_progress(&transaction, id)?;
        transaction
            .commit()
            .map_err(|error| format!("Unable to open the reading session: {error}"))?;

        Ok(ReadingText {
            id,
            title: metadata.0,
            language: metadata.1,
            known_terms,
            total_terms,
            sentences,
            expressions,
        })
    }

    pub fn set_term_status(&self, input: SetTermStatusInput) -> Result<TermProgress, String> {
        if input.text_id <= 0 {
            return Err("Text was not found".to_string());
        }
        if input.status != 0 && !is_saved_term_status(input.status) {
            return Err("Term status is invalid".to_string());
        }
        let normalized = input.normalized.trim();
        if normalized.is_empty() || normalized.chars().count() > 250 {
            return Err("Term is invalid".to_string());
        }

        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Unable to start the term update: {error}"))?;
        let term = Self::find_text_term(&transaction, input.text_id, normalized)?;

        if input.status == 0 {
            transaction
                .execute(
                    "DELETE FROM terms WHERE language_id = ?1 AND normalized = ?2",
                    params![term.0, normalized],
                )
                .map_err(|error| format!("Unable to reset the term status: {error}"))?;
        } else {
            transaction
                .execute(
                    "INSERT INTO terms (language_id, display_text, normalized, status, word_count)
                     VALUES (?1, ?2, ?3, ?4, ?5)
                     ON CONFLICT(language_id, normalized) DO UPDATE SET
                        display_text = excluded.display_text,
                        status = excluded.status,
                        updated_at = CURRENT_TIMESTAMP",
                    params![term.0, term.1, normalized, input.status, term.2],
                )
                .map_err(|error| format!("Unable to save the term status: {error}"))?;
        }

        let (known_terms, total_terms) = Self::text_progress(&transaction, input.text_id)?;
        transaction
            .commit()
            .map_err(|error| format!("Unable to commit the term update: {error}"))?;

        Ok(TermProgress {
            normalized: normalized.to_string(),
            status: input.status,
            known_terms,
            total_terms,
        })
    }

    pub fn get_term_details(
        &self,
        text_id: i64,
        normalized: String,
    ) -> Result<TermDetails, String> {
        if text_id <= 0 {
            return Err("Text was not found".to_string());
        }
        let normalized = normalized.trim().to_string();
        if normalized.is_empty() || normalized.chars().count() > 250 {
            return Err("Term is invalid".to_string());
        }

        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Unable to start the term lookup: {error}"))?;
        let occurrence = Self::find_text_term(&transaction, text_id, &normalized)?;
        let stored = transaction
            .query_row(
                "SELECT status, translation, COALESCE(romanization, ''), word_count
                 FROM terms
                 WHERE language_id = ?1 AND normalized = ?2",
                params![occurrence.0, normalized],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, i64>(3)?,
                    ))
                },
            )
            .optional()
            .map_err(|error| format!("Unable to load the term details: {error}"))?;
        transaction
            .commit()
            .map_err(|error| format!("Unable to finish the term lookup: {error}"))?;

        let (status, translation, romanization, word_count) =
            stored.unwrap_or_else(|| (0, String::new(), String::new(), occurrence.2));
        Ok(TermDetails {
            normalized,
            display_text: occurrence.1,
            status,
            translation,
            romanization,
            word_count,
        })
    }

    pub fn save_term(&self, input: SaveTermInput) -> Result<SavedTerm, String> {
        if input.text_id <= 0 {
            return Err("Text was not found".to_string());
        }
        if !is_saved_term_status(input.status) {
            return Err("Choose a saved status for the term".to_string());
        }
        let normalized = input.normalized.trim().to_string();
        let translation = input.translation.trim().to_string();
        let romanization = input.romanization.trim().to_string();
        if normalized.is_empty() || normalized.chars().count() > 250 {
            return Err("Term is invalid".to_string());
        }
        if translation.chars().count() > 500 {
            return Err("Translation must not exceed 500 characters".to_string());
        }
        if romanization.chars().count() > 100 {
            return Err("Romanization must not exceed 100 characters".to_string());
        }

        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Unable to start the term save: {error}"))?;
        let occurrence = Self::find_text_term(&transaction, input.text_id, &normalized)?;
        transaction
            .execute(
                "INSERT INTO terms
                    (language_id, display_text, normalized, status, translation, romanization, word_count)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(language_id, normalized) DO UPDATE SET
                    display_text = excluded.display_text,
                    status = excluded.status,
                    translation = excluded.translation,
                    romanization = excluded.romanization,
                    word_count = excluded.word_count,
                    updated_at = CURRENT_TIMESTAMP",
                params![
                    occurrence.0,
                    occurrence.1,
                    normalized,
                    input.status,
                    translation,
                    romanization,
                    occurrence.2
                ],
            )
            .map_err(|error| format!("Unable to save the term details: {error}"))?;
        let (known_terms, total_terms) = Self::text_progress(&transaction, input.text_id)?;
        transaction
            .commit()
            .map_err(|error| format!("Unable to commit the term details: {error}"))?;

        Ok(SavedTerm {
            term: TermDetails {
                normalized,
                display_text: occurrence.1,
                status: input.status,
                translation,
                romanization,
                word_count: occurrence.2,
            },
            known_terms,
            total_terms,
        })
    }

    pub fn create_expression(
        &self,
        input: CreateExpressionInput,
    ) -> Result<CreatedExpression, String> {
        if input.text_id <= 0 || input.sentence_id <= 0 {
            return Err("Text was not found".to_string());
        }
        let start_position = input.start_position.min(input.end_position);
        let end_position = input.start_position.max(input.end_position);

        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Unable to start expression creation: {error}"))?;
        let items = {
            let mut statement = transaction
                .prepare(
                    "SELECT text_items.language_id,
                            text_items.surface,
                            text_items.normalized,
                            text_items.is_word
                     FROM text_items
                     WHERE text_items.text_id = ?1
                       AND text_items.sentence_id = ?2
                       AND text_items.position BETWEEN ?3 AND ?4
                     ORDER BY text_items.position",
                )
                .map_err(|error| format!("Unable to prepare the expression items: {error}"))?;
            let rows = statement
                .query_map(
                    params![
                        input.text_id,
                        input.sentence_id,
                        start_position,
                        end_position
                    ],
                    |row| {
                        Ok((
                            row.get::<_, i64>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                            row.get::<_, bool>(3)?,
                        ))
                    },
                )
                .map_err(|error| format!("Unable to load the expression items: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode the expression items: {error}"))?
        };
        if items.is_empty()
            || !items.first().is_some_and(|item| item.3)
            || !items.last().is_some_and(|item| item.3)
        {
            return Err("Select the first and last terms of the expression".to_string());
        }

        let words: Vec<&str> = items
            .iter()
            .filter(|item| item.3)
            .map(|item| item.2.as_str())
            .collect();
        if !(2..=9).contains(&words.len()) {
            return Err("An expression must contain between 2 and 9 terms".to_string());
        }
        let normalized = words.join(" ");
        let display_text = items.iter().map(|item| item.1.as_str()).collect::<String>();
        if normalized.chars().count() > 250 || display_text.chars().count() > 250 {
            return Err("Expression must not exceed 250 characters".to_string());
        }
        let language_id = items[0].0;
        let word_count = words.len() as i64;

        transaction
            .execute(
                "INSERT INTO terms
                    (language_id, display_text, normalized, status, word_count)
                 VALUES (?1, ?2, ?3, 1, ?4)
                 ON CONFLICT(language_id, normalized) DO UPDATE SET
                    display_text = excluded.display_text,
                    word_count = excluded.word_count,
                    updated_at = CURRENT_TIMESTAMP",
                params![language_id, display_text, normalized, word_count],
            )
            .map_err(|error| format!("Unable to save the expression: {error}"))?;
        let stored = transaction
            .query_row(
                "SELECT id, status, translation, COALESCE(romanization, '')
                 FROM terms WHERE language_id = ?1 AND normalized = ?2",
                params![language_id, normalized],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                    ))
                },
            )
            .map_err(|error| format!("Unable to load the saved expression: {error}"))?;
        transaction
            .execute(
                "INSERT INTO expression_occurrences
                    (term_id, text_id, sentence_id, start_position, end_position)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(term_id, sentence_id, start_position, end_position) DO NOTHING",
                params![
                    stored.0,
                    input.text_id,
                    input.sentence_id,
                    start_position,
                    end_position
                ],
            )
            .map_err(|error| format!("Unable to link the expression to the text: {error}"))?;
        transaction
            .commit()
            .map_err(|error| format!("Unable to commit the expression: {error}"))?;

        Ok(CreatedExpression {
            term: TermDetails {
                normalized,
                display_text,
                status: stored.1,
                translation: stored.2,
                romanization: stored.3,
                word_count,
            },
            sentence_id: input.sentence_id,
            start_position,
            end_position,
        })
    }

    pub fn list_review_terms(&self, limit: i64) -> Result<Vec<ReviewCard>, String> {
        if !(1..=100).contains(&limit) {
            return Err("Review limit must be between 1 and 100".to_string());
        }
        let connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let mut statement = connection
            .prepare(
                "SELECT terms.id,
                        terms.display_text,
                        languages.name,
                        terms.translation,
                        COALESCE(terms.romanization, ''),
                        terms.status,
                        terms.word_count
                 FROM terms
                 INNER JOIN languages ON languages.id = terms.language_id
                 WHERE terms.status BETWEEN 1 AND 5
                   AND (terms.next_review_at IS NULL OR terms.next_review_at <= CURRENT_TIMESTAMP)
                 ORDER BY COALESCE(terms.next_review_at, ''), terms.updated_at, terms.id
                 LIMIT ?1",
            )
            .map_err(|error| format!("Unable to prepare the review queue: {error}"))?;
        let rows = statement
            .query_map([limit], |row| {
                Ok(ReviewCard {
                    id: row.get(0)?,
                    display_text: row.get(1)?,
                    language: row.get(2)?,
                    translation: row.get(3)?,
                    romanization: row.get(4)?,
                    status: row.get(5)?,
                    word_count: row.get(6)?,
                })
            })
            .map_err(|error| format!("Unable to load the review queue: {error}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Unable to decode the review queue: {error}"))
    }

    pub fn record_review(&self, input: RecordReviewInput) -> Result<ReviewOutcome, String> {
        if input.term_id <= 0 {
            return Err("Review term was not found".to_string());
        }
        if !(0..=3).contains(&input.rating) {
            return Err("Review rating is invalid".to_string());
        }

        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Unable to start the review update: {error}"))?;
        let status_before = transaction
            .query_row(
                "SELECT status FROM terms WHERE id = ?1 AND status BETWEEN 1 AND 5",
                [input.term_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| format!("Unable to load the review term: {error}"))?
            .ok_or_else(|| "Review term was not found".to_string())?;
        let (status_after, interval) = match input.rating {
            0 => (1, "+10 minutes".to_string()),
            1 => (status_before.max(1), "+1 day".to_string()),
            2 => {
                let status = (status_before + 1).min(5);
                let days = 1_i64 << (status - 1).min(5);
                (status, format!("+{days} days"))
            }
            3 => (5, "+30 days".to_string()),
            _ => unreachable!(),
        };

        transaction
            .execute(
                "UPDATE terms
                 SET status = ?1,
                     last_reviewed_at = CURRENT_TIMESTAMP,
                     next_review_at = datetime('now', ?2),
                     review_count = review_count + 1,
                     correct_count = correct_count + CASE WHEN ?3 >= 2 THEN 1 ELSE 0 END,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?4",
                params![status_after, interval, input.rating, input.term_id],
            )
            .map_err(|error| format!("Unable to update the review term: {error}"))?;
        let next_review_at: String = transaction
            .query_row(
                "SELECT next_review_at FROM terms WHERE id = ?1",
                [input.term_id],
                |row| row.get(0),
            )
            .map_err(|error| format!("Unable to load the next review date: {error}"))?;
        transaction
            .execute(
                "INSERT INTO review_events
                    (term_id, rating, status_before, status_after, next_review_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    input.term_id,
                    input.rating,
                    status_before,
                    status_after,
                    next_review_at
                ],
            )
            .map_err(|error| format!("Unable to save the review event: {error}"))?;
        let due_terms: i64 = transaction
            .query_row(
                "SELECT COUNT(*) FROM terms
                 WHERE status BETWEEN 1 AND 5
                   AND (next_review_at IS NULL OR next_review_at <= CURRENT_TIMESTAMP)",
                [],
                |row| row.get(0),
            )
            .map_err(|error| format!("Unable to count due terms: {error}"))?;
        transaction
            .commit()
            .map_err(|error| format!("Unable to commit the review: {error}"))?;

        Ok(ReviewOutcome {
            term_id: input.term_id,
            status: status_after,
            next_review_at,
            due_terms,
        })
    }

    pub fn review_statistics(&self) -> Result<ReviewStatistics, String> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let totals: (i64, i64, i64, i64, i64, i64, i64, i64, i64) = connection
            .query_row(
                "SELECT
                    (SELECT COUNT(*) FROM terms WHERE status IN (1,2,3,4,5,99)),
                    (SELECT COUNT(*) FROM terms WHERE status BETWEEN 1 AND 4),
                    (SELECT COUNT(*) FROM terms WHERE status IN (5,99)),
                    (SELECT COUNT(*) FROM terms WHERE status = 98),
                    (SELECT COUNT(*) FROM terms WHERE status BETWEEN 1 AND 5
                        AND (next_review_at IS NULL OR next_review_at <= CURRENT_TIMESTAMP)),
                    (SELECT COUNT(*) FROM review_events WHERE date(reviewed_at) = date('now')),
                    (SELECT COUNT(*) FROM review_events
                        WHERE date(reviewed_at) = date('now') AND rating >= 2),
                    (SELECT COUNT(*) FROM review_events
                        WHERE reviewed_at >= datetime('now', '-6 days')),
                    (SELECT COUNT(*) FROM review_events
                        WHERE reviewed_at >= datetime('now', '-6 days') AND rating >= 2)",
                [],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                        row.get(6)?,
                        row.get(7)?,
                        row.get(8)?,
                    ))
                },
            )
            .map_err(|error| format!("Unable to calculate review totals: {error}"))?;

        let score_rows = {
            let mut statement = connection
                .prepare(
                    "SELECT status,
                            MAX(0, CAST(julianday('now') - julianday(
                                COALESCE(last_reviewed_at, updated_at)) AS INTEGER))
                     FROM terms WHERE status BETWEEN 1 AND 5",
                )
                .map_err(|error| format!("Unable to prepare legacy scores: {error}"))?;
            let rows = statement
                .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)))
                .map_err(|error| format!("Unable to load legacy scores: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode legacy scores: {error}"))?
        };
        let legacy_due_today = score_rows
            .iter()
            .filter(|(status, days)| legacy_score(*status, *days, false) < 0.0)
            .count() as i64;
        let legacy_due_tomorrow = score_rows
            .iter()
            .filter(|(status, days)| legacy_score(*status, *days, true) < 0.0)
            .count() as i64;

        let languages = {
            let mut statement = connection
                .prepare(
                    "SELECT languages.name,
                            COUNT(DISTINCT CASE WHEN terms.status IN (1,2,3,4,5,99)
                                THEN terms.id END),
                            COUNT(DISTINCT CASE WHEN terms.status BETWEEN 1 AND 4
                                THEN terms.id END),
                            COUNT(DISTINCT CASE WHEN terms.status IN (5,99)
                                THEN terms.id END),
                            COUNT(review_events.id),
                            SUM(CASE WHEN review_events.rating >= 2 THEN 1 ELSE 0 END)
                     FROM languages
                     LEFT JOIN terms ON terms.language_id = languages.id
                     LEFT JOIN review_events ON review_events.term_id = terms.id
                     GROUP BY languages.id
                     ORDER BY languages.name COLLATE NOCASE",
                )
                .map_err(|error| format!("Unable to prepare language statistics: {error}"))?;
            let rows = statement
                .query_map([], |row| {
                    Ok(LanguageStatistics {
                        language: row.get(0)?,
                        total_terms: row.get(1)?,
                        learning_terms: row.get(2)?,
                        known_terms: row.get(3)?,
                        reviews: row.get(4)?,
                        correct_reviews: row.get(5)?,
                    })
                })
                .map_err(|error| format!("Unable to load language statistics: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode language statistics: {error}"))?
        };

        Ok(ReviewStatistics {
            total_terms: totals.0,
            learning_terms: totals.1,
            known_terms: totals.2,
            ignored_terms: totals.3,
            due_terms: totals.4,
            reviews_today: totals.5,
            correct_today: totals.6,
            reviews_last_7_days: totals.7,
            correct_last_7_days: totals.8,
            legacy_due_today,
            legacy_due_tomorrow,
            languages,
        })
    }

    pub fn delete_text(&self, id: i64) -> Result<(), String> {
        if id <= 0 {
            return Err("Text was not found".to_string());
        }

        let connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let changed = connection
            .execute("DELETE FROM texts WHERE id = ?1", [id])
            .map_err(|error| format!("Unable to delete the text: {error}"))?;
        if changed == 0 {
            return Err("Text was not found".to_string());
        }

        Ok(())
    }

    #[cfg(test)]
    fn in_memory() -> Result<Self, String> {
        let mut connection = Connection::open_in_memory()
            .map_err(|error| format!("Unable to open an in-memory database: {error}"))?;
        Self::configure_and_migrate(&mut connection)?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_enables_foreign_keys_and_sets_the_schema_version() {
        let database = Database::in_memory().expect("database should migrate");
        let connection = database.connection.lock().expect("database should lock");
        let foreign_keys: i64 = connection
            .pragma_query_value(None, "foreign_keys", |row| row.get(0))
            .expect("foreign key setting should be readable");
        let version: i64 = connection
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .expect("schema version should be readable");

        assert_eq!(foreign_keys, 1);
        assert_eq!(version, LATEST_SCHEMA_VERSION);
    }

    #[test]
    fn lists_texts_with_their_language() {
        let database = Database::in_memory().expect("database should migrate");
        {
            let connection = database.connection.lock().expect("database should lock");
            connection
                .execute("INSERT INTO languages (name) VALUES (?1)", ["English"])
                .expect("language should insert");
            connection
                .execute(
                    "INSERT INTO texts (language_id, title, content, last_opened_at)
                     VALUES (1, ?1, ?2, ?3)",
                    [
                        "The Man and the Dog",
                        "Sample content",
                        "2026-07-22T12:00:00Z",
                    ],
                )
                .expect("text should insert");
        }

        let texts = database.list_texts().expect("library should load");

        assert_eq!(texts.len(), 1);
        assert_eq!(texts[0].title, "The Man and the Dog");
        assert_eq!(texts[0].language, "English");
    }

    #[test]
    fn rejects_a_text_with_an_unknown_language() {
        let database = Database::in_memory().expect("database should migrate");
        let connection = database.connection.lock().expect("database should lock");
        let result = connection.execute(
            "INSERT INTO texts (language_id, title, content) VALUES (999, ?1, ?2)",
            ["Invalid", "Sample content"],
        );

        assert!(result.is_err());
    }

    fn text_input(language: &str, title: &str, content: &str) -> CreateTextInput {
        CreateTextInput {
            language: language.to_string(),
            title: title.to_string(),
            content: content.to_string(),
            source_uri: None,
        }
    }

    #[test]
    fn creates_a_text_and_its_language_atomically() {
        let database = Database::in_memory().expect("database should migrate");

        let created = database
            .create_text(CreateTextInput {
                source_uri: Some(" https://example.com/story ".to_string()),
                ..text_input(" English ", " A local story ", "Some\u{00ad} text")
            })
            .expect("text should be created");

        assert_eq!(created.id, 1);
        assert_eq!(created.language, "English");
        assert_eq!(created.title, "A local story");
        assert_eq!(created.total_terms, 2);

        let connection = database.connection.lock().expect("database should lock");
        let stored: (String, String, String) = connection
            .query_row(
                "SELECT content, source_uri, languages.name
                 FROM texts INNER JOIN languages ON languages.id = texts.language_id",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("created text should be readable");
        assert_eq!(
            stored,
            (
                "Some text".into(),
                "https://example.com/story".into(),
                "English".into()
            )
        );
    }

    #[test]
    fn reuses_an_existing_language_case_insensitively() {
        let database = Database::in_memory().expect("database should migrate");

        database
            .create_text(text_input("English", "First", "First text"))
            .expect("first text should be created");
        let second = database
            .create_text(text_input("english", "Second", "Second text"))
            .expect("second text should be created");

        assert_eq!(second.language, "English");
        let connection = database.connection.lock().expect("database should lock");
        let language_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM languages", [], |row| row.get(0))
            .expect("language count should be readable");
        assert_eq!(language_count, 1);
    }

    #[test]
    fn validates_required_fields_and_the_legacy_byte_limit() {
        let database = Database::in_memory().expect("database should migrate");

        assert_eq!(
            database
                .create_text(text_input("English", "", "Content"))
                .expect_err("empty title should fail"),
            "Title is required"
        );
        assert_eq!(
            database
                .create_text(text_input("English", "Long", &"é".repeat(32_501)))
                .expect_err("oversized text should fail"),
            "Text content must not exceed 65,000 bytes"
        );
    }

    #[test]
    fn loads_full_text_details_on_demand() {
        let database = Database::in_memory().expect("database should migrate");
        let created = database
            .create_text(CreateTextInput {
                source_uri: Some("https://example.com".to_string()),
                ..text_input("English", "Details", "Full content")
            })
            .expect("text should be created");

        let details = database
            .get_text(created.id)
            .expect("text details should load");

        assert_eq!(details.content, "Full content");
        assert_eq!(details.source_uri.as_deref(), Some("https://example.com"));
        assert_eq!(database.get_text(999).unwrap_err(), "Text was not found");
    }

    #[test]
    fn updates_a_text_and_its_language() {
        let database = Database::in_memory().expect("database should migrate");
        let created = database
            .create_text(text_input("English", "Original", "Old content"))
            .expect("text should be created");

        let updated = database
            .update_text(UpdateTextInput {
                id: created.id,
                language: "French".to_string(),
                title: "Updated".to_string(),
                content: "New content".to_string(),
                source_uri: None,
            })
            .expect("text should update");
        let details = database
            .get_text(created.id)
            .expect("updated text should load");

        assert_eq!(updated.title, "Updated");
        assert_eq!(updated.total_terms, 2);
        assert_eq!(details.language, "French");
        assert_eq!(details.content, "New content");
    }

    #[test]
    fn deletes_a_text_but_preserves_its_language() {
        let database = Database::in_memory().expect("database should migrate");
        let created = database
            .create_text(text_input("English", "Disposable", "Content"))
            .expect("text should be created");

        database
            .delete_text(created.id)
            .expect("text should be deleted");

        assert!(database
            .list_texts()
            .expect("library should load")
            .is_empty());
        assert_eq!(
            database.delete_text(created.id).unwrap_err(),
            "Text was not found"
        );
        let connection = database.connection.lock().expect("database should lock");
        let language_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM languages", [], |row| row.get(0))
            .expect("language count should be readable");
        assert_eq!(language_count, 1);
        let sentence_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM sentences", [], |row| row.get(0))
            .expect("sentence count should be readable");
        let item_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM text_items", [], |row| row.get(0))
            .expect("item count should be readable");
        assert_eq!((sentence_count, item_count), (0, 0));
    }

    #[test]
    fn upgrades_and_parses_texts_from_schema_version_one() {
        let mut connection = Connection::open_in_memory().expect("database should open");
        connection
            .execute_batch(INITIAL_MIGRATION)
            .expect("initial schema should apply");
        connection
            .pragma_update(None, "user_version", 1)
            .expect("schema version should set");
        connection
            .execute("INSERT INTO languages (name) VALUES ('English')", [])
            .expect("language should insert");
        connection
            .execute(
                "INSERT INTO texts (language_id, title, content)
                 VALUES (1, 'Existing', 'First sentence. Second sentence!')",
                [],
            )
            .expect("text should insert");

        Database::configure_and_migrate(&mut connection).expect("database should upgrade");

        let version: i64 = connection
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .expect("schema version should be readable");
        let sentence_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM sentences", [], |row| row.get(0))
            .expect("sentences should be readable");
        let term_count: i64 = connection
            .query_row(
                "SELECT COUNT(DISTINCT normalized) FROM text_items WHERE is_word = 1",
                [],
                |row| row.get(0),
            )
            .expect("terms should be readable");

        assert_eq!(version, LATEST_SCHEMA_VERSION);
        assert_eq!(sentence_count, 2);
        assert_eq!(term_count, 3);
    }

    #[test]
    fn opens_a_parsed_text_for_reading_and_records_the_visit() {
        let database = Database::in_memory().expect("database should migrate");
        let created = database
            .create_text(text_input("English", "Reader", "One fish. Two fish!"))
            .expect("text should be created");

        let reading = database
            .get_reading_text(created.id)
            .expect("reading text should load");

        assert_eq!(reading.sentences.len(), 2);
        assert_eq!(reading.total_terms, 3);
        assert!(reading.sentences[0]
            .items
            .iter()
            .all(|item| item.status == 0));
        let texts = database.list_texts().expect("library should load");
        assert!(!texts[0].last_opened.is_empty());
    }

    #[test]
    fn shares_term_statuses_by_language_and_can_reset_them() {
        let database = Database::in_memory().expect("database should migrate");
        let first = database
            .create_text(text_input("English", "First", "One fish. Two fish."))
            .expect("first text should be created");
        let second = database
            .create_text(text_input("English", "Second", "Blue fish."))
            .expect("second text should be created");

        let progress = database
            .set_term_status(SetTermStatusInput {
                text_id: first.id,
                normalized: "fish".to_string(),
                status: 5,
            })
            .expect("term should become known");
        let second_reading = database
            .get_reading_text(second.id)
            .expect("second text should load");

        assert_eq!((progress.known_terms, progress.total_terms), (1, 3));
        assert!(second_reading
            .sentences
            .iter()
            .flat_map(|sentence| &sentence.items)
            .any(|item| item.normalized == "fish" && item.status == 5));

        let reset = database
            .set_term_status(SetTermStatusInput {
                text_id: first.id,
                normalized: "fish".to_string(),
                status: 0,
            })
            .expect("term should reset");
        assert_eq!(reset.known_terms, 0);
    }

    #[test]
    fn rejects_status_updates_for_terms_outside_the_text() {
        let database = Database::in_memory().expect("database should migrate");
        let created = database
            .create_text(text_input("English", "Reader", "Existing term."))
            .expect("text should be created");

        let error = database
            .set_term_status(SetTermStatusInput {
                text_id: created.id,
                normalized: "missing".to_string(),
                status: 5,
            })
            .expect_err("missing term should fail");

        assert_eq!(error, "Term was not found in this text");
    }

    #[test]
    fn saves_and_loads_shared_term_details() {
        let database = Database::in_memory().expect("database should migrate");
        let first = database
            .create_text(text_input("Japanese", "First", "日本語です。"))
            .expect("first text should be created");
        let second = database
            .create_text(text_input("Japanese", "Second", "日本語です。"))
            .expect("second text should be created");

        let initial = database
            .get_term_details(first.id, "日本語です".to_string())
            .expect("unsaved term should load");
        let saved = database
            .save_term(SaveTermInput {
                text_id: first.id,
                normalized: "日本語です".to_string(),
                status: 5,
                translation: "It is Japanese".to_string(),
                romanization: "nihongo desu".to_string(),
            })
            .expect("term details should save");
        let shared = database
            .get_term_details(second.id, "日本語です".to_string())
            .expect("shared term should load");

        assert_eq!(initial.status, 0);
        assert_eq!(saved.known_terms, 1);
        assert_eq!(shared.status, 5);
        assert_eq!(shared.translation, "It is Japanese");
        assert_eq!(shared.romanization, "nihongo desu");
    }

    #[test]
    fn validates_term_detail_lengths() {
        let database = Database::in_memory().expect("database should migrate");
        let created = database
            .create_text(text_input("English", "Reader", "Term."))
            .expect("text should be created");

        let error = database
            .save_term(SaveTermInput {
                text_id: created.id,
                normalized: "term".to_string(),
                status: 1,
                translation: "x".repeat(501),
                romanization: String::new(),
            })
            .expect_err("oversized translation should fail");

        assert_eq!(error, "Translation must not exceed 500 characters");
    }

    #[test]
    fn upgrades_existing_terms_to_the_detail_schema_without_data_loss() {
        let mut connection = Connection::open_in_memory().expect("database should open");
        connection
            .execute_batch(INITIAL_MIGRATION)
            .expect("initial schema should apply");
        connection
            .execute_batch(TEXT_PARSING_MIGRATION)
            .expect("parsing schema should apply");
        connection
            .execute_batch(TERMS_MIGRATION)
            .expect("terms schema should apply");
        connection
            .pragma_update(None, "user_version", 3)
            .expect("schema version should set");
        connection
            .execute("INSERT INTO languages (name) VALUES ('English')", [])
            .expect("language should insert");
        connection
            .execute(
                "INSERT INTO terms (language_id, display_text, normalized, status)
                 VALUES (1, 'Term', 'term', 5)",
                [],
            )
            .expect("term should insert");

        Database::configure_and_migrate(&mut connection).expect("database should upgrade");

        let stored: (i64, String, Option<String>) = connection
            .query_row(
                "SELECT status, translation, romanization FROM terms WHERE normalized = 'term'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("upgraded term should load");
        assert_eq!(stored, (5, String::new(), None));
    }

    #[test]
    fn creates_and_reopens_a_compound_expression() {
        let database = Database::in_memory().expect("database should migrate");
        let text = database
            .create_text(text_input(
                "English",
                "Expressions",
                "One small fish swims.",
            ))
            .expect("text should be created");
        let reading = database
            .get_reading_text(text.id)
            .expect("reading should load");
        let sentence_id = reading.sentences[0].id;

        let created = database
            .create_expression(CreateExpressionInput {
                text_id: text.id,
                sentence_id,
                start_position: 1,
                end_position: 5,
            })
            .expect("expression should be created");
        let saved = database
            .save_term(SaveTermInput {
                text_id: text.id,
                normalized: created.term.normalized.clone(),
                status: 5,
                translation: "um peixe pequeno".to_string(),
                romanization: String::new(),
            })
            .expect("expression details should save");
        let reopened = database
            .get_reading_text(text.id)
            .expect("reading should reopen");

        assert_eq!(created.term.normalized, "one small fish");
        assert_eq!(created.term.word_count, 3);
        assert_eq!(saved.term.translation, "um peixe pequeno");
        assert_eq!(reopened.expressions.len(), 1);
        assert_eq!(reopened.expressions[0].start_position, 1);
        assert_eq!(reopened.expressions[0].end_position, 5);
    }

    #[test]
    fn queues_due_terms_and_records_review_history() {
        let database = Database::in_memory().expect("database should migrate");
        let text = database
            .create_text(text_input("English", "Review", "Review term."))
            .expect("text should be created");
        database
            .save_term(SaveTermInput {
                text_id: text.id,
                normalized: "term".to_string(),
                status: 1,
                translation: "termo".to_string(),
                romanization: String::new(),
            })
            .expect("term should save");

        let queue = database
            .list_review_terms(20)
            .expect("review queue should load");
        let outcome = database
            .record_review(RecordReviewInput {
                term_id: queue[0].id,
                rating: 2,
            })
            .expect("review should save");

        assert_eq!(queue.len(), 1);
        assert_eq!(queue[0].translation, "termo");
        assert_eq!(outcome.status, 2);
        assert_eq!(outcome.due_terms, 0);
        let connection = database.connection.lock().expect("database should lock");
        let stored: (i64, i64, i64) = connection
            .query_row(
                "SELECT review_count, correct_count,
                        (SELECT COUNT(*) FROM review_events)
                 FROM terms WHERE id = ?1",
                [queue[0].id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("review counters should load");
        assert_eq!(stored, (1, 1, 1));
        drop(connection);
        let statistics = database
            .review_statistics()
            .expect("review statistics should load");
        assert_eq!(statistics.total_terms, 1);
        assert_eq!(statistics.learning_terms, 1);
        assert_eq!(statistics.reviews_today, 1);
        assert_eq!(statistics.correct_today, 1);
        assert_eq!(statistics.languages[0].reviews, 1);
    }

    #[test]
    fn excludes_ignored_terms_from_review() {
        let database = Database::in_memory().expect("database should migrate");
        let text = database
            .create_text(text_input("English", "Review", "Ignored."))
            .expect("text should be created");
        database
            .save_term(SaveTermInput {
                text_id: text.id,
                normalized: "ignored".to_string(),
                status: 98,
                translation: String::new(),
                romanization: String::new(),
            })
            .expect("term should save");

        assert!(database
            .list_review_terms(20)
            .expect("review queue should load")
            .is_empty());
    }

    #[test]
    fn matches_legacy_score_due_thresholds() {
        assert_eq!(legacy_score(1, 0, false).round(), 0.0);
        assert!(legacy_score(1, 1, false) < 0.0);
        assert!(legacy_score(2, 1, false) > 0.0);
        assert!(legacy_score(2, 2, false) < 0.0);
        assert!(legacy_score(5, 0, false) > 0.0);
        assert_eq!(legacy_score(99, 10_000, false), 100.0);
    }
}
