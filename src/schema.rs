pub(crate) const INITIAL_MIGRATION: &str = include_str!("../migrations/0001_initial.sql");
pub(crate) const TEXT_PARSING_MIGRATION: &str = include_str!("../migrations/0002_text_parsing.sql");
pub(crate) const TERMS_MIGRATION: &str = include_str!("../migrations/0003_terms.sql");
const TERM_DETAILS: &str = include_str!("../migrations/0004_term_details.sql");
const EXPRESSIONS: &str = include_str!("../migrations/0005_expressions.sql");
const REVIEWS: &str = include_str!("../migrations/0006_reviews.sql");
const TAGS: &str = include_str!("../migrations/0007_tags.sql");
const ARCHIVED_TEXTS: &str = include_str!("../migrations/0008_archived_texts.sql");
const TEXT_AUDIO: &str = include_str!("../migrations/0009_text_audio.sql");
const APP_SETTINGS: &str = include_str!("../migrations/0010_app_settings.sql");
const LESSON_COMPLETION: &str = include_str!("../migrations/0011_lesson_completion.sql");

pub(crate) const LATEST_SCHEMA_VERSION: i64 = 11;
pub(crate) const MIGRATIONS: [(i64, &str); LATEST_SCHEMA_VERSION as usize] = [
    (1, INITIAL_MIGRATION),
    (2, TEXT_PARSING_MIGRATION),
    (3, TERMS_MIGRATION),
    (4, TERM_DETAILS),
    (5, EXPRESSIONS),
    (6, REVIEWS),
    (7, TAGS),
    (8, ARCHIVED_TEXTS),
    (9, TEXT_AUDIO),
    (10, APP_SETTINGS),
    (LATEST_SCHEMA_VERSION, LESSON_COMPLETION),
];
