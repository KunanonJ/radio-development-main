/// <reference types="@cloudflare/workers-types" />

import { verifyRealtimeToken } from '../../../functions/_lib/realtime-jwt';
import { StationRoom } from './station-room';

export { StationRoom };

export type RealtimeWorkerEnv = {
  STATION: DurableObjectNamespace;
  AUTH_JWT_SECRET: string;
};

export default {
  async fetch(request: Request, env: RealtimeWorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/ws') {
      return new Response('Not found', { status: 404 });
    }

    const upgrade = request.headers.get('Upgrade');
    if (upgrade?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426, headers: { Connection: 'Upgrade', Upgrade: 'websocket' } });
    }

    const token = url.searchParams.get('token');
    if (!token) {
      return Response.json({ error: 'Missing token query parameter' }, { status: 401 });
    }

    const secret = env.AUTH_JWT_SECRET?.trim();
    if (!secret) {
      return Response.json({ error: 'AUTH_JWT_SECRET not configured on Worker' }, { status: 503 });
    }

    const claims = await verifyRealtimeToken(secret, token);
    if (!claims) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const id = env.STATION.idFromName(`${claims.tenantId}:${claims.stationId}`);
    const stub = env.STATION.get(id);

    const headers = new Headers(request.headers);
    headers.set('X-Realtime-Sub', claims.sub);
    headers.set('X-Realtime-Tenant', claims.tenantId);
    headers.set('X-Realtime-Station', claims.stationId);
    headers.set('X-Realtime-Mode', claims.mode);
    headers.set('X-Realtime-Role', claims.role);

    const cleanUrl = new URL(request.url);
    cleanUrl.searchParams.delete('token');

    const internal = new Request(cleanUrl.toString(), { headers, method: request.method });

    return stub.fetch(internal);
  },
};
