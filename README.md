# Urban Radio Management Software

Offline-first radio station management software for real operators, real shows, and Windows station PCs that need to keep running when the internet gets messy.

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24c8db)](https://v2.tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-station_core-b7410e)](https://www.rust-lang.org/)
[![Vitest](https://img.shields.io/badge/tests-Vitest-6e9f18)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/e2e-Playwright-2ead33)](https://playwright.dev/)

## What It Is

Urban Radio is a broadcast console and station operations app. The web app stays alive for browser/cloud workflows, while the Windows station runtime adds the heavy-duty local layer: Tauri shell, Rust station core, SQLite, local media files, carts, scheduler state, low-resource controls, streaming target setup, and signed software update flows.

This is built for the station desk, not a landing-page demo.

## Current Feature Set

- Broadcast console under `/app`
- Local audio library import with MP3/WAV/FLAC/AAC/M4A/OGG/Opus/WebM/AIFF support
- Offline-first Tauri station shell for Windows x64
- SQLite station database in app-local data
- Local media folder for imported assets
- Cart slots, scheduler events, crossfade profiles, routing, mic, runtime, low-resource, stream target, and update settings persistence
- Low-resource mode for older PCs: lower VU FPS, reduced motion, simpler surfaces, import batching, optional duration-scan skip
- YouTube Live, Facebook Live, and custom RTMP/RTMPS target configuration
- Signed Tauri updater wiring with manual checks, manual install, auto-check preference, and on-air install guard
- Security hardening for native file paths, audio import validation, stream-key validation, and update channel caching

## Station Runtime

```bash
npm run station:dev
npm run station:test
npm run station:verify
npm run station:build
```

Windows is the first production target. The station app is designed to run offline after install. Update delivery still requires a production HTTPS updater endpoint and signed release artifacts.

## Web Runtime

```bash
npm run dev
npm test
npm run test:e2e
npm run verify
npm run build
```

The browser app remains available and isolated from station mode. Browser mode uses IndexedDB/Web Audio paths where station mode uses Tauri commands and local SQLite.

## Docs

- [Agent guide](docs/agent.md): how agents should work in this repo.
- [Design system](docs/design.md): visual direction, tone, and operator UX principles.
- [Architecture](docs/architecture.md): runtime layers, data flow, and production backlog.
- [PRD](docs/PRD-URBAN-RADIO-MANAGEMENT-SOFTWARE.md): product requirements and developed features.
- [Pentest audit](docs/PENTEST-AUDIT-URBAN-RADIO-STATION.md): bug-hunt findings, fixes, and residual risks.
- [Windows station checklist](docs/WINDOWS_STATION_TEST_CHECKLIST.md): clean PC acceptance flow.

## GitHub Topics

`radio-automation`, `broadcast-console`, `tauri`, `nextjs`, `rust`, `sqlite`, `windows`, `offline-first`, `radio-station`, `audio`, `rtmp`, `rtmps`, `low-resource`, `playwright`, `vitest`

## Production Backlog

- Finish the native playback/decode/mixer pipeline.
- Implement native RTMP/RTMPS encoder and stream health telemetry.
- Move station stream keys into OS credential storage.
- Configure signed update endpoint, updater public key, and CI release signing.
- Add production Tauri CSP.
- Complete Windows hardware acceptance on clean Windows 10/11 x64 station PCs.

## Security Posture

The station slice has an active pentest audit. Current hardening includes native path traversal protection, native audio import validation, managed RTMPS enforcement, CR/LF stream-key rejection, and release-channel-safe update install behavior.

Do not ship production station builds with hardcoded secrets, unsigned updates, or untested audio hardware routing.
