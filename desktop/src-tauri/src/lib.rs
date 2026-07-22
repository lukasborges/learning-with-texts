mod database;
mod parser;

use database::{
    CreateTextInput, Database, LibraryText, ReadingText, SaveTermInput, SavedTerm,
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
            save_term
        ])
        .run(tauri::generate_context!())
        .expect("error while running the LWT desktop application");
}
