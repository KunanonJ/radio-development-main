# Windows Station Test Checklist

Use this checklist for the first Windows 10/11 x64 station PC validation.

## Prerequisites

- Windows 10/11 x64 with current system updates.
- Microsoft Edge WebView2 runtime available or installable from the offline Tauri installer bundle.
- Rust/MSVC toolchain and Tauri Windows prerequisites installed for development builds.
- Station audio interface driver installed before launching Urban Radio Station.
- If testing ASIO, confirm the ASIO SDK/license distribution requirements are satisfied for the build.

## Build Verification

Run from the repo root:

```bash
npm ci
npm run station:verify
npm run station:build
```

Expected:

- `station:verify` passes Vitest station bridge tests, Rust tests, and Next static export.
- `station:build` produces a Windows x64 installer bundle.
- The installer runs without internet access on a clean station PC.
- Release builds use a signed updater artifact and publish a matching update manifest over HTTPS.

## Runtime Smoke

1. Install Urban Radio Station.
2. Launch the app with no internet connection.
3. Confirm the app opens directly to `/app`.
4. Confirm only one app instance can run; launching again focuses the existing window.
5. Open Settings > Playback and confirm the station audio interface is listed.
6. Open Settings > Updates and confirm manual update controls are visible.
7. Confirm app-local data contains `station.sqlite3` and a `media/` folder after first import.

## Library Persistence

1. Import at least 100 WAV/MP3/FLAC/AAC files.
2. Confirm duplicate imports are skipped by file signature.
3. Close and reopen the app.
4. Confirm the library, queue, cart slots, scheduler events, playback settings, mic settings, and runtime state restore.
5. Remove one imported file outside the app and confirm the UI handles the missing media without crashing.

## Software Updates

1. Open Settings > Updates.
2. Confirm manual check reports no update, available update, or a visible configuration/network error.
3. Enable automatic update checks, close, and reopen the app.
4. Confirm the preference persists after restart.
5. With program audio stopped, install a signed test update and confirm the app relaunches on the new version.
6. With program audio playing, confirm automatic installation does not begin.
7. Confirm the updater private key is not present in the installer, repo, or app-local data.

## Audio Routing

1. Select the ASIO device.
2. Map program output to stereo channels 1/2.
3. Map monitor output to stereo channels 3/4 when available.
4. If only one stereo output pair exists, confirm preview is disabled or visibly warned.
5. Start program playback and confirm output on the selected program channels.
6. Start preview playback and confirm it routes only to monitor channels.

## Operator Controls

1. Start, pause, next, previous, and seek from the player bar.
2. Fire cart slots while program audio is playing.
3. Confirm carts do not interrupt the UI or lose slot assignment after restart.
4. Configure a scheduler event for the next local minute.
5. Confirm the event fires at the configured local second.

## Mic And Ducking

1. Select the mic input device.
2. Open mic in toggle mode and confirm program ducking applies.
3. Close mic and confirm program gain restores cleanly.
4. Repeat in push-to-talk mode if configured.
5. Confirm VU feedback updates while mic/program audio is active.

## Recovery

1. Start playback with a populated queue.
2. Force-close the app.
3. Relaunch and confirm queue/runtime state restoration.
4. Check logs for startup recovery and persistence errors.
5. Reboot the station PC and repeat the restoration check.

## Known V1 Limits

- The current implementation is ready for station-mode shell, persistence, bridge, and mocked UI testing.
- Hardware-certified real-time mixing, decoding, ASIO callback playback, and channel-accurate routing still require Windows hardware implementation/acceptance before production use.
- Signed update delivery requires a production HTTPS update endpoint and CI-managed Tauri updater private key before release.
