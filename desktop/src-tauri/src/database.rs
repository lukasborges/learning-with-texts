use crate::parser::{parse_text_with_config, ParserConfig};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::path::Path;
use std::sync::Mutex;

const INITIAL_MIGRATION: &str = include_str!("../migrations/0001_initial.sql");
const TEXT_PARSING_MIGRATION: &str = include_str!("../migrations/0002_text_parsing.sql");
const TERMS_MIGRATION: &str = include_str!("../migrations/0003_terms.sql");
const TERM_DETAILS_MIGRATION: &str = include_str!("../migrations/0004_term_details.sql");
const EXPRESSIONS_MIGRATION: &str = include_str!("../migrations/0005_expressions.sql");
const REVIEWS_MIGRATION: &str = include_str!("../migrations/0006_reviews.sql");
const TAGS_MIGRATION: &str = include_str!("../migrations/0007_tags.sql");
const ARCHIVED_TEXTS_MIGRATION: &str = include_str!("../migrations/0008_archived_texts.sql");
const TEXT_AUDIO_MIGRATION: &str = include_str!("../migrations/0009_text_audio.sql");
const LATEST_SCHEMA_VERSION: i64 = 9;
const MIGRATIONS: [(i64, &str); 9] = [
    (1, INITIAL_MIGRATION),
    (2, TEXT_PARSING_MIGRATION),
    (3, TERMS_MIGRATION),
    (4, TERM_DETAILS_MIGRATION),
    (5, EXPRESSIONS_MIGRATION),
    (6, REVIEWS_MIGRATION),
    (7, TAGS_MIGRATION),
    (8, ARCHIVED_TEXTS_MIGRATION),
    (LATEST_SCHEMA_VERSION, TEXT_AUDIO_MIGRATION),
];

const MAX_AUDIO_BYTES: usize = 50_000_000;

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryText {
    pub id: i64,
    pub title: String,
    pub language: String,
    pub known_terms: i64,
    pub total_terms: i64,
    pub last_opened: String,
    pub archived: bool,
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
    pub archived: bool,
    pub has_audio: bool,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetTextArchivedInput {
    pub id: i64,
    pub archived: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTextAudioInput {
    pub text_id: i64,
    pub file_name: String,
    pub media_type: String,
    pub data_base64: String,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextAudio {
    pub file_name: String,
    pub media_type: String,
    pub data_base64: String,
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
    pub remove_spaces: bool,
    pub right_to_left: bool,
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

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageSettings {
    pub id: i64,
    pub name: String,
    pub character_substitutions: String,
    pub sentence_terminators: String,
    pub split_each_character: bool,
    pub remove_spaces: bool,
    pub right_to_left: bool,
    pub text_count: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLanguageInput {
    pub id: i64,
    pub character_substitutions: String,
    pub sentence_terminators: String,
    pub split_each_character: bool,
    pub remove_spaces: bool,
    pub right_to_left: bool,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub comment: String,
    pub term_count: i64,
    pub text_count: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTagInput {
    pub name: String,
    pub comment: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetTextTagsInput {
    pub text_id: i64,
    pub tag_ids: Vec<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetTermTagsInput {
    pub text_id: i64,
    pub normalized: String,
    pub tag_ids: Vec<i64>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSummary {
    pub languages: usize,
    pub texts: usize,
    pub archived_texts: usize,
    pub media: usize,
    pub terms: usize,
    pub tags: usize,
    pub expressions: usize,
    pub reviews: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PortableBackup {
    format: String,
    version: u32,
    exported_at: String,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    warnings: Vec<String>,
    languages: Vec<BackupLanguage>,
    texts: Vec<BackupText>,
    #[serde(default)]
    media: Vec<BackupMedia>,
    terms: Vec<BackupTerm>,
    #[serde(default)]
    tags: Vec<BackupTag>,
    #[serde(default)]
    term_tags: Vec<BackupTermTag>,
    #[serde(default)]
    text_tags: Vec<BackupTextTag>,
    expressions: Vec<BackupExpression>,
    reviews: Vec<BackupReview>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupLanguage {
    id: i64,
    name: String,
    dictionary_uri_1: String,
    dictionary_uri_2: Option<String>,
    google_translate_uri: Option<String>,
    export_template: Option<String>,
    text_size: i64,
    character_substitutions: String,
    regexp_split_sentences: String,
    exceptions_split_sentences: String,
    regexp_word_characters: String,
    remove_spaces: bool,
    split_each_character: bool,
    right_to_left: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupText {
    id: i64,
    language_id: i64,
    title: String,
    content: String,
    annotated_content: String,
    audio_uri: Option<String>,
    source_uri: Option<String>,
    last_opened_at: Option<String>,
    created_at: String,
    updated_at: String,
    #[serde(default)]
    archived: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupMedia {
    text_id: i64,
    file_name: String,
    media_type: String,
    data_base64: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupTerm {
    id: i64,
    language_id: i64,
    display_text: String,
    normalized: String,
    status: i64,
    created_at: String,
    updated_at: String,
    translation: String,
    romanization: Option<String>,
    word_count: i64,
    last_reviewed_at: Option<String>,
    next_review_at: Option<String>,
    review_count: i64,
    correct_count: i64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupTag {
    id: i64,
    name: String,
    comment: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupTermTag {
    term_id: i64,
    tag_id: i64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupTextTag {
    text_id: i64,
    tag_id: i64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupExpression {
    id: i64,
    term_id: i64,
    text_id: i64,
    sentence_position: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    start_position: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    end_position: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    start_word: Option<i64>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupReview {
    id: i64,
    term_id: i64,
    rating: i64,
    status_before: i64,
    status_after: i64,
    reviewed_at: String,
    next_review_at: String,
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

fn validate_audio(
    file_name: String,
    media_type: String,
    data_base64: String,
) -> Result<(String, String, Vec<u8>), String> {
    let file_name = file_name.trim().to_string();
    let media_type = media_type.trim().to_ascii_lowercase();
    if file_name.is_empty()
        || file_name.chars().count() > 255
        || file_name.contains(['/', '\\', '\0'])
    {
        return Err("Audio file name is invalid".to_string());
    }
    if !matches!(
        media_type.as_str(),
        "audio/mpeg"
            | "audio/mp4"
            | "audio/ogg"
            | "audio/wav"
            | "audio/x-wav"
            | "audio/webm"
            | "audio/flac"
    ) {
        return Err("Audio type is not supported".to_string());
    }
    let content = BASE64
        .decode(data_base64)
        .map_err(|_| "Audio data is not valid base64".to_string())?;
    if content.is_empty() || content.len() > MAX_AUDIO_BYTES {
        return Err("Audio must be between 1 byte and 50 MB".to_string());
    }
    Ok((file_name, media_type, content))
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

fn parse_character_substitutions(value: &str) -> Result<Vec<(String, String)>, String> {
    value
        .split('|')
        .filter(|entry| !entry.trim().is_empty())
        .map(|entry| {
            let (from, to) = entry
                .split_once('=')
                .ok_or_else(|| "Character substitutions must use from=to pairs".to_string())?;
            let from = from.trim();
            let to = to.trim();
            if from.is_empty() {
                return Err("Character substitution sources must not be empty".to_string());
            }
            Ok((from.to_string(), to.to_string()))
        })
        .collect()
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
            let config = Self::parser_config(transaction, language_id)?;
            Self::persist_text_parsing(transaction, text_id, language_id, &content, &config)?;
        }
        Ok(())
    }

    fn parser_config(
        transaction: &Transaction<'_>,
        language_id: i64,
    ) -> Result<ParserConfig, String> {
        let values = transaction
            .query_row(
                "SELECT character_substitutions,
                        regexp_split_sentences,
                        split_each_character
                 FROM languages WHERE id = ?1",
                [language_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, bool>(2)?,
                    ))
                },
            )
            .optional()
            .map_err(|error| format!("Unable to load language parsing settings: {error}"))?
            .ok_or_else(|| "Language was not found".to_string())?;
        Ok(ParserConfig {
            character_substitutions: parse_character_substitutions(&values.0)?,
            sentence_terminators: values.1,
            split_each_character: values.2,
        })
    }

    fn persist_text_parsing(
        transaction: &Transaction<'_>,
        text_id: i64,
        language_id: i64,
        content: &str,
        config: &ParserConfig,
    ) -> Result<(), String> {
        transaction
            .execute("DELETE FROM sentences WHERE text_id = ?1", [text_id])
            .map_err(|error| format!("Unable to clear the previous text analysis: {error}"))?;

        for (sentence_index, sentence) in parse_text_with_config(content, config)
            .into_iter()
            .enumerate()
        {
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

    fn locate_restored_expression(
        transaction: &Transaction<'_>,
        sentence_id: i64,
        term_id: i64,
        start_word: i64,
    ) -> Result<(i64, i64), String> {
        if start_word <= 0 {
            return Err("Expression word position is invalid".to_string());
        }
        let (word_count, normalized) = transaction
            .query_row(
                "SELECT word_count, normalized FROM terms WHERE id = ?1",
                [term_id],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
            )
            .map_err(|error| format!("Unable to load the expression term: {error}"))?;
        let positions = {
            let mut statement = transaction
                .prepare(
                    "SELECT position, normalized FROM text_items
                     WHERE sentence_id = ?1 AND is_word = 1
                     ORDER BY position",
                )
                .map_err(|error| format!("Unable to prepare expression words: {error}"))?;
            let rows = statement
                .query_map([sentence_id], |row| {
                    Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
                })
                .map_err(|error| format!("Unable to load expression words: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode expression words: {error}"))?
        };
        let start_index = usize::try_from(start_word - 1)
            .map_err(|_| "Expression word position is invalid".to_string())?;
        let word_count = usize::try_from(word_count)
            .map_err(|_| "Expression word count is invalid".to_string())?;
        let end_index = start_index
            .checked_add(word_count.saturating_sub(1))
            .ok_or_else(|| "Expression word range is invalid".to_string())?;
        let start_position = positions
            .get(start_index)
            .map(|item| item.0)
            .ok_or_else(|| "Expression starts outside the parsed sentence".to_string())?;
        let end_position = positions
            .get(end_index)
            .map(|item| item.0)
            .ok_or_else(|| "Expression ends outside the parsed sentence".to_string())?;
        let parsed_signature = positions[start_index..=end_index]
            .iter()
            .map(|item| item.1.as_str())
            .collect::<String>();
        let term_signature = normalized
            .chars()
            .filter(|character| !character.is_whitespace())
            .collect::<String>();
        if parsed_signature != term_signature {
            return Err("Expression terms do not match the parsed sentence".to_string());
        }
        Ok((start_position, end_position))
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

    fn validate_tag_ids(
        transaction: &Transaction<'_>,
        tag_ids: Vec<i64>,
    ) -> Result<BTreeSet<i64>, String> {
        if tag_ids.len() > 100 {
            return Err("No more than 100 tags can be assigned at once".to_string());
        }
        let tag_ids: BTreeSet<i64> = tag_ids.into_iter().collect();
        for tag_id in &tag_ids {
            if *tag_id <= 0 {
                return Err("Tag selection is invalid".to_string());
            }
            let exists = transaction
                .query_row("SELECT 1 FROM tags WHERE id = ?1", [tag_id], |_| Ok(()))
                .optional()
                .map_err(|error| format!("Unable to validate a selected tag: {error}"))?
                .is_some();
            if !exists {
                return Err("A selected tag was not found".to_string());
            }
        }
        Ok(tag_ids)
    }

    pub fn list_tags(&self) -> Result<Vec<Tag>, String> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let mut statement = connection
            .prepare(
                "SELECT tags.id,
                        tags.name,
                        tags.comment,
                        (SELECT COUNT(*) FROM term_tags WHERE term_tags.tag_id = tags.id),
                        (SELECT COUNT(*) FROM text_tags WHERE text_tags.tag_id = tags.id)
                 FROM tags ORDER BY tags.name COLLATE NOCASE",
            )
            .map_err(|error| format!("Unable to prepare tags: {error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok(Tag {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    comment: row.get(2)?,
                    term_count: row.get(3)?,
                    text_count: row.get(4)?,
                })
            })
            .map_err(|error| format!("Unable to load tags: {error}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Unable to decode tags: {error}"))
    }

    pub fn create_tag(&self, input: CreateTagInput) -> Result<Tag, String> {
        let name = input.name.trim();
        let comment = input.comment.trim();
        if name.is_empty() {
            return Err("Tag name is required".to_string());
        }
        if name.chars().count() > 20 {
            return Err("Tag name must not exceed 20 characters".to_string());
        }
        if comment.chars().count() > 200 {
            return Err("Tag comment must not exceed 200 characters".to_string());
        }
        let connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        connection
            .execute(
                "INSERT INTO tags (name, comment) VALUES (?1, ?2)",
                params![name, comment],
            )
            .map_err(|error| format!("Unable to create the tag: {error}"))?;
        Ok(Tag {
            id: connection.last_insert_rowid(),
            name: name.to_string(),
            comment: comment.to_string(),
            term_count: 0,
            text_count: 0,
        })
    }

    pub fn list_text_tag_ids(&self, text_id: i64) -> Result<Vec<i64>, String> {
        if text_id <= 0 {
            return Err("Text was not found".to_string());
        }
        let connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let exists = connection
            .query_row("SELECT 1 FROM texts WHERE id = ?1", [text_id], |_| Ok(()))
            .optional()
            .map_err(|error| format!("Unable to load the tagged text: {error}"))?
            .is_some();
        if !exists {
            return Err("Text was not found".to_string());
        }
        let mut statement = connection
            .prepare("SELECT tag_id FROM text_tags WHERE text_id = ?1 ORDER BY tag_id")
            .map_err(|error| format!("Unable to prepare text tags: {error}"))?;
        let rows = statement
            .query_map([text_id], |row| row.get(0))
            .map_err(|error| format!("Unable to load text tags: {error}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Unable to decode text tags: {error}"))
    }

    pub fn set_text_tags(&self, input: SetTextTagsInput) -> Result<Vec<i64>, String> {
        if input.text_id <= 0 {
            return Err("Text was not found".to_string());
        }
        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Unable to start the text tag update: {error}"))?;
        let exists = transaction
            .query_row("SELECT 1 FROM texts WHERE id = ?1", [input.text_id], |_| {
                Ok(())
            })
            .optional()
            .map_err(|error| format!("Unable to load the tagged text: {error}"))?
            .is_some();
        if !exists {
            return Err("Text was not found".to_string());
        }
        let tag_ids = Self::validate_tag_ids(&transaction, input.tag_ids)?;
        transaction
            .execute("DELETE FROM text_tags WHERE text_id = ?1", [input.text_id])
            .map_err(|error| format!("Unable to clear text tags: {error}"))?;
        for tag_id in &tag_ids {
            transaction
                .execute(
                    "INSERT INTO text_tags (text_id, tag_id) VALUES (?1, ?2)",
                    params![input.text_id, tag_id],
                )
                .map_err(|error| format!("Unable to assign a text tag: {error}"))?;
        }
        transaction
            .commit()
            .map_err(|error| format!("Unable to save text tags: {error}"))?;
        Ok(tag_ids.into_iter().collect())
    }

    pub fn list_term_tag_ids(&self, text_id: i64, normalized: String) -> Result<Vec<i64>, String> {
        if text_id <= 0 {
            return Err("Text was not found".to_string());
        }
        let normalized = normalized.trim();
        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Unable to inspect the tagged term: {error}"))?;
        let (language_id, _, _) = Self::find_text_term(&transaction, text_id, normalized)?;
        let term_id = transaction
            .query_row(
                "SELECT id FROM terms WHERE language_id = ?1 AND normalized = ?2",
                params![language_id, normalized],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| format!("Unable to load the tagged term: {error}"))?;
        let Some(term_id) = term_id else {
            return Ok(Vec::new());
        };
        let tag_ids = {
            let mut statement = transaction
                .prepare("SELECT tag_id FROM term_tags WHERE term_id = ?1 ORDER BY tag_id")
                .map_err(|error| format!("Unable to prepare term tags: {error}"))?;
            let rows = statement
                .query_map([term_id], |row| row.get(0))
                .map_err(|error| format!("Unable to load term tags: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode term tags: {error}"))?
        };
        transaction
            .commit()
            .map_err(|error| format!("Unable to finish reading term tags: {error}"))?;
        Ok(tag_ids)
    }

    pub fn set_term_tags(&self, input: SetTermTagsInput) -> Result<Vec<i64>, String> {
        if input.text_id <= 0 {
            return Err("Text was not found".to_string());
        }
        let normalized = input.normalized.trim();
        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Unable to start the term tag update: {error}"))?;
        let (language_id, _, _) = Self::find_text_term(&transaction, input.text_id, normalized)?;
        let term_id = transaction
            .query_row(
                "SELECT id FROM terms WHERE language_id = ?1 AND normalized = ?2",
                params![language_id, normalized],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| format!("Unable to load the tagged term: {error}"))?
            .ok_or_else(|| "Save the term before assigning tags".to_string())?;
        let tag_ids = Self::validate_tag_ids(&transaction, input.tag_ids)?;
        transaction
            .execute("DELETE FROM term_tags WHERE term_id = ?1", [term_id])
            .map_err(|error| format!("Unable to clear term tags: {error}"))?;
        for tag_id in &tag_ids {
            transaction
                .execute(
                    "INSERT INTO term_tags (term_id, tag_id) VALUES (?1, ?2)",
                    params![term_id, tag_id],
                )
                .map_err(|error| format!("Unable to assign a term tag: {error}"))?;
        }
        transaction
            .commit()
            .map_err(|error| format!("Unable to save term tags: {error}"))?;
        Ok(tag_ids.into_iter().collect())
    }

    fn portable_backup(connection: &Connection) -> Result<PortableBackup, String> {
        let exported_at = connection
            .query_row("SELECT CURRENT_TIMESTAMP", [], |row| row.get(0))
            .map_err(|error| format!("Unable to timestamp the backup: {error}"))?;
        let languages = {
            let mut statement = connection
                .prepare(
                    "SELECT id, name, dictionary_uri_1, dictionary_uri_2,
                            google_translate_uri, export_template, text_size,
                            character_substitutions, regexp_split_sentences,
                            exceptions_split_sentences, regexp_word_characters,
                            remove_spaces, split_each_character, right_to_left
                     FROM languages ORDER BY id",
                )
                .map_err(|error| format!("Unable to prepare backup languages: {error}"))?;
            let rows = statement
                .query_map([], |row| {
                    Ok(BackupLanguage {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        dictionary_uri_1: row.get(2)?,
                        dictionary_uri_2: row.get(3)?,
                        google_translate_uri: row.get(4)?,
                        export_template: row.get(5)?,
                        text_size: row.get(6)?,
                        character_substitutions: row.get(7)?,
                        regexp_split_sentences: row.get(8)?,
                        exceptions_split_sentences: row.get(9)?,
                        regexp_word_characters: row.get(10)?,
                        remove_spaces: row.get(11)?,
                        split_each_character: row.get(12)?,
                        right_to_left: row.get(13)?,
                    })
                })
                .map_err(|error| format!("Unable to read backup languages: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode backup languages: {error}"))?
        };
        let texts = {
            let mut statement = connection
                .prepare(
                    "SELECT id, language_id, title, content, annotated_content,
                            audio_uri, source_uri, last_opened_at, created_at, updated_at,
                            archived
                     FROM texts ORDER BY id",
                )
                .map_err(|error| format!("Unable to prepare backup texts: {error}"))?;
            let rows = statement
                .query_map([], |row| {
                    Ok(BackupText {
                        id: row.get(0)?,
                        language_id: row.get(1)?,
                        title: row.get(2)?,
                        content: row.get(3)?,
                        annotated_content: row.get(4)?,
                        audio_uri: row.get(5)?,
                        source_uri: row.get(6)?,
                        last_opened_at: row.get(7)?,
                        created_at: row.get(8)?,
                        updated_at: row.get(9)?,
                        archived: row.get(10)?,
                    })
                })
                .map_err(|error| format!("Unable to read backup texts: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode backup texts: {error}"))?
        };
        let media = {
            let mut statement = connection
                .prepare(
                    "SELECT text_id, file_name, media_type, content
                     FROM text_audio ORDER BY text_id",
                )
                .map_err(|error| format!("Unable to prepare backup media: {error}"))?;
            let rows = statement
                .query_map([], |row| {
                    Ok(BackupMedia {
                        text_id: row.get(0)?,
                        file_name: row.get(1)?,
                        media_type: row.get(2)?,
                        data_base64: BASE64.encode(row.get::<_, Vec<u8>>(3)?),
                    })
                })
                .map_err(|error| format!("Unable to read backup media: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode backup media: {error}"))?
        };
        let terms = {
            let mut statement = connection
                .prepare(
                    "SELECT id, language_id, display_text, normalized, status,
                            created_at, updated_at, translation, romanization,
                            word_count, last_reviewed_at, next_review_at,
                            review_count, correct_count
                     FROM terms ORDER BY id",
                )
                .map_err(|error| format!("Unable to prepare backup terms: {error}"))?;
            let rows = statement
                .query_map([], |row| {
                    Ok(BackupTerm {
                        id: row.get(0)?,
                        language_id: row.get(1)?,
                        display_text: row.get(2)?,
                        normalized: row.get(3)?,
                        status: row.get(4)?,
                        created_at: row.get(5)?,
                        updated_at: row.get(6)?,
                        translation: row.get(7)?,
                        romanization: row.get(8)?,
                        word_count: row.get(9)?,
                        last_reviewed_at: row.get(10)?,
                        next_review_at: row.get(11)?,
                        review_count: row.get(12)?,
                        correct_count: row.get(13)?,
                    })
                })
                .map_err(|error| format!("Unable to read backup terms: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode backup terms: {error}"))?
        };
        let tags = {
            let mut statement = connection
                .prepare("SELECT id, name, comment FROM tags ORDER BY id")
                .map_err(|error| format!("Unable to prepare backup tags: {error}"))?;
            let rows = statement
                .query_map([], |row| {
                    Ok(BackupTag {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        comment: row.get(2)?,
                    })
                })
                .map_err(|error| format!("Unable to read backup tags: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode backup tags: {error}"))?
        };
        let term_tags = {
            let mut statement = connection
                .prepare("SELECT term_id, tag_id FROM term_tags ORDER BY term_id, tag_id")
                .map_err(|error| format!("Unable to prepare backup term tags: {error}"))?;
            let rows = statement
                .query_map([], |row| {
                    Ok(BackupTermTag {
                        term_id: row.get(0)?,
                        tag_id: row.get(1)?,
                    })
                })
                .map_err(|error| format!("Unable to read backup term tags: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode backup term tags: {error}"))?
        };
        let text_tags = {
            let mut statement = connection
                .prepare("SELECT text_id, tag_id FROM text_tags ORDER BY text_id, tag_id")
                .map_err(|error| format!("Unable to prepare backup text tags: {error}"))?;
            let rows = statement
                .query_map([], |row| {
                    Ok(BackupTextTag {
                        text_id: row.get(0)?,
                        tag_id: row.get(1)?,
                    })
                })
                .map_err(|error| format!("Unable to read backup text tags: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode backup text tags: {error}"))?
        };
        let expressions = {
            let mut statement = connection
                .prepare(
                    "SELECT expression_occurrences.id,
                            expression_occurrences.term_id,
                            expression_occurrences.text_id,
                            sentences.position,
                            expression_occurrences.start_position,
                            expression_occurrences.end_position
                     FROM expression_occurrences
                     INNER JOIN sentences ON sentences.id = expression_occurrences.sentence_id
                     ORDER BY expression_occurrences.id",
                )
                .map_err(|error| format!("Unable to prepare backup expressions: {error}"))?;
            let rows = statement
                .query_map([], |row| {
                    Ok(BackupExpression {
                        id: row.get(0)?,
                        term_id: row.get(1)?,
                        text_id: row.get(2)?,
                        sentence_position: row.get(3)?,
                        start_position: Some(row.get(4)?),
                        end_position: Some(row.get(5)?),
                        start_word: None,
                    })
                })
                .map_err(|error| format!("Unable to read backup expressions: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode backup expressions: {error}"))?
        };
        let reviews = {
            let mut statement = connection
                .prepare(
                    "SELECT id, term_id, rating, status_before, status_after,
                            reviewed_at, next_review_at
                     FROM review_events ORDER BY id",
                )
                .map_err(|error| format!("Unable to prepare backup reviews: {error}"))?;
            let rows = statement
                .query_map([], |row| {
                    Ok(BackupReview {
                        id: row.get(0)?,
                        term_id: row.get(1)?,
                        rating: row.get(2)?,
                        status_before: row.get(3)?,
                        status_after: row.get(4)?,
                        reviewed_at: row.get(5)?,
                        next_review_at: row.get(6)?,
                    })
                })
                .map_err(|error| format!("Unable to read backup reviews: {error}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Unable to decode backup reviews: {error}"))?
        };
        Ok(PortableBackup {
            format: "lwt-desktop-backup".into(),
            version: 1,
            exported_at,
            source: Some("lwt-desktop".into()),
            warnings: Vec::new(),
            languages,
            texts,
            media,
            terms,
            tags,
            term_tags,
            text_tags,
            expressions,
            reviews,
        })
    }

    pub fn export_backup(&self) -> Result<String, String> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let backup = Self::portable_backup(&connection)?;
        serde_json::to_string_pretty(&backup)
            .map_err(|error| format!("Unable to encode the portable backup: {error}"))
    }

    pub fn restore_backup(&self, payload: String) -> Result<BackupSummary, String> {
        if payload.is_empty() || payload.len() > 200_000_000 {
            return Err("Backup must be between 1 byte and 200 MB".to_string());
        }
        let backup: PortableBackup = serde_json::from_str(&payload)
            .map_err(|error| format!("Backup JSON is invalid: {error}"))?;
        if backup.format != "lwt-desktop-backup" {
            return Err("This is not an LWT desktop backup".to_string());
        }
        if backup.version != 1 {
            return Err(format!(
                "Backup version {} is not supported",
                backup.version
            ));
        }
        let mut summary = BackupSummary {
            languages: backup.languages.len(),
            texts: backup.texts.len(),
            archived_texts: backup.texts.iter().filter(|text| text.archived).count(),
            media: backup.media.len(),
            terms: backup.terms.len(),
            tags: backup.tags.len(),
            expressions: 0,
            reviews: backup.reviews.len(),
            warnings: backup.warnings.clone(),
        };

        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Unable to start backup restoration: {error}"))?;
        transaction
            .execute_batch(
                "DELETE FROM review_events;
                 DELETE FROM expression_occurrences;
                 DELETE FROM terms;
                 DELETE FROM sentences;
                 DELETE FROM texts;
                 DELETE FROM languages;
                 DELETE FROM tags;",
            )
            .map_err(|error| format!("Unable to clear current library data: {error}"))?;

        for language in backup.languages {
            transaction
                .execute(
                    "INSERT INTO languages
                        (id, name, dictionary_uri_1, dictionary_uri_2,
                         google_translate_uri, export_template, text_size,
                         character_substitutions, regexp_split_sentences,
                         exceptions_split_sentences, regexp_word_characters,
                         remove_spaces, split_each_character, right_to_left)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                    params![
                        language.id,
                        language.name,
                        language.dictionary_uri_1,
                        language.dictionary_uri_2,
                        language.google_translate_uri,
                        language.export_template,
                        language.text_size,
                        language.character_substitutions,
                        language.regexp_split_sentences,
                        language.exceptions_split_sentences,
                        language.regexp_word_characters,
                        language.remove_spaces,
                        language.split_each_character,
                        language.right_to_left
                    ],
                )
                .map_err(|error| format!("Unable to restore a language: {error}"))?;
        }
        for tag in backup.tags {
            transaction
                .execute(
                    "INSERT INTO tags (id, name, comment) VALUES (?1, ?2, ?3)",
                    params![tag.id, tag.name, tag.comment],
                )
                .map_err(|error| format!("Unable to restore a tag: {error}"))?;
        }
        for text in &backup.texts {
            transaction
                .execute(
                    "INSERT INTO texts
                        (id, language_id, title, content, annotated_content, audio_uri,
                         source_uri, last_opened_at, created_at, updated_at, archived)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                    params![
                        text.id,
                        text.language_id,
                        text.title,
                        text.content,
                        text.annotated_content,
                        text.audio_uri,
                        text.source_uri,
                        text.last_opened_at,
                        text.created_at,
                        text.updated_at,
                        text.archived
                    ],
                )
                .map_err(|error| format!("Unable to restore a text: {error}"))?;
            let config = Self::parser_config(&transaction, text.language_id)?;
            Self::persist_text_parsing(
                &transaction,
                text.id,
                text.language_id,
                &text.content,
                &config,
            )?;
        }
        for media in backup.media {
            let (file_name, media_type, content) =
                validate_audio(media.file_name, media.media_type, media.data_base64)?;
            transaction
                .execute(
                    "INSERT INTO text_audio (text_id, file_name, media_type, content)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![media.text_id, file_name, media_type, content],
                )
                .map_err(|error| format!("Unable to restore text audio: {error}"))?;
        }
        for term in backup.terms {
            transaction
                .execute(
                    "INSERT INTO terms
                        (id, language_id, display_text, normalized, status,
                         created_at, updated_at, translation, romanization, word_count,
                         last_reviewed_at, next_review_at, review_count, correct_count)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                    params![
                        term.id,
                        term.language_id,
                        term.display_text,
                        term.normalized,
                        term.status,
                        term.created_at,
                        term.updated_at,
                        term.translation,
                        term.romanization,
                        term.word_count,
                        term.last_reviewed_at,
                        term.next_review_at,
                        term.review_count,
                        term.correct_count
                    ],
                )
                .map_err(|error| format!("Unable to restore a term: {error}"))?;
        }
        for assignment in backup.term_tags {
            transaction
                .execute(
                    "INSERT INTO term_tags (term_id, tag_id) VALUES (?1, ?2)",
                    params![assignment.term_id, assignment.tag_id],
                )
                .map_err(|error| format!("Unable to restore a term tag: {error}"))?;
        }
        for assignment in backup.text_tags {
            transaction
                .execute(
                    "INSERT INTO text_tags (text_id, tag_id) VALUES (?1, ?2)",
                    params![assignment.text_id, assignment.tag_id],
                )
                .map_err(|error| format!("Unable to restore a text tag: {error}"))?;
        }
        let mut skipped_located_expressions = 0;
        for expression in backup.expressions {
            let sentence_id = transaction
                .query_row(
                    "SELECT id FROM sentences WHERE text_id = ?1 AND position = ?2",
                    params![expression.text_id, expression.sentence_position],
                    |row| row.get::<_, i64>(0),
                )
                .optional()
                .map_err(|error| format!("Unable to match a restored expression: {error}"))?;
            let Some(sentence_id) = sentence_id else {
                if expression.start_word.is_some() {
                    skipped_located_expressions += 1;
                    continue;
                }
                return Err("A restored expression references a missing sentence".to_string());
            };
            let positions = if let Some(start_word) = expression.start_word {
                match Self::locate_restored_expression(
                    &transaction,
                    sentence_id,
                    expression.term_id,
                    start_word,
                ) {
                    Ok(positions) => positions,
                    Err(_) => {
                        skipped_located_expressions += 1;
                        continue;
                    }
                }
            } else {
                (
                    expression.start_position.ok_or_else(|| {
                        "A restored expression is missing its start position".to_string()
                    })?,
                    expression.end_position.ok_or_else(|| {
                        "A restored expression is missing its end position".to_string()
                    })?,
                )
            };
            transaction
                .execute(
                    "INSERT INTO expression_occurrences
                        (id, term_id, text_id, sentence_id, start_position, end_position)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        expression.id,
                        expression.term_id,
                        expression.text_id,
                        sentence_id,
                        positions.0,
                        positions.1
                    ],
                )
                .map_err(|error| format!("Unable to restore an expression: {error}"))?;
            summary.expressions += 1;
        }
        if skipped_located_expressions > 0 {
            summary.warnings.push(format!(
                "{skipped_located_expressions} legacy compound expression occurrence(s) could not be matched to the desktop parser and were skipped."
            ));
        }
        for review in backup.reviews {
            transaction
                .execute(
                    "INSERT INTO review_events
                        (id, term_id, rating, status_before, status_after,
                         reviewed_at, next_review_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        review.id,
                        review.term_id,
                        review.rating,
                        review.status_before,
                        review.status_after,
                        review.reviewed_at,
                        review.next_review_at
                    ],
                )
                .map_err(|error| format!("Unable to restore a review event: {error}"))?;
        }
        let has_foreign_key_error = {
            let mut statement = transaction
                .prepare("PRAGMA foreign_key_check")
                .map_err(|error| format!("Unable to validate restored relationships: {error}"))?;
            let mut rows = statement
                .query([])
                .map_err(|error| format!("Unable to check restored relationships: {error}"))?;
            rows.next()
                .map_err(|error| format!("Unable to read restored relationships: {error}"))?
                .is_some()
        };
        if has_foreign_key_error {
            return Err("Backup contains invalid relationships".to_string());
        }
        transaction
            .commit()
            .map_err(|error| format!("Unable to commit backup restoration: {error}"))?;
        Ok(summary)
    }

    pub fn list_languages(&self) -> Result<Vec<LanguageSettings>, String> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let mut statement = connection
            .prepare(
                "SELECT languages.id,
                        languages.name,
                        languages.character_substitutions,
                        languages.regexp_split_sentences,
                        languages.split_each_character,
                        languages.remove_spaces,
                        languages.right_to_left,
                        COUNT(texts.id)
                 FROM languages
                 LEFT JOIN texts ON texts.language_id = languages.id AND texts.archived = 0
                 GROUP BY languages.id
                 ORDER BY languages.name COLLATE NOCASE",
            )
            .map_err(|error| format!("Unable to prepare language settings: {error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok(LanguageSettings {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    character_substitutions: row.get(2)?,
                    sentence_terminators: row.get(3)?,
                    split_each_character: row.get(4)?,
                    remove_spaces: row.get(5)?,
                    right_to_left: row.get(6)?,
                    text_count: row.get(7)?,
                })
            })
            .map_err(|error| format!("Unable to load language settings: {error}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Unable to decode language settings: {error}"))
    }

    pub fn update_language(&self, input: UpdateLanguageInput) -> Result<LanguageSettings, String> {
        if input.id <= 0 {
            return Err("Language was not found".to_string());
        }
        let character_substitutions = input.character_substitutions.trim().to_string();
        let sentence_terminators = input.sentence_terminators.trim().to_string();
        if character_substitutions.chars().count() > 500 {
            return Err("Character substitutions must not exceed 500 characters".to_string());
        }
        if sentence_terminators.chars().count() > 500 {
            return Err("Sentence terminators must not exceed 500 characters".to_string());
        }
        parse_character_substitutions(&character_substitutions)?;

        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Unable to start the language update: {error}"))?;
        let previous = transaction
            .query_row(
                "SELECT character_substitutions,
                        regexp_split_sentences,
                        split_each_character
                 FROM languages WHERE id = ?1",
                [input.id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, bool>(2)?,
                    ))
                },
            )
            .optional()
            .map_err(|error| format!("Unable to load the language: {error}"))?
            .ok_or_else(|| "Language was not found".to_string())?;

        transaction
            .execute(
                "UPDATE languages
                 SET character_substitutions = ?1,
                     regexp_split_sentences = ?2,
                     split_each_character = ?3,
                     remove_spaces = ?4,
                     right_to_left = ?5
                 WHERE id = ?6",
                params![
                    character_substitutions,
                    sentence_terminators,
                    input.split_each_character,
                    input.remove_spaces,
                    input.right_to_left,
                    input.id
                ],
            )
            .map_err(|error| format!("Unable to update the language: {error}"))?;

        let parsing_changed = previous
            != (
                character_substitutions.clone(),
                sentence_terminators.clone(),
                input.split_each_character,
            );
        if parsing_changed {
            let texts = {
                let mut statement = transaction
                    .prepare("SELECT id, content FROM texts WHERE language_id = ?1 ORDER BY id")
                    .map_err(|error| format!("Unable to prepare texts for reparsing: {error}"))?;
                let rows = statement
                    .query_map([input.id], |row| {
                        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
                    })
                    .map_err(|error| format!("Unable to load texts for reparsing: {error}"))?;
                rows.collect::<Result<Vec<_>, _>>()
                    .map_err(|error| format!("Unable to decode texts for reparsing: {error}"))?
            };
            let config = Self::parser_config(&transaction, input.id)?;
            for (text_id, content) in texts {
                Self::persist_text_parsing(&transaction, text_id, input.id, &content, &config)?;
            }
        }

        let saved = transaction
            .query_row(
                "SELECT languages.id,
                        languages.name,
                        languages.character_substitutions,
                        languages.regexp_split_sentences,
                        languages.split_each_character,
                        languages.remove_spaces,
                        languages.right_to_left,
                        COUNT(texts.id)
                 FROM languages
                 LEFT JOIN texts ON texts.language_id = languages.id AND texts.archived = 0
                 WHERE languages.id = ?1
                 GROUP BY languages.id",
                [input.id],
                |row| {
                    Ok(LanguageSettings {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        character_substitutions: row.get(2)?,
                        sentence_terminators: row.get(3)?,
                        split_each_character: row.get(4)?,
                        remove_spaces: row.get(5)?,
                        right_to_left: row.get(6)?,
                        text_count: row.get(7)?,
                    })
                },
            )
            .map_err(|error| format!("Unable to load the updated language: {error}"))?;
        transaction
            .commit()
            .map_err(|error| format!("Unable to save the language update: {error}"))?;
        Ok(saved)
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
                        COALESCE(texts.last_opened_at, ''),
                        texts.archived
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
                    archived: row.get(6)?,
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
        let config = Self::parser_config(&transaction, language_id)?;
        Self::persist_text_parsing(&transaction, id, language_id, &input.content, &config)?;
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
            archived: false,
        })
    }

    pub fn save_text_audio(&self, input: SaveTextAudioInput) -> Result<TextAudio, String> {
        if input.text_id <= 0 {
            return Err("Text was not found".to_string());
        }
        let text_id = input.text_id;
        let (file_name, media_type, content) =
            validate_audio(input.file_name, input.media_type, input.data_base64)?;
        let connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let exists = connection
            .query_row("SELECT 1 FROM texts WHERE id = ?1", [text_id], |_| Ok(()))
            .optional()
            .map_err(|error| format!("Unable to verify the audio text: {error}"))?
            .is_some();
        if !exists {
            return Err("Text was not found".to_string());
        }
        connection
            .execute(
                "INSERT INTO text_audio (text_id, file_name, media_type, content)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(text_id) DO UPDATE SET
                    file_name = excluded.file_name,
                    media_type = excluded.media_type,
                    content = excluded.content,
                    updated_at = CURRENT_TIMESTAMP",
                params![text_id, file_name, media_type, content],
            )
            .map_err(|error| format!("Unable to save the text audio: {error}"))?;
        Ok(TextAudio {
            file_name,
            media_type,
            data_base64: BASE64.encode(content),
        })
    }

    pub fn get_text_audio(&self, text_id: i64) -> Result<Option<TextAudio>, String> {
        if text_id <= 0 {
            return Err("Text was not found".to_string());
        }
        let connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let audio = connection
            .query_row(
                "SELECT file_name, media_type, content FROM text_audio WHERE text_id = ?1",
                [text_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, Vec<u8>>(2)?,
                    ))
                },
            )
            .optional()
            .map_err(|error| format!("Unable to load the text audio: {error}"))?;
        if let Some((file_name, media_type, content)) = audio {
            return Ok(Some(TextAudio {
                file_name,
                media_type,
                data_base64: BASE64.encode(content),
            }));
        }
        let exists = connection
            .query_row("SELECT 1 FROM texts WHERE id = ?1", [text_id], |_| Ok(()))
            .optional()
            .map_err(|error| format!("Unable to verify the audio text: {error}"))?
            .is_some();
        if !exists {
            return Err("Text was not found".to_string());
        }
        Ok(None)
    }

    pub fn remove_text_audio(&self, text_id: i64) -> Result<(), String> {
        if text_id <= 0 {
            return Err("Text was not found".to_string());
        }
        let connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        connection
            .execute("DELETE FROM text_audio WHERE text_id = ?1", [text_id])
            .map_err(|error| format!("Unable to remove the text audio: {error}"))?;
        let exists = connection
            .query_row("SELECT 1 FROM texts WHERE id = ?1", [text_id], |_| Ok(()))
            .optional()
            .map_err(|error| format!("Unable to verify the audio text: {error}"))?
            .is_some();
        if !exists {
            return Err("Text was not found".to_string());
        }
        Ok(())
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
                        texts.source_uri,
                        texts.archived,
                        EXISTS(SELECT 1 FROM text_audio WHERE text_audio.text_id = texts.id)
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
                        archived: row.get(8)?,
                        has_audio: row.get(9)?,
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
        let archived = transaction
            .query_row("SELECT archived FROM texts WHERE id = ?1", [id], |row| {
                row.get(0)
            })
            .optional()
            .map_err(|error| format!("Unable to load the text archive state: {error}"))?
            .ok_or_else(|| "Text was not found".to_string())?;

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
        let config = Self::parser_config(&transaction, language_id)?;
        Self::persist_text_parsing(&transaction, id, language_id, &input.content, &config)?;
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
            archived,
        })
    }

    pub fn set_text_archived(&self, input: SetTextArchivedInput) -> Result<(), String> {
        if input.id <= 0 {
            return Err("Text was not found".to_string());
        }
        let connection = self
            .connection
            .lock()
            .map_err(|_| "The desktop database lock is unavailable".to_string())?;
        let changed = connection
            .execute(
                "UPDATE texts
                 SET archived = ?1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?2 AND archived != ?1",
                params![input.archived, input.id],
            )
            .map_err(|error| format!("Unable to update the text archive state: {error}"))?;
        if changed == 0 {
            let exists = connection
                .query_row("SELECT 1 FROM texts WHERE id = ?1", [input.id], |_| Ok(()))
                .optional()
                .map_err(|error| format!("Unable to verify the text archive state: {error}"))?
                .is_some();
            if !exists {
                return Err("Text was not found".to_string());
            }
        }
        Ok(())
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
                "SELECT texts.title,
                        languages.name,
                        languages.remove_spaces,
                        languages.right_to_left
                 FROM texts
                 INNER JOIN languages ON languages.id = texts.language_id
                 WHERE texts.id = ?1",
                [id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, bool>(2)?,
                        row.get::<_, bool>(3)?,
                    ))
                },
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
            remove_spaces: metadata.2,
            right_to_left: metadata.3,
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
    fn updates_language_settings_and_reparses_existing_texts() {
        let database = Database::in_memory().expect("database should migrate");
        let created = database
            .create_text(text_input("Japanese", "Reader", "日本語… 次"))
            .expect("text should be created");
        assert_eq!(created.total_terms, 2);

        let language = database
            .list_languages()
            .expect("languages should load")
            .remove(0);
        let updated = database
            .update_language(UpdateLanguageInput {
                id: language.id,
                character_substitutions: "…=。".into(),
                sentence_terminators: "。".into(),
                split_each_character: true,
                remove_spaces: true,
                right_to_left: false,
            })
            .expect("language should update");
        let reading = database
            .get_reading_text(created.id)
            .expect("reparsed text should open");

        assert_eq!(updated.text_count, 1);
        assert!(updated.split_each_character);
        assert!(updated.remove_spaces);
        assert_eq!(reading.sentences.len(), 2);
        assert_eq!(reading.total_terms, 4);
        assert!(reading.remove_spaces);
        assert!(!reading.right_to_left);
    }

    #[test]
    fn validates_language_substitution_pairs() {
        let database = Database::in_memory().expect("database should migrate");
        database
            .create_text(text_input("English", "Reader", "Text"))
            .expect("text should be created");

        let error = database
            .update_language(UpdateLanguageInput {
                id: 1,
                character_substitutions: "invalid".into(),
                sentence_terminators: ".!?".into(),
                split_each_character: false,
                remove_spaces: false,
                right_to_left: false,
            })
            .expect_err("invalid substitution should fail");

        assert_eq!(error, "Character substitutions must use from=to pairs");
    }

    #[test]
    fn creates_and_assigns_shared_tags() {
        let database = Database::in_memory().expect("database should migrate");
        let text = database
            .create_text(text_input("English", "Tagged", "Tagged term."))
            .expect("text should be created");
        database
            .save_term(SaveTermInput {
                text_id: text.id,
                normalized: "tagged".into(),
                status: 1,
                translation: "marcado".into(),
                romanization: "".into(),
            })
            .expect("term should save");
        let tag = database
            .create_tag(CreateTagInput {
                name: "Important".into(),
                comment: "Review first".into(),
            })
            .expect("tag should be created");

        database
            .set_text_tags(SetTextTagsInput {
                text_id: text.id,
                tag_ids: vec![tag.id, tag.id],
            })
            .expect("text tag should save");
        database
            .set_term_tags(SetTermTagsInput {
                text_id: text.id,
                normalized: "tagged".into(),
                tag_ids: vec![tag.id],
            })
            .expect("term tag should save");

        assert_eq!(
            database
                .list_text_tag_ids(text.id)
                .expect("text tags should load"),
            [tag.id]
        );
        assert_eq!(
            database
                .list_term_tag_ids(text.id, "tagged".into())
                .expect("term tags should load"),
            [tag.id]
        );
        let tags = database.list_tags().expect("tags should load");
        assert_eq!(tags[0].term_count, 1);
        assert_eq!(tags[0].text_count, 1);
    }

    #[test]
    fn validates_tag_names_and_assignments() {
        let database = Database::in_memory().expect("database should migrate");
        let text = database
            .create_text(text_input("English", "Tagged", "Term"))
            .expect("text should be created");

        assert_eq!(
            database
                .create_tag(CreateTagInput {
                    name: "".into(),
                    comment: "".into(),
                })
                .expect_err("empty tag should fail"),
            "Tag name is required"
        );
        assert_eq!(
            database
                .set_text_tags(SetTextTagsInput {
                    text_id: text.id,
                    tag_ids: vec![999],
                })
                .expect_err("missing tag should fail"),
            "A selected tag was not found"
        );
    }

    #[test]
    fn exports_and_restores_a_complete_portable_backup() {
        let database = Database::in_memory().expect("database should migrate");
        let created = database
            .create_text(text_input("English", "Backup", "A short story."))
            .expect("text should be created");
        database
            .save_text_audio(SaveTextAudioInput {
                text_id: created.id,
                file_name: "story.mp3".into(),
                media_type: "audio/mpeg".into(),
                data_base64: "AQID".into(),
            })
            .expect("audio should save");
        let reading = database
            .get_reading_text(created.id)
            .expect("reading should open");
        database
            .create_expression(CreateExpressionInput {
                text_id: created.id,
                sentence_id: reading.sentences[0].id,
                start_position: 1,
                end_position: 5,
            })
            .expect("expression should be created");
        let tag = database
            .create_tag(CreateTagInput {
                name: "Story".into(),
                comment: "Migration test".into(),
            })
            .expect("tag should be created");
        database
            .set_text_tags(SetTextTagsInput {
                text_id: created.id,
                tag_ids: vec![tag.id],
            })
            .expect("text tag should save");
        database
            .set_term_tags(SetTermTagsInput {
                text_id: created.id,
                normalized: "a short story".into(),
                tag_ids: vec![tag.id],
            })
            .expect("term tag should save");
        let review = database
            .list_review_terms(20)
            .expect("review queue should load")
            .remove(0);
        database
            .record_review(RecordReviewInput {
                term_id: review.id,
                rating: 2,
            })
            .expect("review should record");
        database
            .set_text_archived(SetTextArchivedInput {
                id: created.id,
                archived: true,
            })
            .expect("text should archive");
        let payload = database.export_backup().expect("backup should export");

        database
            .create_text(text_input("French", "Temporary", "Texte temporaire"))
            .expect("temporary text should be created");
        let summary = database
            .restore_backup(payload)
            .expect("backup should restore");
        let texts = database.list_texts().expect("restored library should load");
        let restored = database
            .get_reading_text(created.id)
            .expect("restored reading should load");
        let statistics = database
            .review_statistics()
            .expect("restored statistics should load");
        let restored_audio = database
            .get_text_audio(created.id)
            .expect("restored audio should load")
            .expect("restored audio should exist");

        assert_eq!(summary.languages, 1);
        assert_eq!(summary.texts, 1);
        assert_eq!(summary.archived_texts, 1);
        assert_eq!(summary.media, 1);
        assert_eq!(summary.terms, 1);
        assert_eq!(summary.tags, 1);
        assert_eq!(summary.expressions, 1);
        assert_eq!(summary.reviews, 1);
        assert_eq!(texts.len(), 1);
        assert_eq!(texts[0].title, "Backup");
        assert!(texts[0].archived);
        assert_eq!(restored.expressions.len(), 1);
        assert_eq!(statistics.reviews_today, 1);
        assert_eq!(restored_audio.file_name, "story.mp3");
        assert_eq!(restored_audio.data_base64, "AQID");
        let restored_tags = database.list_tags().expect("restored tags should load");
        assert_eq!(restored_tags[0].term_count, 1);
        assert_eq!(restored_tags[0].text_count, 1);
    }

    #[test]
    fn rolls_back_an_invalid_portable_backup() {
        let database = Database::in_memory().expect("database should migrate");
        database
            .create_text(text_input("English", "Keep", "Keep this text"))
            .expect("text should be created");
        let payload = database.export_backup().expect("backup should export");
        let mut value: serde_json::Value =
            serde_json::from_str(&payload).expect("backup JSON should decode");
        value["texts"][0]["languageId"] = serde_json::json!(999);

        let error = database
            .restore_backup(value.to_string())
            .expect_err("invalid backup should fail");
        let texts = database
            .list_texts()
            .expect("current library should survive");

        assert!(error.contains("Unable to restore a text"));
        assert_eq!(texts.len(), 1);
        assert_eq!(texts[0].title, "Keep");
    }

    #[test]
    fn restores_pre_archive_backups_as_active_texts() {
        let database = Database::in_memory().expect("database should migrate");
        let created = database
            .create_text(text_input("English", "Older backup", "Still compatible"))
            .expect("text should be created");
        let payload = database.export_backup().expect("backup should export");
        let mut value: serde_json::Value =
            serde_json::from_str(&payload).expect("backup JSON should decode");
        value["texts"][0]
            .as_object_mut()
            .expect("backup text should be an object")
            .remove("archived");

        let summary = database
            .restore_backup(value.to_string())
            .expect("older backup should restore");

        assert_eq!(summary.archived_texts, 0);
        assert!(!database.get_text(created.id).unwrap().archived);
    }

    #[test]
    fn imports_the_legacy_php_export_contract() {
        let database = Database::in_memory().expect("database should migrate");
        let payload = include_str!("../../tests/fixtures/legacy-backup-v1.json").to_string();

        let summary = database
            .restore_backup(payload)
            .expect("legacy backup should restore");
        let texts = database.list_texts().expect("imported texts should load");
        let reading = database
            .get_reading_text(11)
            .expect("imported reading should load");
        let term = database
            .get_term_details(11, "legacy".into())
            .expect("imported term should load");
        let archived = database
            .get_text(12)
            .expect("imported archived text should load");
        let archived_audio = database
            .get_text_audio(12)
            .expect("imported audio should load")
            .expect("imported audio should exist");

        assert_eq!(summary.languages, 1);
        assert_eq!(summary.texts, 2);
        assert_eq!(summary.archived_texts, 1);
        assert_eq!(summary.media, 1);
        assert_eq!(summary.terms, 2);
        assert_eq!(summary.tags, 1);
        assert_eq!(summary.expressions, 1);
        assert_eq!(summary.warnings.len(), 1);
        assert_eq!(texts.len(), 2);
        assert_eq!(
            texts.iter().find(|text| text.id == 11).unwrap().title,
            "Legacy text"
        );
        assert!(archived.archived);
        assert!(archived.has_audio);
        assert_eq!(archived.title, "Archived legacy text");
        assert_eq!(archived_audio.data_base64, "SUQz");
        assert_eq!(reading.language, "English");
        assert_eq!(reading.expressions.len(), 1);
        assert_eq!(reading.expressions[0].normalized, "legacy text");
        assert_eq!(reading.expressions[0].start_position, 1);
        assert_eq!(reading.expressions[0].end_position, 3);
        assert_eq!(term.translation, "antigo");
        assert_eq!(term.status, 2);
        let tags = database.list_tags().expect("imported tags should load");
        assert_eq!(tags[0].term_count, 1);
        assert_eq!(tags[0].text_count, 2);
    }

    #[test]
    fn warns_and_skips_a_legacy_expression_that_cannot_be_located() {
        let database = Database::in_memory().expect("database should migrate");
        let mut value: serde_json::Value =
            serde_json::from_str(include_str!("../../tests/fixtures/legacy-backup-v1.json"))
                .expect("legacy fixture should decode");
        value["expressions"][0]["startWord"] = serde_json::json!(99);

        let summary = database
            .restore_backup(value.to_string())
            .expect("backup should restore without the unmatched occurrence");

        assert_eq!(summary.expressions, 0);
        assert_eq!(summary.warnings.len(), 2);
        assert!(summary.warnings[1].contains("could not be matched"));
        assert_eq!(database.list_texts().unwrap().len(), 2);
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
    fn archives_and_restores_a_text() {
        let database = Database::in_memory().expect("database should migrate");
        let created = database
            .create_text(text_input("English", "Archive me", "Preserve this text"))
            .expect("text should be created");

        database
            .set_text_archived(SetTextArchivedInput {
                id: created.id,
                archived: true,
            })
            .expect("text should archive");
        assert!(database.get_text(created.id).unwrap().archived);

        database
            .set_text_archived(SetTextArchivedInput {
                id: created.id,
                archived: false,
            })
            .expect("text should restore");
        assert!(!database.get_text(created.id).unwrap().archived);
        assert_eq!(
            database
                .set_text_archived(SetTextArchivedInput {
                    id: 999,
                    archived: true,
                })
                .unwrap_err(),
            "Text was not found"
        );
    }

    #[test]
    fn saves_loads_and_removes_text_audio() {
        let database = Database::in_memory().expect("database should migrate");
        let created = database
            .create_text(text_input("English", "Audio", "Listen to this"))
            .expect("text should be created");
        assert!(database.get_text_audio(created.id).unwrap().is_none());

        let saved = database
            .save_text_audio(SaveTextAudioInput {
                text_id: created.id,
                file_name: "lesson.ogg".into(),
                media_type: "audio/ogg".into(),
                data_base64: "T2dnUw==".into(),
            })
            .expect("audio should save");

        assert_eq!(saved.file_name, "lesson.ogg");
        assert_eq!(database.get_text_audio(created.id).unwrap(), Some(saved));
        assert!(database.get_text(created.id).unwrap().has_audio);
        database
            .remove_text_audio(created.id)
            .expect("audio should be removed");
        assert!(database.get_text_audio(created.id).unwrap().is_none());
        assert!(!database.get_text(created.id).unwrap().has_audio);
    }

    #[test]
    fn validates_text_audio_inputs() {
        let database = Database::in_memory().expect("database should migrate");
        let created = database
            .create_text(text_input("English", "Audio", "Listen"))
            .expect("text should be created");

        assert_eq!(
            database
                .save_text_audio(SaveTextAudioInput {
                    text_id: created.id,
                    file_name: "lesson.exe".into(),
                    media_type: "application/octet-stream".into(),
                    data_base64: "AQID".into(),
                })
                .unwrap_err(),
            "Audio type is not supported"
        );
        assert_eq!(
            database
                .save_text_audio(SaveTextAudioInput {
                    text_id: created.id,
                    file_name: "../lesson.mp3".into(),
                    media_type: "audio/mpeg".into(),
                    data_base64: "AQID".into(),
                })
                .unwrap_err(),
            "Audio file name is invalid"
        );
        assert_eq!(
            database
                .save_text_audio(SaveTextAudioInput {
                    text_id: created.id,
                    file_name: "lesson.mp3".into(),
                    media_type: "audio/mpeg".into(),
                    data_base64: "not base64".into(),
                })
                .unwrap_err(),
            "Audio data is not valid base64"
        );
    }

    #[test]
    fn deletes_a_text_but_preserves_its_language() {
        let database = Database::in_memory().expect("database should migrate");
        let created = database
            .create_text(text_input("English", "Disposable", "Content"))
            .expect("text should be created");
        database
            .save_text_audio(SaveTextAudioInput {
                text_id: created.id,
                file_name: "disposable.mp3".into(),
                media_type: "audio/mpeg".into(),
                data_base64: "AQID".into(),
            })
            .expect("audio should save");

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
        let audio_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM text_audio", [], |row| row.get(0))
            .expect("audio count should be readable");
        assert_eq!((sentence_count, item_count), (0, 0));
        assert_eq!(audio_count, 0);
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
