/**
 * Development-only logging — keeps production consoles clean.
 * For production failures, rely on UI state and (later) an APM or error reporter.
 */
function devLog(level: "warn" | "error", ...args: unknown[]): void {
  if (process.env.NODE_ENV !== "development") return;
  console[level](...args);
}

export function devLogWarn(...args: unknown[]): void {
  devLog("warn", ...args);
}

export function devLogError(...args: unknown[]): void {
  devLog("error", ...args);
}
