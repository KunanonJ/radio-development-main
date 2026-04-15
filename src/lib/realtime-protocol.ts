/**
 * WebSocket message contract for station rooms (Durable Object): live VU + remote control.
 * Shared by the Next.js client and the Cloudflare Worker/DO implementation.
 *
 * Transport: JSON text frames. Binary optional later for packed VU arrays.
 */

/** Client ↔ server envelope */
export type RealtimeMessage =
  | RealtimeClientMessage
  | RealtimeServerMessage;

/** First message after connect must be `hello` with a signed token (verified by Worker). */
export type RealtimeClientMessage =
  | RealtimeHello
  | RealtimeVuFrame
  | RealtimeCmd
  | RealtimePing;

export type RealtimeServerMessage =
  | RealtimeWelcome
  | RealtimeVuBroadcast
  | RealtimeCmdAck
  | RealtimeCmdBroadcast
  | RealtimeError
  | RealtimePong;

export interface RealtimeHello {
  type: 'hello';
  /** Short-lived JWT or opaque ticket from POST /api/realtime/token */
  token: string;
  /** Client protocol version */
  protocol: 1;
  /** Subscriber role hint (server still validates from token) */
  mode: 'operator' | 'viewer' | 'meter';
}

/** One VU snapshot from the on-air machine (AnalyserNode-derived). */
export interface RealtimeVuFrame {
  type: 'vu';
  /** Monotonic client clock ms (for ordering / drop stale) */
  t: number;
  /** Overall peak linear 0..1 */
  peak: number;
  /** RMS linear 0..1 */
  rms: number;
  /** Optional stereo or multi-band summary (0..1), max 32 bins */
  bins?: number[];
}

/**
 * Remote control — only `operator` role may be honored by the DO (and optional single-flight lock).
 */
export type RealtimeCmdAction =
  | { action: 'play' }
  | { action: 'pause' }
  | { action: 'stop' }
  | { action: 'next' }
  | { action: 'previous' }
  | { action: 'seek'; progress: number }
  | { action: 'load_track'; trackId: string }
  | { action: 'set_queue'; trackIds: string[] }
  | { action: 'duck'; db: number; ms: number }
  | { action: 'mic'; on: boolean };

export interface RealtimeCmd {
  type: 'cmd';
  /** Idempotency: client increments per command */
  seq: number;
  stationId: string;
  tenantId: string;
  payload: RealtimeCmdAction;
}

export interface RealtimePing {
  type: 'ping';
  nonce: number;
}

/** Server confirms subscription */
export interface RealtimeWelcome {
  type: 'welcome';
  tenantId: string;
  stationId: string;
  clientId: string;
  role: 'viewer' | 'operator' | 'admin';
  /** Server time ms */
  serverTime: number;
}

/** Broadcast VU to all non-emitting subscribers */
export interface RealtimeVuBroadcast {
  type: 'vu_broadcast';
  fromClientId: string;
  frame: Omit<RealtimeVuFrame, 'type'>;
}

export interface RealtimeCmdAck {
  type: 'cmd_ack';
  seq: number;
  ok: boolean;
  error?: string;
}

/** Same cmd echoed to other clients (e.g. directors) */
export interface RealtimeCmdBroadcast {
  type: 'cmd_broadcast';
  fromClientId: string;
  seq: number;
  payload: RealtimeCmdAction;
}

export interface RealtimeError {
  type: 'error';
  code: RealtimeErrorCode;
  message: string;
}

export type RealtimeErrorCode =
  | 'auth_required'
  | 'auth_invalid'
  | 'forbidden'
  | 'tenant_mismatch'
  | 'station_not_found'
  | 'rate_limited'
  | 'bad_message'
  | 'internal';

export interface RealtimePong {
  type: 'pong';
  nonce: number;
  serverTime: number;
}

/** Narrow helpers for DO */
export function isRealtimeClientMessage(raw: unknown): raw is RealtimeClientMessage {
  if (!raw || typeof raw !== 'object') return false;
  const t = (raw as { type?: string }).type;
  return t === 'hello' || t === 'vu' || t === 'cmd' || t === 'ping';
}

export function isRealtimeServerMessage(raw: unknown): raw is RealtimeServerMessage {
  if (!raw || typeof raw !== 'object') return false;
  const t = (raw as { type?: string }).type;
  return (
    t === 'welcome' ||
    t === 'vu_broadcast' ||
    t === 'cmd_ack' ||
    t === 'cmd_broadcast' ||
    t === 'error' ||
    t === 'pong'
  );
}
