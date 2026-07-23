use serde::{Deserialize, Serialize};

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
    pub completed_at: Option<String>,
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
    pub completed_at: Option<String>,
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
pub struct CreateLanguageInput {
    pub name: String,
    pub dictionary_uri_1: String,
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
    pub text_size: i64,
    pub dictionary_uri_1: String,
    pub dictionary_uri_2: Option<String>,
    pub google_translate_uri: Option<String>,
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
pub struct FinishLessonOutcome {
    pub completion_id: i64,
    pub text_id: i64,
    pub marked_known: i64,
    pub known_terms: i64,
    pub total_terms: i64,
    pub completed_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoFinishLessonInput {
    pub completion_id: i64,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoFinishLessonOutcome {
    pub text_id: i64,
    pub reverted_terms: i64,
    pub known_terms: i64,
    pub total_terms: i64,
    pub completed_at: Option<String>,
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
    pub context: Option<String>,
    pub source_title: Option<String>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VocabularyTerm {
    pub id: i64,
    pub display_text: String,
    pub normalized: String,
    pub language: String,
    pub translation: String,
    pub romanization: String,
    pub status: i64,
    pub word_count: i64,
    pub occurrence_count: i64,
    pub review_count: i64,
    pub next_review_at: Option<String>,
    pub source_title: Option<String>,
    pub context: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateVocabularyTermInput {
    pub id: i64,
    pub status: i64,
    pub translation: String,
    pub romanization: String,
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
    pub dictionary_uri_1: String,
    pub dictionary_uri_2: Option<String>,
    pub google_translate_uri: Option<String>,
    pub export_template: Option<String>,
    pub text_size: i64,
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
    pub dictionary_uri_1: String,
    pub dictionary_uri_2: Option<String>,
    pub google_translate_uri: Option<String>,
    pub export_template: Option<String>,
    pub text_size: i64,
    pub character_substitutions: String,
    pub sentence_terminators: String,
    pub split_each_character: bool,
    pub remove_spaces: bool,
    pub right_to_left: bool,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub library_page_size: i64,
    pub archived_page_size: i64,
    pub tag_page_size: i64,
    pub show_word_counts: bool,
    pub review_delay_ms: i64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            library_page_size: 25,
            archived_page_size: 25,
            tag_page_size: 50,
            show_word_counts: true,
            review_delay_ms: 0,
        }
    }
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
