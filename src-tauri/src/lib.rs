use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_notification::init())
    .setup(|app| {
      #[cfg(desktop)]
      {
        use tauri::menu::{Menu, MenuItem};
        use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

        let show = MenuItem::with_id(app, "show", "显示 DDYS", true, None::<&str>)?;
        let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&show, &quit])?;

        let mut builder = TrayIconBuilder::new()
          .tooltip("DDYS macOS")
          .menu(&menu)
          .show_menu_on_left_click(false)
          .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
          })
          .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
              button: MouseButton::Left,
              button_state: MouseButtonState::Up,
              ..
            } = event
            {
              show_main_window(&tray.app_handle());
            }
          });

        if let Some(icon) = app.default_window_icon() {
          builder = builder.icon(icon.clone());
        }

        let _tray = builder.build(app)?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running DDYS macOS");
}

#[cfg(desktop)]
fn show_main_window(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
  }
}
