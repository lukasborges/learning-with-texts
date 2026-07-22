use rusqlite::{params, Connection, OpenFlags, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

const INITIAL_MIGRATION: &str = include_str!("../migrations/0001_initial.sql");
const INITIAL_SCHEMA_VERSION: i64 = 1;

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

        if current_version < INITIAL_SCHEMA_VERSION {
            let transaction = connection
                .transaction()
                .map_err(|error| format!("Unable to start the schema migration: {error}"))?;

            transaction
                .execute_batch(INITIAL_MIGRATION)
                .map_err(|error| format!("Unable to apply the initial schema: {error}"))?;
            transaction
                .pragma_update(None, "user_version", INITIAL_SCHEMA_VERSION)
                .map_err(|error| format!("Unable to record the schema version: {error}"))?;
            transaction
                .commit()
                .map_err(|error| format!("Unable to commit the schema migration: {error}"))?;
        }

        Ok(())
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
                        0 AS known_terms,
                        0 AS total_terms,
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

        transaction
            .commit()
            .map_err(|error| format!("Unable to save the text: {error}"))?;

        Ok(LibraryText {
            id,
            title: input.title,
            language: stored_language,
            known_terms: 0,
            total_terms: 0,
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
                        0 AS known_terms,
                        0 AS total_terms,
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

        transaction
            .commit()
            .map_err(|error| format!("Unable to save the text update: {error}"))?;

        Ok(LibraryText {
            id,
            title: input.title,
            language: stored_language,
            known_terms: 0,
            total_terms: 0,
            last_opened: String::new(),
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
        assert_eq!(version, INITIAL_SCHEMA_VERSION);
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
    }
}
