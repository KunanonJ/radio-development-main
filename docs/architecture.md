# Architecture

Urban Radio is split into two runtime lanes: browser/cloud mode and Windows station mode. The UI is shared; persistence and audio responsibilities change by runtime.

## Runtime Map

```text
Next.js App Router UI
  |
  |-- Browser mode
  |     |-- IndexedDB local broadcast repository
  |     |-- Web Audio playback path
  |     |-- Cloudflare/Firebase paths remain available
  |
  |-- Station mode
        |-- Tauri command bridge
        |-- Rust station core
        |-- SQLite app-local database
        |-- Local media folder
        |-- Native device discovery and mixer state
```

## Frontend

- `src/app/`: Next.js App Router routes.
- `src/views/`: page-level station and library screens.
- `src/components/`: app chrome, player, station bridge, UI primitives.
- `src/lib/local-broadcast-store.ts`: Zustand state for station workflows.
- `src/lib/station/`: Tauri adapter, station client, station repository, updater bridge.

## Station Native Core

- `src-tauri/src/station/core.rs`: SQLite, local media, migrations, import/read/delete, settings persistence.
- `src-tauri/src/station/commands.rs`: Tauri command boundary.
- `src-tauri/src/station/audio.rs`: native mixer state and device discovery.
- `src-tauri/src/station/scheduler.rs`: scheduler matching helpers.
- `src-tauri/tauri.conf.json`: desktop shell, installer, Windows WebView handling.

## Data Stores

Station SQLite tables:

- `station_assets`
- `cart_slots`
- `scheduler_events`
- `crossfade_profiles`
- `playback_settings`
- `mic_settings`
- `runtime_state`
- `low_resource_settings`
- `streaming_targets`
- `software_update_settings`

Browser mode mirrors these through IndexedDB where practical.

## Security Boundaries

- UI validation is not enough. Tauri/Rust validates native file paths and media formats.
- Stream-key inputs reject CR/LF and managed platform targets require RTMPS.
- Update installs use Tauri signed updater flow and channel-safe pending update caching.
- Tauri capabilities expose core/log, updater, and process restart only where needed.

## Update Flow

```text
Settings > Updates
  |
  |-- Check for updates
  |     |-- Tauri updater checks signed manifest
  |
  |-- Install update
        |-- Guard: program audio must be stopped
        |-- Download and install signed update
        |-- Relaunch app
```

## Production Gaps

- Native decode/playback/mixer callback.
- ASIO channel routing acceptance on real Windows hardware.
- Native RTMP/RTMPS encoder.
- OS credential storage for stream keys.
- Signed update endpoint and CI release signing.
- Production CSP for Tauri static export.
