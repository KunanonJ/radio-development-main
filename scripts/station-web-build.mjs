#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    NEXT_PUBLIC_STATION_MODE: "true",
    NEXT_PUBLIC_REQUIRE_AUTH: "false",
    NEXT_PUBLIC_REALTIME_ENABLED: "false",
  },
});

process.exit(result.status === null ? 1 : result.status);
