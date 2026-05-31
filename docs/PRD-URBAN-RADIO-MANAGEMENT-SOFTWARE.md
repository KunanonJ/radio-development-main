# PRD: Urban Radio Management Software

# Executive Summary

Urban Radio Management Software is a Windows-first radio station application for local broadcast operation. It keeps the existing browser/cloud app available, while adding a Tauri station runtime for dedicated Windows PCs that need offline operation, local media persistence, low-resource performance controls, native station integration points, online broadcast target configuration, and signed software updates.

# Business Goals

- Let a station operator run a broadcast console from a dedicated Windows 10/11 x64 PC.
- Keep core station operation available without internet.
- Make imported music, carts, scheduler events, routing, mic settings, and runtime state durable across restarts.
- Support older or low-resource PCs through reduced visual and background workload options.
- Prepare online radio casting to YouTube Live, Facebook Live, and custom RTMP/RTMPS targets.
- Allow operators to check for and install new software versions themselves, with optional automatic update checks.

# Users

- Station operator: runs the on-air console, carts, schedules, mic, and playback.
- Station technician: configures audio devices, routing, updates, and Windows station hardware.
- Product/admin owner: packages releases and manages update delivery.

# Developed Feature Summary

## Windows Station Runtime

- Tauri v2 desktop shell under `src-tauri/`.
- Windows x64 target as the first station build target.
- Station scripts: `station:dev`, `station:build`, `station:test`, and `station:verify`.
- Station mode opens the existing broadcast app route and keeps browser/cloud mode intact.
- Native command bridge between Next.js UI and Rust station core.

## Local Library And SQLite Persistence

- Local SQLite database in Tauri app-local data.
- Local media folder for imported audio assets.
- Station tables for assets, carts, scheduler events, crossfade profiles, playback routing, mic settings, runtime state, low-resource settings, streaming targets, and software update settings.
- Import dedupe by file signature.
- Missing-file tolerant asset reads.

## Audio Format Intake

- Shared browser/station accept list for common broadcast formats.
- Supported imports include MP3, MPEG/MPGA, WAV/WAVE, FLAC, M4A, AAC, OGG/OGA, Opus, WebM audio, AIFF/AIF.

## Station Bridge And Native State

- TypeScript station client wraps Tauri commands/events.
- Station mode delegates library, cart, scheduler, runtime, device, and settings operations to Tauri.
- Browser mode continues using IndexedDB/Web Audio paths.
- Rust station core includes SQLite migrations, scheduler helpers, audio device discovery, and mixer state primitives.

## Low-Resource Mode

- Operator controls for low-resource mode in playback settings.
- Reduced motion and simplified surfaces.
- Configurable VU FPS.
- Import batching.
- Optional duration-scan skipping.
- Optional background import pause while on-air.
- Stable audio buffer frame preference.

## Online Broadcast Target Configuration

- Settings UI for YouTube Live, Facebook Live, and custom RTMP/RTMPS targets.
- Per-target name, platform, server URL, stream key, bitrate, enabled state, protocol, and status.
- Persistence in browser IndexedDB and station SQLite.
- Current scope is configuration and validation. Native RTMP/RTMPS encoder delivery remains a production backlog item.

## Software Updates

- Settings UI for manual update checks and manual install.
- Stable/Beta release channel selection.
- Automatic update check preference.
- Optional automatic install preference.
- Signed Tauri updater plugin wiring.
- Process relaunch wiring after successful install.
- On-air guard prevents automatic install while program audio is playing.
- Update preferences and last status persist locally.

# Non-Goals For Current Slice

- Hardware-certified full ASIO mixer and channel-accurate playback.
- Native RTMP/RTMPS encoder and actual live stream push.
- Cloud sync or remote station management.
- Replacing the existing browser/cloud app.
- Shipping update signing secrets in the repo.

# Functional Requirements

- The app must run in browser mode without Tauri.
- Station mode must fail visibly when the Tauri backend is unavailable.
- Imported audio must persist locally and dedupe repeated imports.
- Cart slots and scheduler events must survive app restart.
- Low-resource mode must reduce rendering/background work without disabling core station controls.
- Streaming targets must validate platform/server/key inputs before use by the future encoder.
- Update checks must fail closed when the app is not in station mode or when the update endpoint is not configured.
- Update install must not proceed while program audio is on-air.

# Security Requirements

- No updater private key, stream key, API token, or credential may be hardcoded.
- Tauri capabilities must expose only required permissions.
- Signed update artifacts are required for production updates.
- Platform broadcast targets should prefer RTMPS and reject obviously invalid server URLs.
- File imports must restrict accepted media formats and avoid executing or rendering imported content.
- Local persistence errors must be visible to operators.

# Acceptance Criteria

- `npm run verify` passes.
- `npm run station:verify` passes.
- Rust tests cover SQLite migrations and persistence.
- Vitest covers station command contracts, updater behavior, and validation helpers.
- Playwright covers mocked station-mode UI for console, carts, scheduler, settings, and updates.
- Windows acceptance checklist verifies offline install, local persistence, update controls, and hardware routing once Windows hardware is available.

# Production Backlog

- Keep GitHub, package, installer, and product metadata aligned with Urban Radio Management Software.
- Implement native playback/decode/mixer pipeline.
- Implement native RTMP/RTMPS encoder and stream health telemetry.
- Add secure OS credential storage for stream keys.
- Add signed update endpoint, CI release signing, and update manifest publishing.
- Complete Windows hardware acceptance on clean Windows 10/11 x64 station PCs.
