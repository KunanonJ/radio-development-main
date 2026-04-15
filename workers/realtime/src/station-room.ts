/// <reference types="@cloudflare/workers-types" />

import {
  type RealtimeRateBucket,
  tickRealtimeRateLimit,
} from '../../../src/lib/realtime-do-rate';

type ConnMeta = {
  clientId: string;
  sub: string;
  tenantId: string;
  stationId: string;
  mode: string;
  role: string;
};

function errPayload(code: string, message: string): string {
  return JSON.stringify({ type: 'error', code, message });
}

export class StationRoom extends DurableObject {
  private rates = new Map<string, RealtimeRateBucket>();

  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const sub = request.headers.get('X-Realtime-Sub') ?? '';
    const tenantId = request.headers.get('X-Realtime-Tenant') ?? '';
    const stationId = request.headers.get('X-Realtime-Station') ?? '';
    const mode = request.headers.get('X-Realtime-Mode') ?? 'viewer';
    const role = request.headers.get('X-Realtime-Role') ?? 'viewer';

    if (!sub || !tenantId || !stationId) {
      return new Response('Bad gateway auth headers', { status: 500 });
    }

    const upgrade = request.headers.get('Upgrade');
    if (upgrade?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const clientId = crypto.randomUUID();

    const meta: ConnMeta = { clientId, sub, tenantId, stationId, mode, role };
    server.serializeAttachment(meta);

    this.ctx.acceptWebSocket(server);

    const welcome = JSON.stringify({
      type: 'welcome',
      tenantId,
      stationId,
      clientId,
      role: role === 'admin' || role === 'operator' || role === 'viewer' ? role : 'viewer',
      serverTime: Date.now(),
    });
    server.send(welcome);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const meta = ws.deserializeAttachment() as ConnMeta | null;
    if (meta?.clientId) this.rates.delete(meta.clientId);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      ws.send(errPayload('bad_message', 'Invalid JSON'));
      return;
    }

    const row = data as Record<string, unknown>;
    const type = typeof row.type === 'string' ? row.type : '';

    const meta = ws.deserializeAttachment() as ConnMeta | null;
    if (!meta) {
      ws.send(errPayload('internal', 'Missing connection metadata'));
      return;
    }

    if (type === 'ping') {
      const nonce = typeof row.nonce === 'number' ? row.nonce : 0;
      ws.send(JSON.stringify({ type: 'pong', nonce, serverTime: Date.now() }));
      return;
    }

    if (type === 'hello') {
      return;
    }

    const now = Date.now();
    if (type === 'vu') {
      if (!canSendVu(meta)) {
        ws.send(errPayload('forbidden', 'Not allowed to send VU'));
        return;
      }
      const prev = this.rates.get(meta.clientId);
      const { allowed, bucket } = tickRealtimeRateLimit(prev, now, 'vu');
      if (!allowed) {
        ws.send(errPayload('rate_limited', 'Too many VU frames'));
        return;
      }
      this.rates.set(meta.clientId, bucket);
      const frame = {
        t: typeof row.t === 'number' ? row.t : Date.now(),
        peak: typeof row.peak === 'number' ? row.peak : 0,
        rms: typeof row.rms === 'number' ? row.rms : 0,
        bins: Array.isArray(row.bins) ? (row.bins as number[]).slice(0, 32) : undefined,
      };
      const out = JSON.stringify({
        type: 'vu_broadcast',
        fromClientId: meta.clientId,
        frame,
      });
      this.broadcast(out, meta.clientId);
      return;
    }

    if (type === 'cmd') {
      if (!canSendCmd(meta)) {
        ws.send(errPayload('forbidden', 'Not allowed to send commands'));
        return;
      }
      const prev = this.rates.get(meta.clientId);
      const { allowed, bucket } = tickRealtimeRateLimit(prev, now, 'cmd');
      if (!allowed) {
        ws.send(errPayload('rate_limited', 'Too many commands'));
        return;
      }
      this.rates.set(meta.clientId, bucket);
      const seq = typeof row.seq === 'number' ? row.seq : -1;
      const payload = row.payload;
      if (seq < 0 || payload === undefined || typeof payload !== 'object' || payload === null) {
        ws.send(JSON.stringify({ type: 'cmd_ack', seq, ok: false, error: 'Invalid cmd' }));
        return;
      }
      ws.send(JSON.stringify({ type: 'cmd_ack', seq, ok: true }));
      const broadcast = JSON.stringify({
        type: 'cmd_broadcast',
        fromClientId: meta.clientId,
        seq,
        payload,
      });
      this.broadcast(broadcast, meta.clientId);
      return;
    }

    ws.send(errPayload('bad_message', `Unknown type: ${type}`));
  }

  private broadcast(json: string, exceptClientId: string): void {
    for (const other of this.ctx.getWebSockets()) {
      const m = other.deserializeAttachment() as ConnMeta | null;
      if (m?.clientId === exceptClientId) continue;
      try {
        other.send(json);
      } catch {
        /* ignore broken sends */
      }
    }
  }
}

function canSendVu(meta: ConnMeta): boolean {
  if (meta.role === 'admin' || meta.role === 'operator') return true;
  if (meta.mode === 'meter') return true;
  return false;
}

function canSendCmd(meta: ConnMeta): boolean {
  return meta.role === 'admin' || meta.role === 'operator';
}
