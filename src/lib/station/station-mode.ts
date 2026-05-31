export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const tauriWindow = window as Window & {
    __TAURI__?: { core?: { invoke?: unknown } };
    __TAURI_INTERNALS__?: unknown;
  };
  return (
    "__TAURI_INTERNALS__" in tauriWindow ||
    typeof tauriWindow.__TAURI__?.core?.invoke === "function"
  );
}

export function isStationMode(): boolean {
  return process.env.NEXT_PUBLIC_STATION_MODE === "true" || isTauriRuntime();
}
