import { create } from 'zustand';
import { startTransition, useMemo } from 'react';
import { localBroadcastRepository } from '@/lib/local-broadcast-db';
import type {
  AudioClass,
  BroadcastSchedulerEvent,
  CartSlotConfig,
  CrossfadeProfile,
  LocalAudioAsset,
  MicSettings,
  PlaybackRoutingSettings,
  Track,
} from '@/lib/types';
import { usePlayerStore } from '@/lib/store';
import { devLogError } from '@/lib/dev-log';

const LOCAL_ARTWORK = '/placeholder.svg';
const CART_COLORS = [
  'bg-emerald-500/20 border-emerald-400/50',
  'bg-cyan-500/20 border-cyan-400/50',
  'bg-amber-500/20 border-amber-400/50',
  'bg-fuchsia-500/20 border-fuchsia-400/50',
  'bg-blue-500/20 border-blue-400/50',
  'bg-rose-500/20 border-rose-400/50',
];

export type MicPermissionState = 'unknown' | 'granted' | 'denied' | 'error' | 'unsupported';
export type AudioUnlockState = 'unknown' | 'ready' | 'suspended' | 'unsupported' | 'error';

type LocalAssetWithUrl = LocalAudioAsset & {
  objectUrl: string;
};

type BroadcastRuntimeState = {
  pendingEventIds: string[];
  lastFiredKeys: Record<string, string>;
};

type PreviewRequest = {
  nonce: number;
  track: Track | null;
};

type CartPlaybackRequest = {
  nonce: number;
  track: Track;
  slotIndex: number;
};

type InterruptPlaybackRequest = {
  nonce: number;
  track: Track;
  fadeMs: number;
};

type InputDeviceOption = {
  id: string;
  label: string;
};

type ImportResult = {
  added: Track[];
  errors: string[];
  assetIds: string[];
};

type LocalBroadcastState = {
  hydrated: boolean;
  hydrating: boolean;
  hydrateError: string | null;
  assets: LocalAssetWithUrl[];
  cartSlots: CartSlotConfig[];
  schedulerEvents: BroadcastSchedulerEvent[];
  crossfadeProfiles: Record<AudioClass, CrossfadeProfile>;
  playbackSettings: PlaybackRoutingSettings;
  micSettings: MicSettings;
  runtime: BroadcastRuntimeState;
  availableInputDevices: InputDeviceOption[];
  canEnumerateDevices: boolean;
  micPermission: MicPermissionState;
  micError: string | null;
  micLive: boolean;
  micLevel: number;
  audioUnlockState: AudioUnlockState;
  previewRequest: PreviewRequest | null;
  cartRequest: CartPlaybackRequest | null;
  interruptRequest: InterruptPlaybackRequest | null;
  activeDeck: 'A' | 'B';
  hydrate: () => Promise<void>;
  importAudioFiles: (files: File[], options?: { audioClass?: AudioClass }) => Promise<ImportResult>;
  removeAsset: (assetId: string) => Promise<void>;
  setCartSlotAsset: (slotIndex: number, assetId: string | null) => Promise<void>;
  updateCartSlot: (slotIndex: number, patch: Partial<CartSlotConfig>) => Promise<void>;
  addSchedulerEvent: (
    input: Omit<BroadcastSchedulerEvent, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;
  updateSchedulerEvent: (id: string, patch: Partial<BroadcastSchedulerEvent>) => Promise<void>;
  removeSchedulerEvent: (id: string) => Promise<void>;
  setSchedulerPending: (eventId: string, pending: boolean) => Promise<void>;
  setSchedulerLastFiredKey: (eventId: string, key: string) => Promise<void>;
  setCrossfadeProfile: (audioClass: AudioClass, patch: Partial<CrossfadeProfile>) => Promise<void>;
  setPlaybackSettings: (patch: Partial<PlaybackRoutingSettings>) => Promise<void>;
  setMicSettings: (patch: Partial<MicSettings>) => Promise<void>;
  refreshInputDevices: () => Promise<void>;
  setMicPermission: (permission: MicPermissionState, error?: string | null) => void;
  setMicLevel: (level: number) => void;
  setMicLive: (live: boolean) => void;
  setAudioUnlockState: (state: AudioUnlockState) => void;
  setActiveDeck: (deck: 'A' | 'B') => void;
  requestPreview: (track: Track | null) => void;
  stopPreview: () => void;
  triggerCartTrack: (track: Track, slotIndex?: number) => void;
  triggerCartSlot: (slotIndex: number) => void;
  requestInterruptPlayback: (track: Track, fadeMs?: number) => void;
  runSchedulerEventNow: (eventId: string) => void;
};

function safeUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function defaultCartSlots(): CartSlotConfig[] {
  return Array.from({ length: 12 }, (_, index) => ({
    slotIndex: index,
    assetId: null,
    label: `Slot ${index + 1}`,
    color: CART_COLORS[index % CART_COLORS.length],
    hotkey: index < 9 ? String(index + 1) : null,
  }));
}

function defaultCrossfadeProfiles(): Record<AudioClass, CrossfadeProfile> {
  return {
    music: { audioClass: 'music', mixPointSec: 4, fadeInSec: 4, fadeOutSec: 4, curve: 'linear' },
    commercial: { audioClass: 'commercial', mixPointSec: 0, fadeInSec: 0, fadeOutSec: 0, curve: 'linear' },
    jingle: { audioClass: 'jingle', mixPointSec: 0, fadeInSec: 0, fadeOutSec: 0, curve: 'linear' },
    cart: { audioClass: 'cart', mixPointSec: 0, fadeInSec: 0, fadeOutSec: 0, curve: 'linear' },
    break: { audioClass: 'break', mixPointSec: 0, fadeInSec: 0, fadeOutSec: 0, curve: 'linear' },
  };
}

function defaultPlaybackSettings(): PlaybackRoutingSettings {
  return {
    mode: 'browser-local',
    onAirVolume: 0.8,
    monitorVolume: 0.7,
    previewEnabled: true,
    driverLabel: 'WASAPI',
    mainOutputLabel: 'Browser default output (simulated on-air)',
    monitorOutputLabel: 'Browser default output (simulated monitor)',
  };
}

function defaultMicSettings(): MicSettings {
  return {
    inputDeviceId: null,
    duckDb: -15,
    mode: 'toggle',
    preferredSampleRate: 48000,
    enabled: false,
  };
}

function defaultRuntime(): BroadcastRuntimeState {
  return { pendingEventIds: [], lastFiredKeys: {} };
}

function baseTrackFromAsset(asset: LocalAssetWithUrl): Track {
  return {
    id: `asset-${asset.id}`,
    title: asset.title,
    artist: asset.artist || 'Local import',
    artistId: 'local-import',
    album: asset.album || 'Local broadcast library',
    albumId: 'local-broadcast-library',
    duration: Math.max(0, Math.round(asset.durationSec)),
    artwork: asset.artwork || LOCAL_ARTWORK,
    source: 'local',
    genre: asset.audioClass,
    year: new Date(asset.lastModified || Date.now()).getFullYear(),
    trackNumber: 1,
    mediaUrl: asset.objectUrl,
    dateAdded: new Date(asset.lastModified || Date.now()).toISOString(),
    audioClass: asset.audioClass,
    assetId: asset.id,
  };
}

function fileNameToTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled';
}

async function extractDuration(file: Blob) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = objectUrl;
      audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
      audio.onerror = () => reject(new Error('decode_failed'));
    });
    return duration;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function recreateAssetsWithUrls(assets: LocalAudioAsset[]) {
  const result: LocalAssetWithUrl[] = [];
  for (const asset of assets) {
    const blob = await localBroadcastRepository.loadAssetBlob(asset.blobKey);
    if (!blob) continue;
    result.push({ ...asset, objectUrl: URL.createObjectURL(blob) });
  }
  return result;
}

function revokeAssetUrls(assets: LocalAssetWithUrl[]) {
  for (const asset of assets) {
    URL.revokeObjectURL(asset.objectUrl);
  }
}

async function persistRuntime(runtime: BroadcastRuntimeState) {
  await localBroadcastRepository.saveRuntimeState({
    id: 'runtime',
    pendingEventIds: runtime.pendingEventIds,
    lastFiredKeys: runtime.lastFiredKeys,
  });
}

function syncPlayerVolume(settings: PlaybackRoutingSettings) {
  usePlayerStore.setState({
    volume: settings.onAirVolume,
    isMuted: settings.onAirVolume === 0,
  });
}

function syncMusicCrossfade(profile: CrossfadeProfile) {
  usePlayerStore.setState({
    crossfadeEnabled:
      profile.mixPointSec > 0 || profile.fadeInSec > 0 || profile.fadeOutSec > 0,
    crossfadeDurationSec: profile.mixPointSec,
  });
}

export function trackFromLocalAsset(assetId: string) {
  const asset = useLocalBroadcastStore.getState().assets.find((item) => item.id === assetId);
  return asset ? baseTrackFromAsset(asset) : null;
}

export function useLocalAssetTracks() {
  const assets = useLocalBroadcastStore((state) => state.assets);
  return useMemo(() => assets.map(baseTrackFromAsset), [assets]);
}

export function getLocalAssetTracks() {
  return useLocalBroadcastStore.getState().assets.map(baseTrackFromAsset);
}

export const useLocalBroadcastStore = create<LocalBroadcastState>((set, get) => ({
  hydrated: false,
  hydrating: false,
  hydrateError: null,
  assets: [],
  cartSlots: defaultCartSlots(),
  schedulerEvents: [],
  crossfadeProfiles: defaultCrossfadeProfiles(),
  playbackSettings: defaultPlaybackSettings(),
  micSettings: defaultMicSettings(),
  runtime: defaultRuntime(),
  availableInputDevices: [],
  canEnumerateDevices: true,
  micPermission: 'unknown',
  micError: null,
  micLive: false,
  micLevel: 0,
  audioUnlockState: 'unknown',
  previewRequest: null,
  cartRequest: null,
  interruptRequest: null,
  activeDeck: 'A',

  async hydrate() {
    if (get().hydrated || get().hydrating) return;
    set({ hydrating: true, hydrateError: null });

    try {
      const [assets, cartSlots, schedulerEvents, profileList, playbackSettings, micSettings, runtime] =
        await Promise.all([
          localBroadcastRepository.listAssets(),
          localBroadcastRepository.loadCartConfig(),
          localBroadcastRepository.listSchedulerEvents(),
          localBroadcastRepository.loadCrossfadeProfiles(),
          localBroadcastRepository.loadPlaybackRoutingSettings(),
          localBroadcastRepository.loadMicSettings(),
          localBroadcastRepository.loadRuntimeState(),
        ]);

      const assetsWithUrls = await recreateAssetsWithUrls(assets);
      const nextCartSlots = cartSlots.length > 0 ? cartSlots.sort((a, b) => a.slotIndex - b.slotIndex) : defaultCartSlots();
      const nextProfiles = defaultCrossfadeProfiles();
      for (const profile of profileList) {
        nextProfiles[profile.audioClass] = profile;
      }
      const nextPlayback = playbackSettings ?? defaultPlaybackSettings();
      const nextMicSettings = micSettings ?? defaultMicSettings();
      const nextRuntime = runtime
        ? { pendingEventIds: runtime.pendingEventIds, lastFiredKeys: runtime.lastFiredKeys }
        : defaultRuntime();

      syncPlayerVolume(nextPlayback);
      syncMusicCrossfade(nextProfiles.music);

      set((state) => {
        revokeAssetUrls(state.assets);
        return {
          assets: assetsWithUrls,
          cartSlots: nextCartSlots,
          schedulerEvents,
          crossfadeProfiles: nextProfiles,
          playbackSettings: nextPlayback,
          micSettings: nextMicSettings,
          runtime: nextRuntime,
          hydrated: true,
          hydrating: false,
        };
      });

      await get().refreshInputDevices();
    } catch (error) {
      devLogError('broadcast hydrate failed', error);
      set({
        hydrated: true,
        hydrating: false,
        hydrateError: error instanceof Error ? error.message : 'Failed to load local broadcast data',
      });
    }
  },

  async importAudioFiles(files, options) {
    const assetsBySignature = new Set(
      get().assets.map((asset) => `${asset.fileName}-${asset.size}-${asset.lastModified}`),
    );
    const nextAssets: LocalAssetWithUrl[] = [];
    const nextTracks: Track[] = [];
    const nextAssetIds: string[] = [];
    const errors: string[] = [];
    const audioClass = options?.audioClass ?? 'music';

    for (const file of files) {
      const signature = `${file.name}-${file.size}-${file.lastModified}`;
      if (assetsBySignature.has(signature)) {
        errors.push(`${file.name}: already imported`);
        continue;
      }

      try {
        const durationSec = await extractDuration(file);
        const id = safeUuid();
        const blobKey = `asset:${id}`;
        const objectUrl = URL.createObjectURL(file);
        const asset: LocalAssetWithUrl = {
          id,
          fileName: file.name,
          title: fileNameToTitle(file.name),
          mimeType: file.type || 'audio/mpeg',
          size: file.size,
          lastModified: file.lastModified || Date.now(),
          durationSec,
          blobKey,
          tags: [],
          fileHandle: null,
          audioClass,
          objectUrl,
        };

        await localBroadcastRepository.saveAssetBlob(asset, file);
        assetsBySignature.add(signature);
        nextAssets.push(asset);
        nextTracks.push(baseTrackFromAsset(asset));
        nextAssetIds.push(asset.id);
      } catch (error) {
        errors.push(
          `${file.name}: ${error instanceof Error ? error.message : 'could not import file'}`,
        );
      }
    }

    if (nextAssets.length > 0) {
      startTransition(() => {
        set((state) => ({ assets: [...state.assets, ...nextAssets] }));
      });
    }

    return { added: nextTracks, errors, assetIds: nextAssetIds };
  },

  async removeAsset(assetId) {
    const asset = get().assets.find((item) => item.id === assetId);
    if (!asset) return;

    await localBroadcastRepository.deleteAsset(assetId, asset.blobKey);

    const nextCartSlots = get().cartSlots.map((slot) =>
      slot.assetId === assetId ? { ...slot, assetId: null } : slot,
    );
    const nextEvents = get().schedulerEvents.filter((event) => event.assetId !== assetId);
    await Promise.all([
      localBroadcastRepository.saveCartConfig(nextCartSlots),
      ...get().schedulerEvents
        .filter((event) => event.assetId === assetId)
        .map((event) => localBroadcastRepository.deleteSchedulerEvent(event.id)),
    ]);

    set((state) => {
      const target = state.assets.find((item) => item.id === assetId);
      if (target) URL.revokeObjectURL(target.objectUrl);
      return {
        assets: state.assets.filter((item) => item.id !== assetId),
        cartSlots: nextCartSlots,
        schedulerEvents: nextEvents,
      };
    });
  },

  async setCartSlotAsset(slotIndex, assetId) {
    const nextSlots = get().cartSlots.map((slot) =>
      slot.slotIndex === slotIndex ? { ...slot, assetId } : slot,
    );
    await localBroadcastRepository.saveCartConfig(nextSlots);
    set({ cartSlots: nextSlots });
  },

  async updateCartSlot(slotIndex, patch) {
    const nextSlots = get().cartSlots.map((slot) =>
      slot.slotIndex === slotIndex ? { ...slot, ...patch, slotIndex } : slot,
    );
    await localBroadcastRepository.saveCartConfig(nextSlots);
    set({ cartSlots: nextSlots });
  },

  async addSchedulerEvent(input) {
    const now = new Date().toISOString();
    const event: BroadcastSchedulerEvent = {
      ...input,
      id: safeUuid(),
      createdAt: now,
      updatedAt: now,
    };
    await localBroadcastRepository.saveSchedulerEvent(event);
    set((state) => ({ schedulerEvents: [...state.schedulerEvents, event] }));
  },

  async updateSchedulerEvent(id, patch) {
    const current = get().schedulerEvents.find((event) => event.id === id);
    if (!current) return;
    const nextEvent = {
      ...current,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    await localBroadcastRepository.saveSchedulerEvent(nextEvent);
    set((state) => ({
      schedulerEvents: state.schedulerEvents.map((event) => (event.id === id ? nextEvent : event)),
    }));
  },

  async removeSchedulerEvent(id) {
    await localBroadcastRepository.deleteSchedulerEvent(id);
    const runtime = get().runtime;
    const nextRuntime = {
      pendingEventIds: runtime.pendingEventIds.filter((eventId) => eventId !== id),
      lastFiredKeys: Object.fromEntries(
        Object.entries(runtime.lastFiredKeys).filter(([eventId]) => eventId !== id),
      ),
    };
    await persistRuntime(nextRuntime);
    set((state) => ({
      schedulerEvents: state.schedulerEvents.filter((event) => event.id !== id),
      runtime: nextRuntime,
    }));
  },

  async setSchedulerPending(eventId, pending) {
    const runtime = get().runtime;
    const pendingEventIds = pending
      ? Array.from(new Set([...runtime.pendingEventIds, eventId]))
      : runtime.pendingEventIds.filter((id) => id !== eventId);
    const nextRuntime = { ...runtime, pendingEventIds };
    await persistRuntime(nextRuntime);
    set({ runtime: nextRuntime });
  },

  async setSchedulerLastFiredKey(eventId, key) {
    const nextRuntime = {
      ...get().runtime,
      lastFiredKeys: {
        ...get().runtime.lastFiredKeys,
        [eventId]: key,
      },
    };
    await persistRuntime(nextRuntime);
    set({ runtime: nextRuntime });
  },

  async setCrossfadeProfile(audioClass, patch) {
    const nextProfiles = {
      ...get().crossfadeProfiles,
      [audioClass]: {
        ...get().crossfadeProfiles[audioClass],
        ...patch,
        audioClass,
      },
    };
    await localBroadcastRepository.saveCrossfadeProfiles(Object.values(nextProfiles));
    syncMusicCrossfade(nextProfiles.music);
    set({ crossfadeProfiles: nextProfiles });
  },

  async setPlaybackSettings(patch) {
    const nextSettings = { ...get().playbackSettings, ...patch };
    await localBroadcastRepository.savePlaybackRoutingSettings(nextSettings);
    syncPlayerVolume(nextSettings);
    set({ playbackSettings: nextSettings });
  },

  async setMicSettings(patch) {
    const nextSettings = { ...get().micSettings, ...patch };
    await localBroadcastRepository.saveMicSettings(nextSettings);
    set({ micSettings: nextSettings });
  },

  async refreshInputDevices() {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.enumerateDevices !== 'function'
    ) {
      set({ canEnumerateDevices: false, availableInputDevices: [] });
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter((device) => device.kind === 'audioinput')
        .map((device, index) => ({
          id: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
        }));
      set({ canEnumerateDevices: true, availableInputDevices: inputs });
    } catch (error) {
      devLogError('enumerateDevices failed', error);
      set({
        canEnumerateDevices: false,
        availableInputDevices: [],
        micError: error instanceof Error ? error.message : 'Could not enumerate devices',
      });
    }
  },

  setMicPermission(permission, error) {
    set({ micPermission: permission, micError: error ?? null });
  },

  setMicLevel(level) {
    set({ micLevel: level });
  },

  setMicLive(live) {
    set({ micLive: live });
  },

  setAudioUnlockState(state) {
    set({ audioUnlockState: state });
  },

  setActiveDeck(deck) {
    set({ activeDeck: deck });
  },

  requestPreview(track) {
    set({ previewRequest: { nonce: Date.now(), track } });
  },

  stopPreview() {
    set({ previewRequest: { nonce: Date.now(), track: null } });
  },

  triggerCartTrack(track, slotIndex = -1) {
    set({
      cartRequest: {
        nonce: Date.now(),
        track,
        slotIndex,
      },
    });
  },

  triggerCartSlot(slotIndex) {
    const slot = get().cartSlots.find((item) => item.slotIndex === slotIndex);
    if (!slot?.assetId) return;
    const track = trackFromLocalAsset(slot.assetId);
    if (!track) return;
    get().triggerCartTrack({ ...track, audioClass: 'cart' }, slotIndex);
  },

  requestInterruptPlayback(track, fadeMs = 350) {
    set({
      interruptRequest: {
        nonce: Date.now(),
        track,
        fadeMs,
      },
    });
  },

  runSchedulerEventNow(eventId) {
    const event = get().schedulerEvents.find((item) => item.id === eventId);
    if (!event) return;
    const track = trackFromLocalAsset(event.assetId);
    if (!track) return;

    if (event.mode === 'interrupt') {
      get().requestInterruptPlayback(track, 350);
      return;
    }

    const player = usePlayerStore.getState();
    if (player.currentTrack && player.isPlaying) {
      player.playNext(track);
      void get().setSchedulerPending(eventId, true);
    } else {
      player.play(track);
      void get().setSchedulerPending(eventId, false);
    }
  },
}));
