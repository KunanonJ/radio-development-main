import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createStationClient,
  listenToStationEvents,
  type StationAdapter,
  type StationInvoke,
} from "./station-client";
import type { LocalAudioAsset } from "@/lib/types";

function sampleAsset(): LocalAudioAsset {
  return {
    id: "asset-1",
    fileName: "tone.wav",
    title: "Tone",
    mimeType: "audio/wav",
    size: 4,
    lastModified: 123,
    durationSec: 1,
    blobKey: "asset-1-tone.wav",
    audioClass: "music",
    fileHandle: null,
  };
}

describe("station client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps repository calls to stable Tauri command names", async () => {
    const invoke = vi.fn(async <T,>(command: string): Promise<T> => {
      if (command === "station_import_asset") return sampleAsset() as T;
      if (command === "station_list_assets") return [sampleAsset()] as T;
      if (command === "station_read_asset_blob") return [1, 2, 3, 4] as T;
      return null as T;
    });
    const adapter: StationAdapter = {
      invoke: invoke as StationInvoke,
      listen: vi.fn(),
    };

    const client = createStationClient(adapter);
    await client.importAsset({ asset: sampleAsset(), bytes: [1, 2, 3, 4] });
    await client.listAssets();
    await client.readAssetBlob("asset-1-tone.wav");
    await client.saveCartSlots([]);
    await client.saveLowResourceSettings({
      enabled: true,
      reduceMotion: true,
      simpleSurfaces: true,
      vuFps: 15,
      importBatchSize: 8,
      skipImportDurationScan: true,
      stableAudioBufferFrames: 1024,
      suspendBackgroundWorkOnAir: true,
    });
    await client.saveStreamingTarget({
      id: "stream-1",
      name: "YouTube Live",
      platform: "youtube",
      serverUrl: "rtmps://a.rtmps.youtube.com/live2",
      streamKey: "local-secret",
      enabled: true,
      protocol: "rtmps",
      audioBitrateKbps: 160,
      videoMode: "audio-slate",
      status: "idle",
      lastError: null,
      updatedAt: "2026-05-31T00:00:00Z",
    });
    await (client as unknown as {
      saveSoftwareUpdateSettings: (settings: unknown) => Promise<void>;
      loadSoftwareUpdateSettings: () => Promise<unknown>;
    }).saveSoftwareUpdateSettings({
      autoCheckEnabled: true,
      autoDownloadAndInstall: false,
      channel: "stable",
      lastCheckedAt: null,
      lastAvailableVersion: null,
      lastInstalledVersion: null,
      status: "idle",
      lastError: null,
    });
    await (client as unknown as {
      loadSoftwareUpdateSettings: () => Promise<unknown>;
    }).loadSoftwareUpdateSettings();
    await client.listAudioDevices();

    expect(invoke.mock.calls.map(([command]) => command)).toEqual([
      "station_import_asset",
      "station_list_assets",
      "station_read_asset_blob",
      "station_save_cart_slots",
      "station_save_low_resource_settings",
      "station_save_streaming_target",
      "station_save_software_update_settings",
      "station_load_software_update_settings",
      "station_list_audio_devices",
    ]);
  });

  it("subscribes to station events and unregisters all listeners", async () => {
    const callbacks: Record<string, (payload: unknown) => void> = {};
    const unlisten = vi.fn();
    const adapter: StationAdapter = {
      invoke: vi.fn(),
      listen: vi.fn(async (name, handler) => {
        callbacks[name] = handler as (payload: unknown) => void;
        return unlisten;
      }),
    };
    const onTransport = vi.fn();
    const onError = vi.fn();

    const stop = await listenToStationEvents(adapter, {
      "station:transport": onTransport,
      "station:engine-error": onError,
    });

    callbacks["station:transport"]?.({
      playing: true,
      currentAssetId: "asset-1",
      queueAssetIds: ["asset-1"],
      positionSec: 3,
      activeDeck: "A",
    });
    callbacks["station:engine-error"]?.({ message: "ASIO device unavailable" });
    stop();

    expect(onTransport).toHaveBeenCalledWith(
      expect.objectContaining({ playing: true, activeDeck: "A" }),
    );
    expect(onError).toHaveBeenCalledWith({ message: "ASIO device unavailable" });
    expect(unlisten).toHaveBeenCalledTimes(2);
  });

  it("cleans up already registered event listeners when a later subscription fails", async () => {
    const firstUnlisten = vi.fn();
    const adapter: StationAdapter = {
      invoke: vi.fn(),
      listen: vi.fn(async (name) => {
        if (name === "station:transport") return firstUnlisten;
        throw new Error("event bus unavailable");
      }),
    };

    await expect(
      listenToStationEvents(adapter, {
        "station:transport": vi.fn(),
        "station:engine-error": vi.fn(),
      }),
    ).rejects.toThrow("event bus unavailable");

    expect(firstUnlisten).toHaveBeenCalledTimes(1);
  });

  it("retries Tauri adapter lookup after an early unavailable API", async () => {
    vi.resetModules();
    const { getTauriStationAdapter } = await import("./station-client");

    vi.stubGlobal("window", {});
    await expect(getTauriStationAdapter()).rejects.toThrow("Tauri station API is unavailable");

    const invoke = vi.fn();
    const listen = vi.fn();
    vi.stubGlobal("window", {
      __TAURI__: {
        core: { invoke },
        event: { listen },
      },
    });

    const adapter = await getTauriStationAdapter();
    expect(adapter.invoke).toBe(invoke);
  });
});
