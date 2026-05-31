#!/usr/bin/env node
import { spawn } from "node:child_process";

const child = spawn("npx", ["next", "dev", "-p", "3000"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    NEXT_PUBLIC_STATION_MODE: "true",
    NEXT_PUBLIC_REQUIRE_AUTH: "false",
    NEXT_PUBLIC_REALTIME_ENABLED: "false",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
