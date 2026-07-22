mod database;
mod parser;

use database::{
    CreateExpressionInput, CreateTextInput, CreatedExpression, Database, LibraryText, ReadingText,
    RecordReviewInput, ReviewCard, ReviewOutcome, ReviewStatistics, SaveTermInput, SavedTerm,
    SetTermStatusInput, TermDetails, TermProgress, TextDetails, UpdateTextInput,
};
use tauri::Manager;

#[tauri::command]
fn list_texts(database: tauri::State<'_, Database>) -> Result<Vec<LibraryText>, String> {
    database.list_texts()
}

#[tauri::command]
fn create_text(
    database: tauri::State<'_, Database>,
    input: CreateTextInput,
) -> Result<LibraryText, String> {
    database.create_text(input)
}

#[tauri::command]
fn get_text(database: tauri::State<'_, Database>, id: i64) -> Result<TextDetails, String> {
    database.get_text(id)
}

#[tauri::command]
fn update_text(
    database: tauri::State<'_, Database>,
    input: UpdateTextInput,
) -> Result<LibraryText, String> {
    database.update_text(input)
}

#[tauri::command]
fn delete_text(database: tauri::State<'_, Database>, id: i64) -> Result<(), String> {
    database.delete_text(id)
}

#[tauri::command]
fn get_reading_text(database: tauri::State<'_, Database>, id: i64) -> Result<ReadingText, String> {
    database.get_reading_text(id)
}

#[tauri::command]
fn set_term_status(
    database: tauri::State<'_, Database>,
    input: SetTermStatusInput,
) -> Result<TermProgress, String> {
    database.set_term_status(input)
}

#[tauri::command]
fn get_term_details(
    database: tauri::State<'_, Database>,
    text_id: i64,
    normalized: String,
) -> Result<TermDetails, String> {
    database.get_term_details(text_id, normalized)
}

#[tauri::command]
fn save_term(
    database: tauri::State<'_, Database>,
    input: SaveTermInput,
) -> Result<SavedTerm, String> {
    database.save_term(input)
}

#[tauri::command]
fn create_expression(
    database: tauri::State<'_, Database>,
    input: CreateExpressionInput,
) -> Result<CreatedExpression, String> {
    database.create_expression(input)
}

#[tauri::command]
fn list_review_terms(
    database: tauri::State<'_, Database>,
    limit: i64,
) -> Result<Vec<ReviewCard>, String> {
    database.list_review_terms(limit)
}

#[tauri::command]
fn record_review(
    database: tauri::State<'_, Database>,
    input: RecordReviewInput,
) -> Result<ReviewOutcome, String> {
    database.record_review(input)
}

#[tauri::command]
fn review_statistics(database: tauri::State<'_, Database>) -> Result<ReviewStatistics, String> {
    database.review_statistics()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let database_path = app.path().app_data_dir()?.join("lwt.sqlite3");
            let database = Database::open(&database_path).map_err(std::io::Error::other)?;
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_texts,
            create_text,
            get_text,
            update_text,
            delete_text,
            get_reading_text,
            set_term_status,
            get_term_details,
            save_term,
            create_expression,
            list_review_terms,
            record_review,
            review_statistics
        ])
        .run(tauri::generate_context!())
        .expect("error while running the LWT desktop application");
}
