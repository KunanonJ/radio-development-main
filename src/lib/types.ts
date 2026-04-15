export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  albumId: string;
  duration: number; // seconds
  artwork: string;
  source: SourceType;
  genre: string;
  year: number;
  trackNumber: number;
  /** ISO timestamp when the track was added to the library (optional; used for Recently added) */
  dateAdded?: string;
  /** Object URL for browser playback (session); not persisted across reloads */
  mediaUrl?: string;
  /** Storage key returned by `/api/upload` */
  cloudKey?: string;
  /** SHA-256 of file contents; used to prevent duplicate cloud uploads */
  contentHash?: string;
  /** Broadcast-specific classification used for crossfade and scheduler behavior. */
  audioClass?: AudioClass;
  /** Local asset id when this track comes from the browser-first broadcast library. */
  assetId?: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  artwork: string;
  year: number;
  genre: string;
  trackCount: number;
  tracks: Track[];
  source: SourceType;
  /** ISO timestamp when the album was added to the library (optional; used for Recently added) */
  dateAdded?: string;
}

export interface Artist {
  id: string;
  name: string;
  artwork: string;
  genres: string[];
  albumCount: number;
  trackCount: number;
  monthlyListeners?: number;
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  artwork: string;
  trackCount: number;
  duration: number;
  tracks: Track[];
  createdBy: string;
  isPublic: boolean;
}

export type SourceType =
  | 'local'
  | 'plex'
  | 'spotify'
  | 'apple-music'
  | 'youtube'
  | 'jellyfin'
  | 'navidrome'
  | 'cloud';

export type ConnectionStatus = 'connected' | 'not-connected' | 'expired' | 'syncing' | 'error';

export interface IntegrationSource {
  id: SourceType;
  name: string;
  icon: string;
  status: ConnectionStatus;
  trackCount?: number;
  lastSync?: string;
  color: string;
}

export interface PlaybackState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number; // 0-1
  volume: number; // 0-1
  isMuted: boolean;
  repeat: 'off' | 'all' | 'one';
  shuffle: boolean;
  queue: Track[];
  queueIndex: number;
}

export interface ListeningStat {
  label: string;
  value: number;
  change?: number;
  unit?: string;
}

export interface SearchResult {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
}

export type AudioClass = 'music' | 'commercial' | 'jingle' | 'cart' | 'break';

export interface LocalAudioAsset {
  id: string;
  fileName: string;
  title: string;
  mimeType: string;
  size: number;
  lastModified: number;
  durationSec: number;
  blobKey: string;
  artwork?: string;
  artist?: string;
  album?: string;
  tags?: string[];
  fileHandle?: string | null;
  audioClass: AudioClass;
}

export interface CartSlotConfig {
  slotIndex: number;
  assetId: string | null;
  label: string;
  color: string;
  hotkey: string | null;
}

export type BroadcastEventMode = 'interrupt' | 'queue-complete';

export interface BroadcastSchedulerEvent {
  id: string;
  name: string;
  assetId: string;
  time: string;
  daysOfWeek: number[];
  mode: BroadcastEventMode;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CrossfadeCurve = 'linear' | 'log';

export interface CrossfadeProfile {
  audioClass: AudioClass;
  mixPointSec: number;
  fadeInSec: number;
  fadeOutSec: number;
  curve: CrossfadeCurve;
}

export interface PlaybackRoutingSettings {
  mode: 'browser-local';
  onAirVolume: number;
  monitorVolume: number;
  previewEnabled: boolean;
  driverLabel: 'WASAPI' | 'ASIO' | 'DirectSound';
  mainOutputLabel: string;
  monitorOutputLabel: string;
}

export type MicInputMode = 'toggle' | 'ptt';

export interface MicSettings {
  inputDeviceId: string | null;
  duckDb: number;
  mode: MicInputMode;
  preferredSampleRate: 44100 | 48000;
  enabled: boolean;
}
