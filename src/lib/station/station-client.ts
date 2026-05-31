import type {
  StationBridgeEvents,
  StationDevice,
  StationEventName,
  StationHealth,
  StationImportAssetInput,
  StationRepositoryContract,
  StationRuntimeState,
  StationTransportState,
} from "@/lib/station/station-types";
import type {
  BroadcastSchedulerEvent,
  CartSlotConfig,
  CrossfadeProfile,
  LocalAudioAsset,
  LowResourceSettings,
  MicSettings,
  PlaybackRoutingSettings,
  SoftwareUpdateSettings,
  StreamingTarget,
} from "@/lib/types";

export type StationInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
export type StationListen = <K extends StationEventName>(
  event: K,
  handler: (payload: StationBridgeEvents[K]) => void,
) => Promise<() => void>;

export type StationAdapter = {
  invoke: StationInvoke;
  listen: StationListen;
};

let tauriAdapterPromise: Promise<StationAdapter> | null = null;

type GlobalTauri = {
  core?: {
    invoke?: StationInvoke;
  };
  event?: {
    listen?: <K extends StationEventName>(
      event: K,
      handler: (event: { payload: StationBridgeEvents[K] }) => void,
    ) => Promise<() => void>;
  };
};

declare global {
  interface Window {
    __TAURI__?: GlobalTauri;
  }
}

export async function getTauriStationAdapter(): Promise<StationAdapter> {
  if (!tauriAdapterPromise) {
    tauriAdapterPromise = Promise.resolve().then(() => {
      const tauri = typeof window !== "undefined" ? window.__TAURI__ : undefined;
      const invoke = tauri?.core?.invoke as StationInvoke | undefined;
      const listen = tauri?.event?.listen;
      if (!invoke || !listen) {
        throw new Error("Tauri station API is unavailable");
      }
      const adapter: StationAdapter = {
        invoke,
        listen: async <K extends StationEventName>(
          name: K,
          handler: (payload: StationBridgeEvents[K]) => void,
        ) => {
          const unlisten = await listen(name, (payloadEvent) => {
            handler(payloadEvent.payload);
          });
          return unlisten;
        },
      };
      return adapter;
    }).catch((error) => {
      tauriAdapterPromise = null;
      throw error;
    });
  }
  return tauriAdapterPromise;
}

export function createStationClient(adapter: StationAdapter): StationRepositoryContract {
  return {
    health: () => adapter.invoke<StationHealth>("station_health"),
    importAsset: (input: StationImportAssetInput) =>
      adapter.invoke<LocalAudioAsset>("station_import_asset", input),
    listAssets: () => adapter.invoke<LocalAudioAsset[]>("station_list_assets"),
    readAssetBlob: (blobKey: string) =>
      adapter.invoke<number[]>("station_read_asset_blob", { blobKey }),
    deleteAsset: (assetId: string, blobKey: string) =>
      adapter.invoke<void>("station_delete_asset", { assetId, blobKey }),
    saveCartSlots: (slots: CartSlotConfig[]) =>
      adapter.invoke<void>("station_save_cart_slots", { slots }),
    listCartSlots: () => adapter.invoke<CartSlotConfig[]>("station_list_cart_slots"),
    saveSchedulerEvent: (event: BroadcastSchedulerEvent) =>
      adapter.invoke<void>("station_save_scheduler_event", { event }),
    listSchedulerEvents: () =>
      adapter.invoke<BroadcastSchedulerEvent[]>("station_list_scheduler_events"),
    deleteSchedulerEvent: (eventId: string) =>
      adapter.invoke<void>("station_delete_scheduler_event", { eventId }),
    saveCrossfadeProfiles: (profiles: CrossfadeProfile[]) =>
      adapter.invoke<void>("station_save_crossfade_profiles", { profiles }),
    listCrossfadeProfiles: () =>
      adapter.invoke<CrossfadeProfile[]>("station_list_crossfade_profiles"),
    savePlaybackSettings: (settings: PlaybackRoutingSettings) =>
      adapter.invoke<void>("station_save_playback_settings", { settings }),
    loadPlaybackSettings: () =>
      adapter.invoke<PlaybackRoutingSettings | null>("station_load_playback_settings"),
    saveMicSettings: (settings: MicSettings) =>
      adapter.invoke<void>("station_save_mic_settings", { settings }),
    loadMicSettings: () => adapter.invoke<MicSettings | null>("station_load_mic_settings"),
    saveLowResourceSettings: (settings: LowResourceSettings) =>
      adapter.invoke<void>("station_save_low_resource_settings", { settings }),
    loadLowResourceSettings: () =>
      adapter.invoke<LowResourceSettings | null>("station_load_low_resource_settings"),
    saveStreamingTarget: (target: StreamingTarget) =>
      adapter.invoke<void>("station_save_streaming_target", { target }),
    listStreamingTargets: () =>
      adapter.invoke<StreamingTarget[]>("station_list_streaming_targets"),
    deleteStreamingTarget: (targetId: string) =>
      adapter.invoke<void>("station_delete_streaming_target", { targetId }),
    saveSoftwareUpdateSettings: (settings: SoftwareUpdateSettings) =>
      adapter.invoke<void>("station_save_software_update_settings", { settings }),
    loadSoftwareUpdateSettings: () =>
      adapter.invoke<SoftwareUpdateSettings | null>("station_load_software_update_settings"),
    saveRuntimeState: (state: StationRuntimeState) =>
      adapter.invoke<void>("station_save_runtime_state", { stateRecord: state }),
    loadRuntimeState: () =>
      adapter.invoke<StationRuntimeState | null>("station_load_runtime_state"),
    listAudioDevices: () => adapter.invoke<StationDevice[]>("station_list_audio_devices"),
    setTransport: (patch: Partial<StationTransportState>) =>
      adapter.invoke<StationTransportState>("station_set_transport", { patch }),
  };
}

export async function listenToStationEvents(
  adapter: StationAdapter,
  handlers: Partial<{
    [K in StationEventName]: (payload: StationBridgeEvents[K]) => void;
  }>,
): Promise<() => void> {
  const unlisteners: Array<() => void> = [];
  try {
    for (const eventName of Object.keys(handlers) as StationEventName[]) {
      const handler = handlers[eventName] as
        | ((payload: StationBridgeEvents[typeof eventName]) => void)
        | undefined;
      if (!handler) continue;
      const unlisten = await adapter.listen(eventName, (payload) => {
        handler(payload as StationBridgeEvents[typeof eventName]);
      });
      unlisteners.push(unlisten);
    }
  } catch (error) {
    for (const unlisten of unlisteners) unlisten();
    throw error;
  }
  return () => {
    for (const unlisten of unlisteners) unlisten();
  };
}
