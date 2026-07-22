use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
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
}
