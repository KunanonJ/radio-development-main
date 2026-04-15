/** Shared limits for Durable Object + unit tests (per client, rolling 1s window). */
export const REALTIME_RATE_WINDOW_MS = 1000;
export const REALTIME_MAX_VU_PER_WINDOW = 40;
export const REALTIME_MAX_CMD_PER_WINDOW = 20;

export type RealtimeRateBucket = {
  windowStart: number;
  vu: number;
  cmd: number;
};

export type RateLimitKind = 'vu' | 'cmd';

/**
 * Returns whether the event is allowed and the updated bucket (caller stores by client id).
 */
export function tickRealtimeRateLimit(
  prev: RealtimeRateBucket | undefined,
  now: number,
  kind: RateLimitKind,
): { allowed: boolean; bucket: RealtimeRateBucket } {
  let bucket =
    prev && now - prev.windowStart < REALTIME_RATE_WINDOW_MS
      ? { ...prev }
      : { windowStart: now, vu: 0, cmd: 0 };

  if (now - bucket.windowStart >= REALTIME_RATE_WINDOW_MS) {
    bucket = { windowStart: now, vu: 0, cmd: 0 };
  }

  if (kind === 'vu') {
    if (bucket.vu >= REALTIME_MAX_VU_PER_WINDOW) {
      return { allowed: false, bucket };
    }
    return { allowed: true, bucket: { ...bucket, vu: bucket.vu + 1 } };
  }

  if (bucket.cmd >= REALTIME_MAX_CMD_PER_WINDOW) {
    return { allowed: false, bucket };
  }
  return { allowed: true, bucket: { ...bucket, cmd: bucket.cmd + 1 } };
}
