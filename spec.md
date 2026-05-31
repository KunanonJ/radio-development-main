# Executive Summary
Sonic Bloom will gain a Windows-first station runtime while preserving the existing Next.js browser/cloud app. The station runtime runs inside a Tauri v2 shell, stores its library and operational state locally, and routes station-mode operations through a native Rust backend.

# Business Goals
- Allow a dedicated Windows station PC to run the broadcast console without internet.
- Keep imported audio, carts, scheduler state, routing preferences, and runtime recovery local and durable.
- Preserve the current web app so Cloudflare/Firebase paths can continue independently.

# Technical Goals
- Add a Tauri v2 shell under `src-tauri/` for Windows x64.
- Add a Rust station core with SQLite metadata, copied media files, scheduler helpers, device discovery, and mixer state.
- Add a TypeScript station bridge for Tauri commands and events.
- Add signed station software updates with manual checks and an operator-controlled automatic update option.
- Keep browser mode on IndexedDB and Web Audio; use station mode only when running in Tauri or with `NEXT_PUBLIC_STATION_MODE=true`.

# Requirements
- Station mode defaults to `/app` and the existing broadcast console.
- Local media files are copied into a station media folder and indexed in SQLite.
- Native commands cover health, library import/read/delete, cart config, scheduler events, profiles, playback routing, mic settings, runtime state, device listing, and transport state.
- Station settings allow an operator to check for updates manually, install an available signed update, and enable automatic update checks.
- Automatic update installation must not start while program audio is on-air.
- ASIO support is enabled for Windows builds through CPAL.
- Installer configuration must support offline-capable WebView2 handling.

# Non-Goals
- Replacing the browser/cloud app.
- Shipping a finalized hardware-certified ASIO mixer in this first implementation slice.
- Cloud sync, account sync, or remote station management.
- Changing Cloudflare Pages deployment.

# Architecture
- UI: existing Next.js App Router UI.
- Station bridge: `src/lib/station/*` wraps Tauri `invoke` and `listen`.
- Local repository: browser mode uses IndexedDB; station mode delegates to Tauri commands.
- Native core: `src-tauri/src/station/*` owns SQLite, media files, scheduler helpers, audio device discovery, and mixer state.
- Tauri shell: `src-tauri/tauri.conf.json` uses `npm run station:web:dev` for dev and `npm run station:web:build` for production frontend output.

# Data Models
- `station_assets`: local audio metadata plus copied media key.
- `cart_slots`: 12 configurable instant-fire slots.
- `scheduler_events`: recurring timed station events.
- `crossfade_profiles`: per-audio-class crossfade defaults.
- `playback_settings`: selected driver/device labels and gains.
- `mic_settings`: input device, mode, ducking, sample rate, enabled state.
- `runtime_state`: pending scheduler and fired-key recovery state.
- `software_update_settings`: update channel, automatic check/install preference, last check result, and last error.

# API Contracts
- Tauri commands use snake_case command names and camelCase JSON payloads.
- Station events use `station:transport`, `station:vu`, `station:scheduler-fire`, `station:device-change`, `station:engine-error`, and `station:persistence-error`.
- Updater actions use the signed Tauri updater plugin; local preferences are persisted through station repository commands.
- Browser mode does not call Tauri commands.

# Security
- Update packages must be signed by the configured Tauri updater private key. The private key must stay outside the repo and live in CI/release secrets.
- Stream keys and update signing keys must not be hardcoded.
- Imported files remain on the local station PC.
- Tauri capabilities are restricted to the main app window and declared command permissions.
- ASIO SDK distribution remains GPL-compatible per the accepted assumption.

# Edge Cases
- Missing IndexedDB or Tauri backend returns a visible hydration error.
- Duplicate imports are deduped by file name, size, and last-modified timestamp.
- Missing copied media returns a null blob in the TypeScript repository.
- Single-output devices keep preview disabled until a monitor route exists.
- Scheduler events do not double-fire within the same local second.
- Update checks fail closed with a visible error when the app is not running in station mode or the update endpoint/signing key is not configured.
- Automatic update installation is skipped while on-air and retried on the next operator/manual check.

# Testing Strategy
- Vitest covers station-mode detection, command naming, repository behavior, and event subscriptions through a mocked Tauri adapter.
- Rust tests cover migrations, import dedupe, cart persistence, scheduler matching, and mixer state.
- Existing Playwright tests remain browser-mode checks.
- Hardware acceptance on Windows verifies ASIO devices and installer behavior.

# Rollback Plan
- Disable station mode by not setting `NEXT_PUBLIC_STATION_MODE` and not running through Tauri.
- Existing Next.js browser mode and Cloudflare/Firebase files remain intact.
- Remove `src-tauri/`, station scripts, and `src/lib/station/` if the feature must be reverted.

# Milestones
- Milestone 1: Add spec, tests, Tauri scaffold, station scripts.
- Milestone 2: Add local SQLite/media repository and TypeScript station bridge.
- Milestone 3: Add native audio device/mixer state with Windows ASIO feature gate.
- Milestone 4: Add installer hardening and Windows acceptance runbook.
- Milestone 5: Add signed update checks, manual install flow, and automatic update preference.

# Epics
- Station shell: Tauri v2 app, station-mode frontend build, offline installer.
- Local persistence: SQLite migrations, media folder copy, repository bridge.
- Native audio: device discovery, mixer state, ASIO target support, future audio callback implementation.
- Operator reliability: logs, single instance, state restore, health checks.
- Software updates: signed manifest publishing, manual check/install controls, safe automatic update checks.

# User Stories
- As an operator, I want to import local audio into the station PC so the show can run offline.
- As an operator, I want carts and schedules to persist after reboot so live operations recover safely.
- As an engineer, I want browser mode and station mode isolated so cloud deployment does not regress.
- As a station technician, I want device diagnostics before going on air so routing can be validated.
- As an operator, I want to update the station software myself or enable automatic update checks so the station can stay current without engineering support.

# Tasks
- Add station scripts and Tauri dependencies.
- Add Tauri scaffold and command permissions.
- Add Rust SQLite/media core and tests.
- Add TS station client/repository and tests.
- Route station mode away from the Web Audio engine.
- Add Windows installer configuration.
- Add software update settings, updater plugin wiring, and operator update UI.

# Acceptance Criteria
- `npm run station:test` runs station Vitest tests and Rust tests.
- Existing browser mode still starts with `npm run dev`.
- Station build config does not change regular `npm run build` semantics.
- Rust tests pass without requiring Windows or ASIO hardware.
- Windows builds include ASIO-enabled CPAL only on Windows targets.
- Software update settings persist locally, manual checks surface available/no-update/error states, and automatic installs are guarded while on-air.
