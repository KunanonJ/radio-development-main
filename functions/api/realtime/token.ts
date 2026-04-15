/// <reference types="@cloudflare/workers-types" />

import type { SonicBloomEnv } from '../../_lib/env';
import { getSessionFromRequest } from '../../_lib/session-jwt';
import { signRealtimeToken, type RealtimeMode, type TenantRole } from '../../_lib/realtime-jwt';

type Ctx = { env: SonicBloomEnv; request: Request };

function clampMode(dbRole: TenantRole, requested: RealtimeMode): RealtimeMode {
  if (dbRole === 'admin' || dbRole === 'operator') {
    return requested === 'meter' || requested === 'operator' || requested === 'viewer' ? requested : 'viewer';
  }
  return 'viewer';
}

export async function onRequestPost(ctx: Ctx): Promise<Response> {
  const { env, request } = ctx;
  const secret = env.AUTH_JWT_SECRET?.trim();
  if (!secret) {
    return Response.json({ error: 'AUTH_JWT_SECRET is not configured' }, { status: 503 });
  }
  if (!env.DB) {
    return Response.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const session = await getSessionFromRequest(request, secret);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { tenantId?: string; stationId?: string; mode?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
  const stationId = typeof body.stationId === 'string' ? body.stationId.trim() : '';
  if (!tenantId || !stationId) {
    return Response.json({ error: 'tenantId and stationId are required' }, { status: 400 });
  }

  const modeRaw = typeof body.mode === 'string' ? body.mode.trim() : 'viewer';
  const requested: RealtimeMode =
    modeRaw === 'operator' || modeRaw === 'meter' ? modeRaw : 'viewer';

  const member = await env.DB.prepare(
    'SELECT role FROM tenant_members WHERE user_id = ? AND tenant_id = ? LIMIT 1',
  )
    .bind(session.sub, tenantId)
    .first<{ role: string }>();

  if (!member) {
    return Response.json({ error: 'Forbidden for this tenant' }, { status: 403 });
  }

  const dbRole = member.role as TenantRole;
  if (dbRole !== 'viewer' && dbRole !== 'operator' && dbRole !== 'admin') {
    return Response.json({ error: 'Invalid membership role' }, { status: 500 });
  }

  const station = await env.DB.prepare(
    'SELECT id FROM stations WHERE id = ? AND tenant_id = ? LIMIT 1',
  )
    .bind(stationId, tenantId)
    .first<{ id: string }>();

  if (!station) {
    return Response.json({ error: 'Station not found' }, { status: 404 });
  }

  const mode = clampMode(dbRole, requested);
  const token = await signRealtimeToken(secret, {
    sub: session.sub,
    tenantId,
    stationId,
    mode,
    role: dbRole,
  });

  const wsBase = env.REALTIME_WS_URL?.trim() ?? '';

  return Response.json({
    token,
    expiresInSec: 300,
    tenantId,
    stationId,
    mode,
    role: dbRole,
    /** When REALTIME_WS_URL is set in Pages env, clients can open WebSocket at this URL (append query `token=`). */
    wsUrl: wsBase ? `${wsBase.replace(/\/$/, '')}/ws` : null,
  });
}
