use crate::station::audio::list_audio_devices;
use crate::station::models::{
    BroadcastSchedulerEvent, CartSlotConfig, CrossfadeProfile, LocalAudioAsset,
    LowResourceSettings, MicSettings, PlaybackRoutingSettings, RuntimeStateRecord,
    SoftwareUpdateSettings, StationDevice, StationHealth, StationTransportPatch,
    StationTransportState, StreamingTarget,
};
use crate::station::StationState;
use tauri::State;

#[tauri::command]
pub fn station_health(state: State<'_, StationState>) -> Result<StationHealth, String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    Ok(core.health())
}

#[tauri::command]
pub fn station_import_asset(
    state: State<'_, StationState>,
    asset: LocalAudioAsset,
    bytes: Vec<u8>,
) -> Result<LocalAudioAsset, String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.import_asset(asset, &bytes)
}

#[tauri::command]
pub fn station_list_assets(state: State<'_, StationState>) -> Result<Vec<LocalAudioAsset>, String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.list_assets()
}

#[tauri::command]
pub fn station_read_asset_blob(
    state: State<'_, StationState>,
    blob_key: String,
) -> Result<Vec<u8>, String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.read_asset_blob(&blob_key)
}

#[tauri::command]
pub fn station_delete_asset(
    state: State<'_, StationState>,
    asset_id: String,
    blob_key: String,
) -> Result<(), String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.delete_asset(&asset_id, &blob_key)
}

#[tauri::command]
pub fn station_save_cart_slots(
    state: State<'_, StationState>,
    slots: Vec<CartSlotConfig>,
) -> Result<(), String> {
    let mut core = state.core.lock().map_err(|error| error.to_string())?;
    core.save_cart_slots(&slots)
}

#[tauri::command]
pub fn station_list_cart_slots(
    state: State<'_, StationState>,
) -> Result<Vec<CartSlotConfig>, String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.list_cart_slots()
}

#[tauri::command]
pub fn station_save_scheduler_event(
    state: State<'_, StationState>,
    event: BroadcastSchedulerEvent,
) -> Result<(), String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.save_scheduler_event(&event)
}

#[tauri::command]
pub fn station_list_scheduler_events(
    state: State<'_, StationState>,
) -> Result<Vec<BroadcastSchedulerEvent>, String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.list_scheduler_events()
}

#[tauri::command]
pub fn station_delete_scheduler_event(
    state: State<'_, StationState>,
    event_id: String,
) -> Result<(), String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.delete_scheduler_event(&event_id)
}

#[tauri::command]
pub fn station_save_crossfade_profiles(
    state: State<'_, StationState>,
    profiles: Vec<CrossfadeProfile>,
) -> Result<(), String> {
    let mut core = state.core.lock().map_err(|error| error.to_string())?;
    core.save_crossfade_profiles(&profiles)
}

#[tauri::command]
pub fn station_list_crossfade_profiles(
    state: State<'_, StationState>,
) -> Result<Vec<CrossfadeProfile>, String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.list_crossfade_profiles()
}

#[tauri::command]
pub fn station_save_playback_settings(
    state: State<'_, StationState>,
    settings: PlaybackRoutingSettings,
) -> Result<(), String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.save_playback_settings(&settings)
}

#[tauri::command]
pub fn station_load_playback_settings(
    state: State<'_, StationState>,
) -> Result<Option<PlaybackRoutingSettings>, String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.load_playback_settings()
}

#[tauri::command]
pub fn station_save_mic_settings(
    state: State<'_, StationState>,
    settings: MicSettings,
) -> Result<(), String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.save_mic_settings(&settings)
}

#[tauri::command]
pub fn station_load_mic_settings(
    state: State<'_, StationState>,
) -> Result<Option<MicSettings>, String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.load_mic_settings()
}

#[tauri::command]
pub fn station_save_low_resource_settings(
    state: State<'_, StationState>,
    settings: LowResourceSettings,
) -> Result<(), String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.save_low_resource_settings(&settings)
}

#[tauri::command]
pub fn station_load_low_resource_settings(
    state: State<'_, StationState>,
) -> Result<Option<LowResourceSettings>, String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.load_low_resource_settings()
}

#[tauri::command]
pub fn station_save_streaming_target(
    state: State<'_, StationState>,
    target: StreamingTarget,
) -> Result<(), String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.save_streaming_target(&target)
}

#[tauri::command]
pub fn station_list_streaming_targets(
    state: State<'_, StationState>,
) -> Result<Vec<StreamingTarget>, String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.list_streaming_targets()
}

#[tauri::command]
pub fn station_delete_streaming_target(
    state: State<'_, StationState>,
    target_id: String,
) -> Result<(), String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.delete_streaming_target(&target_id)
}

#[tauri::command]
pub fn station_save_software_update_settings(
    state: State<'_, StationState>,
    settings: SoftwareUpdateSettings,
) -> Result<(), String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.save_software_update_settings(&settings)
}

#[tauri::command]
pub fn station_load_software_update_settings(
    state: State<'_, StationState>,
) -> Result<Option<SoftwareUpdateSettings>, String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.load_software_update_settings()
}

#[tauri::command]
pub fn station_save_runtime_state(
    state: State<'_, StationState>,
    state_record: RuntimeStateRecord,
) -> Result<(), String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.save_runtime_state(&state_record)
}

#[tauri::command]
pub fn station_load_runtime_state(
    state: State<'_, StationState>,
) -> Result<Option<RuntimeStateRecord>, String> {
    let core = state.core.lock().map_err(|error| error.to_string())?;
    core.load_runtime_state()
}

#[tauri::command]
pub fn station_list_audio_devices() -> Result<Vec<StationDevice>, String> {
    Ok(list_audio_devices())
}

#[tauri::command]
pub fn station_set_transport(
    state: State<'_, StationState>,
    patch: StationTransportPatch,
) -> Result<StationTransportState, String> {
    let mut core = state.core.lock().map_err(|error| error.to_string())?;
    Ok(core.mixer.patch_transport(patch))
}
