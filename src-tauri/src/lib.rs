mod station;

use station::{commands, StationCore, StationState};
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let base_dir = app
                .path()
                .app_local_data_dir()
                .map_err(|error| error.to_string())?;
            let core = StationCore::open(&base_dir).map_err(|error| error.to_string())?;
            app.manage(StationState::new(core));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::station_health,
            commands::station_import_asset,
            commands::station_list_assets,
            commands::station_read_asset_blob,
            commands::station_delete_asset,
            commands::station_save_cart_slots,
            commands::station_list_cart_slots,
            commands::station_save_scheduler_event,
            commands::station_list_scheduler_events,
            commands::station_delete_scheduler_event,
            commands::station_save_crossfade_profiles,
            commands::station_list_crossfade_profiles,
            commands::station_save_playback_settings,
            commands::station_load_playback_settings,
            commands::station_save_mic_settings,
            commands::station_load_mic_settings,
            commands::station_save_low_resource_settings,
            commands::station_load_low_resource_settings,
            commands::station_save_streaming_target,
            commands::station_list_streaming_targets,
            commands::station_delete_streaming_target,
            commands::station_save_software_update_settings,
            commands::station_load_software_update_settings,
            commands::station_save_runtime_state,
            commands::station_load_runtime_state,
            commands::station_list_audio_devices,
            commands::station_set_transport
        ])
        .run(tauri::generate_context!())
        .expect("error while running Urban Radio Station");
}
