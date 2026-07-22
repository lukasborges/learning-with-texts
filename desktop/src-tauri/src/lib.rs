mod database;

use database::{CreateTextInput, Database, LibraryText};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let database_path = app.path().app_data_dir()?.join("lwt.sqlite3");
            let database = Database::open(&database_path).map_err(std::io::Error::other)?;
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![list_texts, create_text])
        .run(tauri::generate_context!())
        .expect("error while running the LWT desktop application");
}
