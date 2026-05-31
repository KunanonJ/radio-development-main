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
} from '@/lib/types';
import { devLogError } from '@/lib/dev-log';
import { isStationMode } from '@/lib/station/station-mode';
import { createStationBroadcastRepository } from '@/lib/station/station-repository';

const DB_NAME = 'sonic-bloom-local-broadcast';
const DB_VERSION = 4;

const STORE_ASSETS = 'assets';
const STORE_BLOBS = 'assetBlobs';
const STORE_CART = 'cartSlots';
const STORE_EVENTS = 'schedulerEvents';
const STORE_PROFILES = 'crossfadeProfiles';
const STORE_PLAYBACK = 'playbackSettings';
const STORE_MIC = 'micSettings';
const STORE_RUNTIME = 'runtimeState';
const STORE_LOW_RESOURCE = 'lowResourceSettings';
const STORE_STREAMING_TARGETS = 'streamingTargets';
const STORE_SOFTWARE_UPDATES = 'softwareUpdateSettings';

type RuntimeStateRecord = {
  id: 'runtime';
  pendingEventIds: string[];
  lastFiredKeys: Record<string, string>;
};

type BlobRecord = {
  blobKey: string;
  blob: Blob;
};

type PlaybackSettingsRecord = PlaybackRoutingSettings & { id: 'playback' };
type MicSettingsRecord = MicSettings & { id: 'mic' };
type LowResourceSettingsRecord = LowResourceSettings & { id: 'low-resource' };
type SoftwareUpdateSettingsRecord = SoftwareUpdateSettings & { id: 'software-updates' };

function hasIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function promisifyTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

async function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return null;
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'blobKey' });
      }
      if (!db.objectStoreNames.contains(STORE_CART)) {
        db.createObjectStore(STORE_CART, { keyPath: 'slotIndex' });
      }
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PROFILES)) {
        db.createObjectStore(STORE_PROFILES, { keyPath: 'audioClass' });
      }
      if (!db.objectStoreNames.contains(STORE_PLAYBACK)) {
        db.createObjectStore(STORE_PLAYBACK, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_MIC)) {
        db.createObjectStore(STORE_MIC, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_RUNTIME)) {
        db.createObjectStore(STORE_RUNTIME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_LOW_RESOURCE)) {
        db.createObjectStore(STORE_LOW_RESOURCE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_STREAMING_TARGETS)) {
        db.createObjectStore(STORE_STREAMING_TARGETS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SOFTWARE_UPDATES)) {
        db.createObjectStore(STORE_SOFTWARE_UPDATES, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  }).catch((error) => {
    devLogError('broadcast-db open failed', error);
    return null;
  });

  return dbPromise;
}

async function withTransaction<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  run: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await openDb();
  if (!db) {
    throw new Error('IndexedDB unavailable');
  }
  const transaction = db.transaction(storeNames, mode);
  const result = await run(transaction);
  await promisifyTransaction(transaction);
  return result;
}

async function getAll<T>(storeName: string): Promise<T[]> {
  return withTransaction([storeName], 'readonly', async (transaction) => {
    const request = transaction.objectStore(storeName).getAll();
    return promisifyRequest<T[]>(request);
  });
}

async function getOne<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  return withTransaction([storeName], 'readonly', async (transaction) => {
    const request = transaction.objectStore(storeName).get(key);
    return (await promisifyRequest<T | undefined>(request)) ?? null;
  });
}

async function putMany<T>(storeName: string, values: T[]): Promise<void> {
  await withTransaction([storeName], 'readwrite', async (transaction) => {
    const store = transaction.objectStore(storeName);
    for (const value of values) {
      store.put(value);
    }
  });
}

export interface LocalBroadcastRepository {
  saveAssetBlob: (asset: LocalAudioAsset, blob: Blob) => Promise<void>;
  listAssets: () => Promise<LocalAudioAsset[]>;
  loadAssetBlob: (blobKey: string) => Promise<Blob | null>;
  deleteAsset: (assetId: string, blobKey: string) => Promise<void>;
  saveCartConfig: (slots: CartSlotConfig[]) => Promise<void>;
  loadCartConfig: () => Promise<CartSlotConfig[]>;
  saveSchedulerEvent: (event: BroadcastSchedulerEvent) => Promise<void>;
  listSchedulerEvents: () => Promise<BroadcastSchedulerEvent[]>;
  deleteSchedulerEvent: (eventId: string) => Promise<void>;
  saveCrossfadeProfiles: (profiles: CrossfadeProfile[]) => Promise<void>;
  loadCrossfadeProfiles: () => Promise<CrossfadeProfile[]>;
  savePlaybackRoutingSettings: (settings: PlaybackRoutingSettings) => Promise<void>;
  loadPlaybackRoutingSettings: () => Promise<PlaybackRoutingSettings | null>;
  saveMicSettings: (settings: MicSettings) => Promise<void>;
  loadMicSettings: () => Promise<MicSettings | null>;
  saveLowResourceSettings: (settings: LowResourceSettings) => Promise<void>;
  loadLowResourceSettings: () => Promise<LowResourceSettings | null>;
  saveStreamingTarget: (target: StreamingTarget) => Promise<void>;
  listStreamingTargets: () => Promise<StreamingTarget[]>;
  deleteStreamingTarget: (targetId: string) => Promise<void>;
  saveSoftwareUpdateSettings: (settings: SoftwareUpdateSettings) => Promise<void>;
  loadSoftwareUpdateSettings: () => Promise<SoftwareUpdateSettings | null>;
  saveRuntimeState: (state: RuntimeStateRecord) => Promise<void>;
  loadRuntimeState: () => Promise<RuntimeStateRecord | null>;
}

const indexedDbBroadcastRepository: LocalBroadcastRepository = {
  async saveAssetBlob(asset, blob) {
    const { objectUrl, ...serializableAsset } = asset as LocalAudioAsset & {
      objectUrl?: string;
    };
    void objectUrl;
    await withTransaction([STORE_ASSETS, STORE_BLOBS], 'readwrite', async (transaction) => {
      transaction.objectStore(STORE_ASSETS).put(serializableAsset);
      transaction.objectStore(STORE_BLOBS).put({
        blobKey: serializableAsset.blobKey,
        blob,
      } satisfies BlobRecord);
    });
  },

  async listAssets() {
    return getAll<LocalAudioAsset>(STORE_ASSETS);
  },

  async loadAssetBlob(blobKey) {
    const record = await getOne<BlobRecord>(STORE_BLOBS, blobKey);
    return record?.blob ?? null;
  },

  async deleteAsset(assetId, blobKey) {
    await withTransaction([STORE_ASSETS, STORE_BLOBS], 'readwrite', async (transaction) => {
      transaction.objectStore(STORE_ASSETS).delete(assetId);
      transaction.objectStore(STORE_BLOBS).delete(blobKey);
    });
  },

  async saveCartConfig(slots) {
    await putMany(STORE_CART, slots);
  },

  async loadCartConfig() {
    return getAll<CartSlotConfig>(STORE_CART);
  },

  async saveSchedulerEvent(event) {
    await putMany(STORE_EVENTS, [event]);
  },

  async listSchedulerEvents() {
    return getAll<BroadcastSchedulerEvent>(STORE_EVENTS);
  },

  async deleteSchedulerEvent(eventId) {
    await withTransaction([STORE_EVENTS], 'readwrite', async (transaction) => {
      transaction.objectStore(STORE_EVENTS).delete(eventId);
    });
  },

  async saveCrossfadeProfiles(profiles) {
    await putMany(STORE_PROFILES, profiles);
  },

  async loadCrossfadeProfiles() {
    return getAll<CrossfadeProfile>(STORE_PROFILES);
  },

  async savePlaybackRoutingSettings(settings) {
    const record: PlaybackSettingsRecord = { ...settings, id: 'playback' };
    await putMany(STORE_PLAYBACK, [record]);
  },

  async loadPlaybackRoutingSettings() {
    const record = await getOne<PlaybackSettingsRecord>(STORE_PLAYBACK, 'playback');
    if (!record) return null;
    const { id, ...settings } = record;
    void id;
    return settings;
  },

  async saveMicSettings(settings) {
    const record: MicSettingsRecord = { ...settings, id: 'mic' };
    await putMany(STORE_MIC, [record]);
  },

  async loadMicSettings() {
    const record = await getOne<MicSettingsRecord>(STORE_MIC, 'mic');
    if (!record) return null;
    const { id, ...settings } = record;
    void id;
    return settings;
  },

  async saveLowResourceSettings(settings) {
    const record: LowResourceSettingsRecord = { ...settings, id: 'low-resource' };
    await putMany(STORE_LOW_RESOURCE, [record]);
  },

  async loadLowResourceSettings() {
    const record = await getOne<LowResourceSettingsRecord>(STORE_LOW_RESOURCE, 'low-resource');
    if (!record) return null;
    const { id, ...settings } = record;
    void id;
    return settings;
  },

  async saveStreamingTarget(target) {
    await putMany(STORE_STREAMING_TARGETS, [target]);
  },

  async listStreamingTargets() {
    return getAll<StreamingTarget>(STORE_STREAMING_TARGETS);
  },

  async deleteStreamingTarget(targetId) {
    await withTransaction([STORE_STREAMING_TARGETS], 'readwrite', async (transaction) => {
      transaction.objectStore(STORE_STREAMING_TARGETS).delete(targetId);
    });
  },

  async saveSoftwareUpdateSettings(settings) {
    const record: SoftwareUpdateSettingsRecord = { ...settings, id: 'software-updates' };
    await putMany(STORE_SOFTWARE_UPDATES, [record]);
  },

  async loadSoftwareUpdateSettings() {
    const record = await getOne<SoftwareUpdateSettingsRecord>(
      STORE_SOFTWARE_UPDATES,
      'software-updates',
    );
    if (!record) return null;
    const { id, ...settings } = record;
    void id;
    return settings;
  },

  async saveRuntimeState(state) {
    await putMany(STORE_RUNTIME, [state]);
  },

  async loadRuntimeState() {
    return getOne<RuntimeStateRecord>(STORE_RUNTIME, 'runtime');
  },
};

let stationBroadcastRepository: LocalBroadcastRepository | null = null;

function activeBroadcastRepository(): LocalBroadcastRepository {
  if (!isStationMode()) return indexedDbBroadcastRepository;
  stationBroadcastRepository ??= createStationBroadcastRepository();
  return stationBroadcastRepository;
}

export const localBroadcastRepository: LocalBroadcastRepository = {
  saveAssetBlob: (...args) => activeBroadcastRepository().saveAssetBlob(...args),
  listAssets: () => activeBroadcastRepository().listAssets(),
  loadAssetBlob: (...args) => activeBroadcastRepository().loadAssetBlob(...args),
  deleteAsset: (...args) => activeBroadcastRepository().deleteAsset(...args),
  saveCartConfig: (...args) => activeBroadcastRepository().saveCartConfig(...args),
  loadCartConfig: () => activeBroadcastRepository().loadCartConfig(),
  saveSchedulerEvent: (...args) => activeBroadcastRepository().saveSchedulerEvent(...args),
  listSchedulerEvents: () => activeBroadcastRepository().listSchedulerEvents(),
  deleteSchedulerEvent: (...args) => activeBroadcastRepository().deleteSchedulerEvent(...args),
  saveCrossfadeProfiles: (...args) => activeBroadcastRepository().saveCrossfadeProfiles(...args),
  loadCrossfadeProfiles: () => activeBroadcastRepository().loadCrossfadeProfiles(),
  savePlaybackRoutingSettings: (...args) =>
    activeBroadcastRepository().savePlaybackRoutingSettings(...args),
  loadPlaybackRoutingSettings: () => activeBroadcastRepository().loadPlaybackRoutingSettings(),
  saveMicSettings: (...args) => activeBroadcastRepository().saveMicSettings(...args),
  loadMicSettings: () => activeBroadcastRepository().loadMicSettings(),
  saveLowResourceSettings: (...args) =>
    activeBroadcastRepository().saveLowResourceSettings(...args),
  loadLowResourceSettings: () => activeBroadcastRepository().loadLowResourceSettings(),
  saveStreamingTarget: (...args) => activeBroadcastRepository().saveStreamingTarget(...args),
  listStreamingTargets: () => activeBroadcastRepository().listStreamingTargets(),
  deleteStreamingTarget: (...args) => activeBroadcastRepository().deleteStreamingTarget(...args),
  saveSoftwareUpdateSettings: (...args) =>
    activeBroadcastRepository().saveSoftwareUpdateSettings(...args),
  loadSoftwareUpdateSettings: () => activeBroadcastRepository().loadSoftwareUpdateSettings(),
  saveRuntimeState: (...args) => activeBroadcastRepository().saveRuntimeState(...args),
  loadRuntimeState: () => activeBroadcastRepository().loadRuntimeState(),
};
