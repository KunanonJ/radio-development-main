import { isStationMode } from "@/lib/station/station-mode";
import type { SoftwareUpdateChannel } from "@/lib/types";

export type StationUpdateCheckResult =
  | {
      available: true;
      currentVersion: string;
      version: string;
      date?: string;
      body?: string;
    }
  | {
      available: false;
      currentVersion: string | null;
      version: null;
      reason: "up-to-date" | "unavailable";
    };

type TauriUpdate = {
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
  downloadAndInstall: () => Promise<void>;
  close?: () => Promise<void>;
};

export type StationUpdaterRuntime = {
  available: () => boolean;
  check: (channel: SoftwareUpdateChannel) => Promise<TauriUpdate | null>;
  relaunch: () => Promise<void>;
};

let pendingUpdate:
  | {
      channel: SoftwareUpdateChannel;
      update: TauriUpdate;
    }
  | null = null;

export const tauriStationUpdaterRuntime: StationUpdaterRuntime = {
  available: () => isStationMode(),
  async check(channel) {
    const { check } = await import("@tauri-apps/plugin-updater");
    return check({
      target: channel === "beta" ? "windows-x86_64-beta" : "windows-x86_64-stable",
      timeout: 15_000,
    });
  },
  async relaunch() {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  },
};

export async function checkStationSoftwareUpdate(
  channel: SoftwareUpdateChannel,
  runtime: StationUpdaterRuntime = tauriStationUpdaterRuntime,
): Promise<StationUpdateCheckResult> {
  if (!runtime.available()) {
    pendingUpdate = null;
    return {
      available: false,
      currentVersion: null,
      version: null,
      reason: "unavailable",
    };
  }

  const update = await runtime.check(channel);
  pendingUpdate = update ? { channel, update } : null;
  if (!update) {
    return {
      available: false,
      currentVersion: null,
      version: null,
      reason: "up-to-date",
    };
  }

  return {
    available: true,
    currentVersion: update.currentVersion,
    version: update.version,
    date: update.date,
    body: update.body,
  };
}

export async function installStationSoftwareUpdate(
  channel: SoftwareUpdateChannel,
  runtime: StationUpdaterRuntime = tauriStationUpdaterRuntime,
): Promise<void> {
  if (!runtime.available()) {
    throw new Error("Software updates are only available in the Windows station app.");
  }

  if (!pendingUpdate || pendingUpdate.channel !== channel) {
    const update = await runtime.check(channel);
    pendingUpdate = update ? { channel, update } : null;
  }
  if (!pendingUpdate) {
    throw new Error("No station software update is available.");
  }

  const update = pendingUpdate.update;
  try {
    await update.downloadAndInstall();
    await runtime.relaunch();
  } finally {
    await update.close?.();
    pendingUpdate = null;
  }
}
