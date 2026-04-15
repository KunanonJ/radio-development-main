import { describe, expect, test } from 'vitest';
import {
  REALTIME_MAX_CMD_PER_WINDOW,
  REALTIME_MAX_VU_PER_WINDOW,
  REALTIME_RATE_WINDOW_MS,
  tickRealtimeRateLimit,
} from './realtime-do-rate';

describe('tickRealtimeRateLimit', () => {
  const t0 = 1_000_000;

  test('allows vu under cap in one window', () => {
    let bucket: ReturnType<typeof tickRealtimeRateLimit>['bucket'] | undefined;
    for (let i = 0; i < REALTIME_MAX_VU_PER_WINDOW; i += 1) {
      const r = tickRealtimeRateLimit(bucket, t0, 'vu');
      expect(r.allowed).toBe(true);
      bucket = r.bucket;
    }
    const blocked = tickRealtimeRateLimit(bucket, t0, 'vu');
    expect(blocked.allowed).toBe(false);
  });

  test('resets window after REALTIME_RATE_WINDOW_MS', () => {
    let bucket: ReturnType<typeof tickRealtimeRateLimit>['bucket'] | undefined;
    for (let i = 0; i < REALTIME_MAX_VU_PER_WINDOW; i += 1) {
      const r = tickRealtimeRateLimit(bucket, t0, 'vu');
      bucket = r.bucket;
    }
    const after = tickRealtimeRateLimit(bucket, t0 + REALTIME_RATE_WINDOW_MS + 1, 'vu');
    expect(after.allowed).toBe(true);
    expect(after.bucket.vu).toBe(1);
  });

  test('tracks cmd separately from vu in same window', () => {
    const r1 = tickRealtimeRateLimit(undefined, t0, 'vu');
    const r2 = tickRealtimeRateLimit(r1.bucket, t0, 'cmd');
    expect(r2.allowed).toBe(true);
    expect(r2.bucket.vu).toBe(1);
    expect(r2.bucket.cmd).toBe(1);
  });

  test('blocks cmd over cap', () => {
    let bucket: ReturnType<typeof tickRealtimeRateLimit>['bucket'] | undefined;
    for (let i = 0; i < REALTIME_MAX_CMD_PER_WINDOW; i += 1) {
      const r = tickRealtimeRateLimit(bucket, t0, 'cmd');
      expect(r.allowed).toBe(true);
      bucket = r.bucket;
    }
    const blocked = tickRealtimeRateLimit(bucket, t0, 'cmd');
    expect(blocked.allowed).toBe(false);
  });
});
