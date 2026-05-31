use crate::station::audio::StationMixer;
use crate::station::models::{
    BroadcastSchedulerEvent, CartSlotConfig, CrossfadeProfile, LocalAudioAsset,
    LowResourceSettings, MicSettings, PlaybackRoutingSettings, RuntimeStateRecord,
    SoftwareUpdateSettings, StationHealth, StreamingTarget,
};
use rusqlite::{params, Connection, OptionalExtension};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::Instant;

pub struct StationCore {
    db_path: PathBuf,
    media_dir: PathBuf,
    conn: Connection,
    pub mixer: StationMixer,
}

impl StationCore {
    pub fn open(base_dir: &Path) -> Result<Self, String> {
        let started_at = Instant::now();
        fs::create_dir_all(base_dir).map_err(|error| error.to_string())?;
        let media_dir = base_dir.join("media");
        fs::create_dir_all(&media_dir).map_err(|error| error.to_string())?;
        let db_path = base_dir.join("station.sqlite3");
        let conn = Connection::open(&db_path).map_err(|error| error.to_string())?;
        let core = Self {
            db_path,
            media_dir,
            conn,
            mixer: StationMixer::default(),
        };
        core.migrate()?;
        log::info!(
            "station_core_open db={} media={} elapsed_ms={}",
            core.db_path.display(),
            core.media_dir.display(),
            started_at.elapsed().as_millis()
        );
        Ok(core)
    }

    pub fn health(&self) -> StationHealth {
        StationHealth {
            ok: true,
            app_mode: "station".to_string(),
            audio_backend: if cfg!(target_os = "windows") {
                "CPAL/ASIO"
            } else {
                "development-placeholder"
            }
            .to_string(),
            db_path: self.db_path.display().to_string(),
            media_dir: self.media_dir.display().to_string(),
        }
    }

    fn migrate(&self) -> Result<(), String> {
        self.conn
            .execute_batch(
                r#"
                PRAGMA foreign_keys = ON;

                CREATE TABLE IF NOT EXISTS station_assets (
                  id TEXT PRIMARY KEY NOT NULL,
                  file_name TEXT NOT NULL,
                  title TEXT NOT NULL,
                  mime_type TEXT NOT NULL,
                  size INTEGER NOT NULL,
                  last_modified INTEGER NOT NULL,
                  duration_sec REAL NOT NULL,
                  blob_key TEXT NOT NULL UNIQUE,
                  artwork TEXT,
                  artist TEXT,
                  album TEXT,
                  tags_json TEXT,
                  file_handle TEXT,
                  audio_class TEXT NOT NULL,
                  UNIQUE(file_name, size, last_modified)
                );

                CREATE TABLE IF NOT EXISTS cart_slots (
                  slot_index INTEGER PRIMARY KEY NOT NULL,
                  asset_id TEXT,
                  label TEXT NOT NULL,
                  color TEXT NOT NULL,
                  hotkey TEXT
                );

                CREATE TABLE IF NOT EXISTS scheduler_events (
                  id TEXT PRIMARY KEY NOT NULL,
                  name TEXT NOT NULL,
                  asset_id TEXT NOT NULL,
                  time TEXT NOT NULL,
                  days_json TEXT NOT NULL,
                  mode TEXT NOT NULL,
                  enabled INTEGER NOT NULL,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS crossfade_profiles (
                  audio_class TEXT PRIMARY KEY NOT NULL,
                  mix_point_sec REAL NOT NULL,
                  fade_in_sec REAL NOT NULL,
                  fade_out_sec REAL NOT NULL,
                  curve TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS playback_settings (
                  id TEXT PRIMARY KEY NOT NULL,
                  settings_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS mic_settings (
                  id TEXT PRIMARY KEY NOT NULL,
                  settings_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS runtime_state (
                  id TEXT PRIMARY KEY NOT NULL,
                  state_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS low_resource_settings (
                  id TEXT PRIMARY KEY NOT NULL,
                  settings_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS streaming_targets (
                  id TEXT PRIMARY KEY NOT NULL,
                  platform TEXT NOT NULL,
                  enabled INTEGER NOT NULL,
                  target_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS software_update_settings (
                  id TEXT PRIMARY KEY NOT NULL,
                  settings_json TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_station_assets_title_class
                  ON station_assets(title COLLATE NOCASE, audio_class);
                CREATE INDEX IF NOT EXISTS idx_station_assets_signature
                  ON station_assets(file_name, size, last_modified);
                CREATE INDEX IF NOT EXISTS idx_scheduler_events_enabled_time
                  ON scheduler_events(enabled, time);
                CREATE INDEX IF NOT EXISTS idx_cart_slots_asset
                  ON cart_slots(asset_id);
                CREATE INDEX IF NOT EXISTS idx_streaming_targets_platform_enabled
                  ON streaming_targets(platform, enabled);
                "#,
            )
            .map_err(|error| error.to_string())
    }

    pub fn import_asset(
        &self,
        mut asset: LocalAudioAsset,
        bytes: &[u8],
    ) -> Result<LocalAudioAsset, String> {
        let started_at = Instant::now();
        if !is_supported_audio_asset(&asset) {
            return Err("Unsupported audio format".to_string());
        }
        if let Some(existing) =
            self.find_duplicate_asset(&asset.file_name, asset.size, asset.last_modified)?
        {
            log::info!(
                "station_import_asset_duplicate file={} size={} elapsed_ms={}",
                asset.file_name,
                asset.size,
                started_at.elapsed().as_millis()
            );
            return Ok(existing);
        }
        let safe_name = safe_file_name(&asset.file_name);
        let safe_id = safe_file_name(&asset.id);
        asset.blob_key = format!("{}-{}", safe_id, safe_name);
        let media_path = self.media_path_for_blob_key(&asset.blob_key)?;
        fs::write(media_path, bytes).map_err(|error| error.to_string())?;
        self.upsert_asset(&asset)?;
        log::info!(
            "station_import_asset file={} size={} elapsed_ms={}",
            asset.file_name,
            asset.size,
            started_at.elapsed().as_millis()
        );
        Ok(asset)
    }

    pub fn list_assets(&self) -> Result<Vec<LocalAudioAsset>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, file_name, title, mime_type, size, last_modified, duration_sec,
                        blob_key, artwork, artist, album, tags_json, file_handle, audio_class
                 FROM station_assets ORDER BY title COLLATE NOCASE, id",
            )
            .map_err(|error| error.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                let tags_json: Option<String> = row.get(11)?;
                Ok(LocalAudioAsset {
                    id: row.get(0)?,
                    file_name: row.get(1)?,
                    title: row.get(2)?,
                    mime_type: row.get(3)?,
                    size: row.get(4)?,
                    last_modified: row.get(5)?,
                    duration_sec: row.get(6)?,
                    blob_key: row.get(7)?,
                    artwork: row.get(8)?,
                    artist: row.get(9)?,
                    album: row.get(10)?,
                    tags: tags_json.and_then(|raw| serde_json::from_str(&raw).ok()),
                    file_handle: row.get(12)?,
                    audio_class: row.get(13)?,
                })
            })
            .map_err(|error| error.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }

    pub fn read_asset_blob(&self, blob_key: &str) -> Result<Vec<u8>, String> {
        let path = self.media_path_for_blob_key(blob_key)?;
        if !path.exists() {
            return Ok(Vec::new());
        }
        fs::read(path).map_err(|error| error.to_string())
    }

    pub fn delete_asset(&self, asset_id: &str, blob_key: &str) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM station_assets WHERE id = ?", [asset_id])
            .map_err(|error| error.to_string())?;
        let _ = fs::remove_file(self.media_path_for_blob_key(blob_key)?);
        Ok(())
    }

    pub fn save_cart_slots(&mut self, slots: &[CartSlotConfig]) -> Result<(), String> {
        let tx = self.conn.transaction().map_err(|error| error.to_string())?;
        for slot in slots {
            tx.execute(
                "INSERT INTO cart_slots (slot_index, asset_id, label, color, hotkey)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(slot_index) DO UPDATE SET
                   asset_id = excluded.asset_id,
                   label = excluded.label,
                   color = excluded.color,
                   hotkey = excluded.hotkey",
                params![
                    slot.slot_index,
                    slot.asset_id,
                    slot.label,
                    slot.color,
                    slot.hotkey
                ],
            )
            .map_err(|error| error.to_string())?;
        }
        tx.commit().map_err(|error| error.to_string())
    }

    pub fn list_cart_slots(&self) -> Result<Vec<CartSlotConfig>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT slot_index, asset_id, label, color, hotkey FROM cart_slots ORDER BY slot_index",
            )
            .map_err(|error| error.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(CartSlotConfig {
                    slot_index: row.get(0)?,
                    asset_id: row.get(1)?,
                    label: row.get(2)?,
                    color: row.get(3)?,
                    hotkey: row.get(4)?,
                })
            })
            .map_err(|error| error.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }

    pub fn save_scheduler_event(&self, event: &BroadcastSchedulerEvent) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT INTO scheduler_events (id, name, asset_id, time, days_json, mode, enabled, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   name = excluded.name,
                   asset_id = excluded.asset_id,
                   time = excluded.time,
                   days_json = excluded.days_json,
                   mode = excluded.mode,
                   enabled = excluded.enabled,
                   updated_at = excluded.updated_at",
                params![
                    event.id,
                    event.name,
                    event.asset_id,
                    event.time,
                    serde_json::to_string(&event.days_of_week).map_err(|error| error.to_string())?,
                    event.mode,
                    i64::from(event.enabled),
                    event.created_at,
                    event.updated_at
                ],
            )
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn list_scheduler_events(&self) -> Result<Vec<BroadcastSchedulerEvent>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, name, asset_id, time, days_json, mode, enabled, created_at, updated_at
                 FROM scheduler_events ORDER BY time, id",
            )
            .map_err(|error| error.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                let days_json: String = row.get(4)?;
                Ok(BroadcastSchedulerEvent {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    asset_id: row.get(2)?,
                    time: row.get(3)?,
                    days_of_week: serde_json::from_str(&days_json).unwrap_or_default(),
                    mode: row.get(5)?,
                    enabled: row.get::<_, i64>(6)? != 0,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })
            .map_err(|error| error.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }

    pub fn delete_scheduler_event(&self, event_id: &str) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM scheduler_events WHERE id = ?", [event_id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn save_crossfade_profiles(&mut self, profiles: &[CrossfadeProfile]) -> Result<(), String> {
        let tx = self.conn.transaction().map_err(|error| error.to_string())?;
        for profile in profiles {
            tx.execute(
                "INSERT INTO crossfade_profiles (audio_class, mix_point_sec, fade_in_sec, fade_out_sec, curve)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(audio_class) DO UPDATE SET
                   mix_point_sec = excluded.mix_point_sec,
                   fade_in_sec = excluded.fade_in_sec,
                   fade_out_sec = excluded.fade_out_sec,
                   curve = excluded.curve",
                params![
                    profile.audio_class,
                    profile.mix_point_sec,
                    profile.fade_in_sec,
                    profile.fade_out_sec,
                    profile.curve
                ],
            )
            .map_err(|error| error.to_string())?;
        }
        tx.commit().map_err(|error| error.to_string())
    }

    pub fn list_crossfade_profiles(&self) -> Result<Vec<CrossfadeProfile>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT audio_class, mix_point_sec, fade_in_sec, fade_out_sec, curve
                 FROM crossfade_profiles ORDER BY audio_class",
            )
            .map_err(|error| error.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(CrossfadeProfile {
                    audio_class: row.get(0)?,
                    mix_point_sec: row.get(1)?,
                    fade_in_sec: row.get(2)?,
                    fade_out_sec: row.get(3)?,
                    curve: row.get(4)?,
                })
            })
            .map_err(|error| error.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }

    pub fn load_playback_settings(&self) -> Result<Option<PlaybackRoutingSettings>, String> {
        self.load_json_record(JsonRecordKind::PlaybackSettings)
    }

    pub fn save_playback_settings(&self, settings: &PlaybackRoutingSettings) -> Result<(), String> {
        self.save_json_record(JsonRecordKind::PlaybackSettings, settings)
    }

    pub fn load_mic_settings(&self) -> Result<Option<MicSettings>, String> {
        self.load_json_record(JsonRecordKind::MicSettings)
    }

    pub fn save_mic_settings(&self, settings: &MicSettings) -> Result<(), String> {
        self.save_json_record(JsonRecordKind::MicSettings, settings)
    }

    pub fn load_low_resource_settings(&self) -> Result<Option<LowResourceSettings>, String> {
        self.load_json_record(JsonRecordKind::LowResourceSettings)
    }

    pub fn save_low_resource_settings(&self, settings: &LowResourceSettings) -> Result<(), String> {
        self.save_json_record(JsonRecordKind::LowResourceSettings, settings)
    }

    pub fn save_streaming_target(&self, target: &StreamingTarget) -> Result<(), String> {
        let json = serde_json::to_string(target).map_err(|error| error.to_string())?;
        self.conn
            .execute(
                "INSERT INTO streaming_targets (id, platform, enabled, target_json)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   platform = excluded.platform,
                   enabled = excluded.enabled,
                   target_json = excluded.target_json",
                params![target.id, target.platform, i64::from(target.enabled), json],
            )
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn list_streaming_targets(&self) -> Result<Vec<StreamingTarget>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT target_json FROM streaming_targets ORDER BY platform, id")
            .map_err(|error| error.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| error.to_string())?;
        rows.map(|row| {
            row.map_err(|error| error.to_string())
                .and_then(|raw| serde_json::from_str(&raw).map_err(|error| error.to_string()))
        })
        .collect()
    }

    pub fn delete_streaming_target(&self, target_id: &str) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM streaming_targets WHERE id = ?", [target_id])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn load_software_update_settings(&self) -> Result<Option<SoftwareUpdateSettings>, String> {
        self.load_json_record(JsonRecordKind::SoftwareUpdateSettings)
    }

    pub fn save_software_update_settings(
        &self,
        settings: &SoftwareUpdateSettings,
    ) -> Result<(), String> {
        self.save_json_record(JsonRecordKind::SoftwareUpdateSettings, settings)
    }

    pub fn load_runtime_state(&self) -> Result<Option<RuntimeStateRecord>, String> {
        self.load_json_record(JsonRecordKind::RuntimeState)
    }

    pub fn save_runtime_state(&self, state: &RuntimeStateRecord) -> Result<(), String> {
        self.save_json_record(JsonRecordKind::RuntimeState, state)
    }

    fn save_json_record<T: serde::Serialize>(
        &self,
        kind: JsonRecordKind,
        value: &T,
    ) -> Result<(), String> {
        let json = serde_json::to_string(value).map_err(|error| error.to_string())?;
        let (id, sql) = kind.save_statement();
        self.conn
            .execute(sql, params![id, json])
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    fn load_json_record<T: serde::de::DeserializeOwned>(
        &self,
        kind: JsonRecordKind,
    ) -> Result<Option<T>, String> {
        let (id, sql) = kind.load_statement();
        let raw: Option<String> = self
            .conn
            .query_row(sql, [id], |row| row.get(0))
            .optional()
            .map_err(|error| error.to_string())?;
        raw.map(|value| serde_json::from_str(&value).map_err(|error| error.to_string()))
            .transpose()
    }

    fn upsert_asset(&self, asset: &LocalAudioAsset) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT INTO station_assets
                 (id, file_name, title, mime_type, size, last_modified, duration_sec, blob_key,
                  artwork, artist, album, tags_json, file_handle, audio_class)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   file_name = excluded.file_name,
                   title = excluded.title,
                   mime_type = excluded.mime_type,
                   size = excluded.size,
                   last_modified = excluded.last_modified,
                   duration_sec = excluded.duration_sec,
                   blob_key = excluded.blob_key,
                   artwork = excluded.artwork,
                   artist = excluded.artist,
                   album = excluded.album,
                   tags_json = excluded.tags_json,
                   file_handle = excluded.file_handle,
                   audio_class = excluded.audio_class",
                params![
                    asset.id,
                    asset.file_name,
                    asset.title,
                    asset.mime_type,
                    asset.size,
                    asset.last_modified,
                    asset.duration_sec,
                    asset.blob_key,
                    asset.artwork,
                    asset.artist,
                    asset.album,
                    serde_json::to_string(&asset.tags).map_err(|error| error.to_string())?,
                    asset.file_handle,
                    asset.audio_class
                ],
            )
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    fn find_duplicate_asset(
        &self,
        file_name: &str,
        size: i64,
        last_modified: i64,
    ) -> Result<Option<LocalAudioAsset>, String> {
        self.conn
            .query_row(
                "SELECT id, file_name, title, mime_type, size, last_modified, duration_sec,
                        blob_key, artwork, artist, album, tags_json, file_handle, audio_class
                 FROM station_assets
                 WHERE file_name = ? AND size = ? AND last_modified = ?
                 LIMIT 1",
                params![file_name, size, last_modified],
                map_asset_row,
            )
            .optional()
            .map_err(|error| error.to_string())
    }

    fn media_path_for_blob_key(&self, blob_key: &str) -> Result<PathBuf, String> {
        if blob_key.is_empty() || blob_key.contains(['/', '\\']) {
            return Err("Invalid media blob key".to_string());
        }

        let mut components = Path::new(blob_key).components();
        let Some(Component::Normal(file_name)) = components.next() else {
            return Err("Invalid media blob key".to_string());
        };
        if components.next().is_some() {
            return Err("Invalid media blob key".to_string());
        }

        let Some(file_name) = file_name.to_str() else {
            return Err("Invalid media blob key".to_string());
        };
        if file_name == "." || file_name == ".." {
            return Err("Invalid media blob key".to_string());
        }

        Ok(self.media_dir.join(file_name))
    }
}

#[derive(Clone, Copy)]
enum JsonRecordKind {
    PlaybackSettings,
    MicSettings,
    LowResourceSettings,
    SoftwareUpdateSettings,
    RuntimeState,
}

impl JsonRecordKind {
    fn save_statement(self) -> (&'static str, &'static str) {
        match self {
            Self::PlaybackSettings => (
                "playback",
                "INSERT INTO playback_settings (id, settings_json) VALUES (?, ?)
                 ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json",
            ),
            Self::MicSettings => (
                "mic",
                "INSERT INTO mic_settings (id, settings_json) VALUES (?, ?)
                 ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json",
            ),
            Self::LowResourceSettings => (
                "low-resource",
                "INSERT INTO low_resource_settings (id, settings_json) VALUES (?, ?)
                 ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json",
            ),
            Self::SoftwareUpdateSettings => (
                "software-updates",
                "INSERT INTO software_update_settings (id, settings_json) VALUES (?, ?)
                 ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json",
            ),
            Self::RuntimeState => (
                "runtime",
                "INSERT INTO runtime_state (id, state_json) VALUES (?, ?)
                 ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json",
            ),
        }
    }

    fn load_statement(self) -> (&'static str, &'static str) {
        match self {
            Self::PlaybackSettings => (
                "playback",
                "SELECT settings_json FROM playback_settings WHERE id = ? LIMIT 1",
            ),
            Self::MicSettings => (
                "mic",
                "SELECT settings_json FROM mic_settings WHERE id = ? LIMIT 1",
            ),
            Self::LowResourceSettings => (
                "low-resource",
                "SELECT settings_json FROM low_resource_settings WHERE id = ? LIMIT 1",
            ),
            Self::SoftwareUpdateSettings => (
                "software-updates",
                "SELECT settings_json FROM software_update_settings WHERE id = ? LIMIT 1",
            ),
            Self::RuntimeState => (
                "runtime",
                "SELECT state_json FROM runtime_state WHERE id = ? LIMIT 1",
            ),
        }
    }
}

fn map_asset_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<LocalAudioAsset> {
    let tags_json: Option<String> = row.get(11)?;
    Ok(LocalAudioAsset {
        id: row.get(0)?,
        file_name: row.get(1)?,
        title: row.get(2)?,
        mime_type: row.get(3)?,
        size: row.get(4)?,
        last_modified: row.get(5)?,
        duration_sec: row.get(6)?,
        blob_key: row.get(7)?,
        artwork: row.get(8)?,
        artist: row.get(9)?,
        album: row.get(10)?,
        tags: tags_json.and_then(|raw| serde_json::from_str(&raw).ok()),
        file_handle: row.get(12)?,
        audio_class: row.get(13)?,
    })
}

fn safe_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches('_');
    if trimmed.is_empty() {
        "audio.bin".to_string()
    } else {
        trimmed.chars().take(120).collect()
    }
}

fn is_supported_audio_asset(asset: &LocalAudioAsset) -> bool {
    const SUPPORTED_EXTENSIONS: &[&str] = &[
        ".mp3", ".mpeg", ".mpga", ".wav", ".wave", ".flac", ".m4a", ".aac", ".ogg", ".oga",
        ".opus", ".webm", ".aiff", ".aif",
    ];

    if asset.mime_type.to_ascii_lowercase().starts_with("audio/") {
        return true;
    }

    let file_name = asset.file_name.to_ascii_lowercase();
    SUPPORTED_EXTENSIONS
        .iter()
        .any(|extension| file_name.ends_with(extension))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn asset(id: &str) -> LocalAudioAsset {
        LocalAudioAsset {
            id: id.into(),
            file_name: "tone.wav".into(),
            title: "Tone".into(),
            mime_type: "audio/wav".into(),
            size: 4,
            last_modified: 123,
            duration_sec: 1.0,
            blob_key: String::new(),
            artwork: None,
            artist: None,
            album: None,
            tags: Some(vec!["test".into()]),
            file_handle: None,
            audio_class: "music".into(),
        }
    }

    #[test]
    fn migrations_create_station_database() {
        let dir = tempdir().unwrap();
        let core = StationCore::open(dir.path()).unwrap();
        assert!(core.health().ok);
        assert!(core.health().db_path.ends_with("station.sqlite3"));

        let index_count: i64 = core
            .conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'index'
                   AND name IN (
                     'idx_station_assets_title_class',
                     'idx_station_assets_signature',
                     'idx_scheduler_events_enabled_time',
                     'idx_cart_slots_asset',
                     'idx_streaming_targets_platform_enabled'
                   )",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(index_count, 5);

        let update_table_count: i64 = core
            .conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'table'
                   AND name = 'software_update_settings'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(update_table_count, 1);
    }

    #[test]
    fn import_asset_copies_media_and_dedupes_same_file_signature() {
        let dir = tempdir().unwrap();
        let core = StationCore::open(dir.path()).unwrap();
        let first = core.import_asset(asset("asset-1"), &[1, 2, 3, 4]).unwrap();
        let second = core.import_asset(asset("asset-2"), &[9, 9, 9, 9]).unwrap();
        let all = core.list_assets().unwrap();

        assert_eq!(first.id, second.id);
        assert_eq!(all.len(), 1);
        assert_eq!(
            core.read_asset_blob(&first.blob_key).unwrap(),
            vec![1, 2, 3, 4]
        );
    }

    #[test]
    fn asset_blob_keys_cannot_traverse_outside_media_dir() {
        let dir = tempdir().unwrap();
        let core = StationCore::open(dir.path()).unwrap();

        assert!(core.read_asset_blob("../station.sqlite3").is_err());
        assert!(core.delete_asset("asset-1", "../station.sqlite3").is_err());
        assert!(core.health().db_path.ends_with("station.sqlite3"));
        assert!(Path::new(&core.health().db_path).exists());
    }

    #[test]
    fn import_asset_sanitizes_client_controlled_id_before_media_path() {
        let dir = tempdir().unwrap();
        let core = StationCore::open(dir.path()).unwrap();
        let imported = core
            .import_asset(asset("../escape/asset-1"), &[1, 2, 3, 4])
            .unwrap();

        assert!(!imported.blob_key.contains('/'));
        assert!(!imported.blob_key.contains('\\'));
        assert_eq!(
            core.read_asset_blob(&imported.blob_key).unwrap(),
            vec![1, 2, 3, 4]
        );
    }

    #[test]
    fn import_asset_rejects_unsupported_media_type_at_native_boundary() {
        let dir = tempdir().unwrap();
        let core = StationCore::open(dir.path()).unwrap();
        let mut html = asset("asset-html");
        html.file_name = "payload.html".into();
        html.mime_type = "text/html".into();

        assert_eq!(
            core.import_asset(html, b"<script>alert(1)</script>")
                .unwrap_err(),
            "Unsupported audio format"
        );
        assert!(core.list_assets().unwrap().is_empty());
    }

    #[test]
    fn cart_slots_persist_in_slot_order() {
        let dir = tempdir().unwrap();
        let mut core = StationCore::open(dir.path()).unwrap();
        core.save_cart_slots(&[
            CartSlotConfig {
                slot_index: 1,
                asset_id: Some("asset-b".into()),
                label: "B".into(),
                color: "blue".into(),
                hotkey: Some("2".into()),
            },
            CartSlotConfig {
                slot_index: 0,
                asset_id: Some("asset-a".into()),
                label: "A".into(),
                color: "green".into(),
                hotkey: Some("1".into()),
            },
        ])
        .unwrap();

        let slots = core.list_cart_slots().unwrap();
        assert_eq!(slots[0].slot_index, 0);
        assert_eq!(slots[1].slot_index, 1);
    }

    #[test]
    fn json_settings_round_trip_through_static_statements() {
        let dir = tempdir().unwrap();
        let core = StationCore::open(dir.path()).unwrap();
        let playback = PlaybackRoutingSettings {
            mode: "station".into(),
            on_air_volume: 0.8,
            monitor_volume: 0.4,
            preview_enabled: true,
            driver_label: "ASIO".into(),
            main_output_label: "1/2".into(),
            monitor_output_label: "3/4".into(),
        };
        let runtime = RuntimeStateRecord {
            id: "runtime".into(),
            pending_event_ids: vec!["event-1".into()],
            last_fired_keys: std::collections::HashMap::from([(
                "event-1".into(),
                "2026-05-31T12:00:00".into(),
            )]),
        };
        let low_resource = LowResourceSettings {
            enabled: true,
            reduce_motion: true,
            simple_surfaces: true,
            vu_fps: 15,
            import_batch_size: 8,
            skip_import_duration_scan: true,
            stable_audio_buffer_frames: 1024,
            suspend_background_work_on_air: true,
        };
        let updates = SoftwareUpdateSettings {
            auto_check_enabled: true,
            auto_download_and_install: false,
            channel: "stable".into(),
            last_checked_at: Some("2026-05-31T00:00:00Z".into()),
            last_available_version: Some("0.2.0".into()),
            last_installed_version: None,
            status: "available".into(),
            last_error: None,
        };

        core.save_playback_settings(&playback).unwrap();
        core.save_low_resource_settings(&low_resource).unwrap();
        core.save_software_update_settings(&updates).unwrap();
        core.save_runtime_state(&runtime).unwrap();

        assert_eq!(core.load_playback_settings().unwrap(), Some(playback));
        assert_eq!(
            core.load_low_resource_settings().unwrap(),
            Some(low_resource)
        );
        assert_eq!(core.load_software_update_settings().unwrap(), Some(updates));
        assert_eq!(core.load_runtime_state().unwrap(), Some(runtime));
    }

    #[test]
    fn streaming_targets_persist_and_delete() {
        let dir = tempdir().unwrap();
        let core = StationCore::open(dir.path()).unwrap();
        let target = StreamingTarget {
            id: "stream-1".into(),
            name: "YouTube Live".into(),
            platform: "youtube".into(),
            server_url: "rtmps://a.rtmps.youtube.com/live2".into(),
            stream_key: "secret".into(),
            enabled: true,
            protocol: "rtmps".into(),
            audio_bitrate_kbps: 160,
            video_mode: "audio-slate".into(),
            status: "idle".into(),
            last_error: None,
            updated_at: "2026-05-31T00:00:00Z".into(),
        };

        core.save_streaming_target(&target).unwrap();
        assert_eq!(core.list_streaming_targets().unwrap(), vec![target]);

        core.delete_streaming_target("stream-1").unwrap();
        assert!(core.list_streaming_targets().unwrap().is_empty());
    }
}
