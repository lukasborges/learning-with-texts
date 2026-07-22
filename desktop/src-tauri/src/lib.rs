mod database;

use database::{CreateTextInput, Database, LibraryText, TextDetails, UpdateTextInput};
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
            delete_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running the LWT desktop application");
}
