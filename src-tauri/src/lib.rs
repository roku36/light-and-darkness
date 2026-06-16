use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window.set_fullscreen(true)?;
                window.set_decorations(false)?;
                window.set_resizable(false)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
