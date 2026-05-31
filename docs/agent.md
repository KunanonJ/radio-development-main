# Agent Guide

Urban Radio work should feel fast, but it still has to be production-safe. Agents should move with energy and keep the system tight.

## Mission

Build a radio station app that operators can trust during live broadcast. Every change should protect uptime, local data, audio reliability, and rollback paths.

## Operating Rules

- Read the existing code before making changes.
- Keep browser mode and station mode isolated.
- Write RED tests before production fixes when behavior changes.
- Use focused edits. No unrelated cleanup.
- Treat Tauri commands as a security boundary.
- Treat stream keys, updater keys, and station credentials as secrets.
- Run the smallest relevant test first, then broader verification.

## Prime Commands

```bash
npm run verify
npm run station:verify
npx tsc --noEmit --pretty false
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

## Risk Rules

- Native file paths, installer/update behavior, stream keys, SQLite migrations, and audio routing are high-risk.
- Do not bypass validation in the UI only. Validate again at native/server boundaries.
- Do not commit updater private keys, platform stream keys, API tokens, or local `.dev.vars`.
- If the app can go on-air, never auto-install or restart without an explicit safe state.

## Done Means

- Tests pass.
- Browser mode still works.
- Station mode still works.
- Docs match behavior.
- Security assumptions are written down.
- Remaining production risks are visible, not hidden.
