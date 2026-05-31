use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAudioAsset {
    pub id: String,
    pub file_name: String,
    pub title: String,
    pub mime_type: String,
    pub size: i64,
    pub last_modified: i64,
    pub duration_sec: f64,
    pub blob_key: String,
    pub artwork: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub tags: Option<Vec<String>>,
    pub file_handle: Option<String>,
    pub audio_class: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CartSlotConfig {
    pub slot_index: i64,
    pub asset_id: Option<String>,
    pub label: String,
    pub color: String,
    pub hotkey: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastSchedulerEvent {
    pub id: String,
    pub name: String,
    pub asset_id: String,
    pub time: String,
    pub days_of_week: Vec<i64>,
    pub mode: String,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrossfadeProfile {
    pub audio_class: String,
    pub mix_point_sec: f64,
    pub fade_in_sec: f64,
    pub fade_out_sec: f64,
    pub curve: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackRoutingSettings {
    pub mode: String,
    pub on_air_volume: f64,
    pub monitor_volume: f64,
    pub preview_enabled: bool,
    pub driver_label: String,
    pub main_output_label: String,
    pub monitor_output_label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MicSettings {
    pub input_device_id: Option<String>,
    pub duck_db: i64,
    pub mode: String,
    pub preferred_sample_rate: i64,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LowResourceSettings {
    pub enabled: bool,
    pub reduce_motion: bool,
    pub simple_surfaces: bool,
    pub vu_fps: i64,
    pub import_batch_size: i64,
    pub skip_import_duration_scan: bool,
    pub stable_audio_buffer_frames: i64,
    pub suspend_background_work_on_air: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StreamingTarget {
    pub id: String,
    pub name: String,
    pub platform: String,
    pub server_url: String,
    pub stream_key: String,
    pub enabled: bool,
    pub protocol: String,
    pub audio_bitrate_kbps: i64,
    pub video_mode: String,
    pub status: String,
    pub last_error: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareUpdateSettings {
    pub auto_check_enabled: bool,
    pub auto_download_and_install: bool,
    pub channel: String,
    pub last_checked_at: Option<String>,
    pub last_available_version: Option<String>,
    pub last_installed_version: Option<String>,
    pub status: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStateRecord {
    pub id: String,
    pub pending_event_ids: Vec<String>,
    pub last_fired_keys: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StationHealth {
    pub ok: bool,
    pub app_mode: String,
    pub audio_backend: String,
    pub db_path: String,
    pub media_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StationDevice {
    pub id: String,
    pub name: String,
    pub host: String,
    pub input_channels: usize,
    pub output_channels: usize,
    pub sample_rates: Vec<u32>,
    pub default_sample_rate: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StationTransportState {
    pub playing: bool,
    pub current_asset_id: Option<String>,
    pub queue_asset_ids: Vec<String>,
    pub position_sec: f64,
    pub active_deck: String,
}

impl Default for StationTransportState {
    fn default() -> Self {
        Self {
            playing: false,
            current_asset_id: None,
            queue_asset_ids: Vec::new(),
            position_sec: 0.0,
            active_deck: "A".to_string(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StationTransportPatch {
    pub playing: Option<bool>,
    pub current_asset_id: Option<Option<String>>,
    pub queue_asset_ids: Option<Vec<String>>,
    pub position_sec: Option<f64>,
    pub active_deck: Option<String>,
}
