import { apiFetch } from '@/lib/api-base';

export type RealtimeTokenResponse = {
  token: string;
  expiresInSec: number;
  tenantId: string;
  stationId: string;
  mode: string;
  role: string;
  wsUrl: string | null;
};

/**
 * Mint a short-lived WebSocket token (requires logged-in session when auth is configured).
 */
export async function fetchRealtimeToken(body: {
  tenantId: string;
  stationId: string;
  mode?: 'operator' | 'viewer' | 'meter';
}): Promise<RealtimeTokenResponse> {
  const res = await apiFetch('/api/realtime/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<RealtimeTokenResponse>;
}

/**
 * Resolve WebSocket URL: prefer API response, else `NEXT_PUBLIC_REALTIME_WS_URL` + `/ws`.
 */
export function resolveRealtimeWsUrl(res: RealtimeTokenResponse): string {
  if (res.wsUrl) return res.wsUrl;
  const base = process.env.NEXT_PUBLIC_REALTIME_WS_URL?.trim();
  if (base) return `${base.replace(/\/$/, '')}/ws`;
  throw new Error(
    'No WebSocket URL: set REALTIME_WS_URL on Pages (for token JSON) or NEXT_PUBLIC_REALTIME_WS_URL in the browser.',
  );
}

/** `wss://…/ws?token=…` */
export function openRealtimeWebSocket(wsUrl: string, token: string): WebSocket {
  const u = new URL(wsUrl);
  u.searchParams.set('token', token);
  return new WebSocket(u.toString());
}
