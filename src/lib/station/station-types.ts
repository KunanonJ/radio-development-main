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

export type StationEventName =
  | "station:transport"
  | "station:vu"
  | "station:scheduler-fire"
  | "station:device-change"
  | "station:engine-error"
  | "station:persistence-error";

export type StationTransportState = {
  playing: boolean;
  currentAssetId: string | null;
  queueAssetIds: string[];
  positionSec: number;
  activeDeck: "A" | "B";
};

export type StationVuFrame = {
  peak: number;
  rms: number;
  t: number;
};

export type StationDevice = {
  id: string;
  name: string;
  host: "ASIO" | "WASAPI" | "DirectSound" | "Unknown";
  inputChannels: number;
  outputChannels: number;
  sampleRates: number[];
  defaultSampleRate: number;
};

export type StationHealth = {
  ok: boolean;
  appMode: "station";
  audioBackend: string;
  dbPath: string;
  mediaDir: string;
};

export type StationRuntimeState = {
  id: "runtime";
  pendingEventIds: string[];
  lastFiredKeys: Record<string, string>;
};

export type StationBridgeEvents = {
  "station:transport": StationTransportState;
  "station:vu": StationVuFrame;
  "station:scheduler-fire": { eventId: string; assetId: string; firedAt: string };
  "station:device-change": { devices: StationDevice[] };
  "station:engine-error": { message: string; code?: string };
  "station:persistence-error": { message: string; operation: string };
};

export type StationImportAssetInput = {
  asset: LocalAudioAsset;
  bytes: number[];
};

export type StationRepositoryContract = {
  health: () => Promise<StationHealth>;
  importAsset: (input: StationImportAssetInput) => Promise<LocalAudioAsset>;
  listAssets: () => Promise<LocalAudioAsset[]>;
  readAssetBlob: (blobKey: string) => Promise<number[]>;
  deleteAsset: (assetId: string, blobKey: string) => Promise<void>;
  saveCartSlots: (slots: CartSlotConfig[]) => Promise<void>;
  listCartSlots: () => Promise<CartSlotConfig[]>;
  saveSchedulerEvent: (event: BroadcastSchedulerEvent) => Promise<void>;
  listSchedulerEvents: () => Promise<BroadcastSchedulerEvent[]>;
  deleteSchedulerEvent: (eventId: string) => Promise<void>;
  saveCrossfadeProfiles: (profiles: CrossfadeProfile[]) => Promise<void>;
  listCrossfadeProfiles: () => Promise<CrossfadeProfile[]>;
  savePlaybackSettings: (settings: PlaybackRoutingSettings) => Promise<void>;
  loadPlaybackSettings: () => Promise<PlaybackRoutingSettings | null>;
  saveMicSettings: (settings: MicSettings) => Promise<void>;
  loadMicSettings: () => Promise<MicSettings | null>;
  saveLowResourceSettings: (settings: LowResourceSettings) => Promise<void>;
  loadLowResourceSettings: () => Promise<LowResourceSettings | null>;
  saveStreamingTarget: (target: StreamingTarget) => Promise<void>;
  listStreamingTargets: () => Promise<StreamingTarget[]>;
  deleteStreamingTarget: (targetId: string) => Promise<void>;
  saveSoftwareUpdateSettings: (settings: SoftwareUpdateSettings) => Promise<void>;
  loadSoftwareUpdateSettings: () => Promise<SoftwareUpdateSettings | null>;
  saveRuntimeState: (state: StationRuntimeState) => Promise<void>;
  loadRuntimeState: () => Promise<StationRuntimeState | null>;
  listAudioDevices: () => Promise<StationDevice[]>;
  setTransport: (patch: Partial<StationTransportState>) => Promise<StationTransportState>;
};
