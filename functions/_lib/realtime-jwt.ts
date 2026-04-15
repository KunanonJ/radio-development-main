/// <reference types="@cloudflare/workers-types" />

import { SignJWT, jwtVerify } from 'jose';

const issuer = 'sonic-bloom';
const audience = 'sonic-bloom-realtime';

export type RealtimeMode = 'operator' | 'viewer' | 'meter';

export type TenantRole = 'viewer' | 'operator' | 'admin';

export type RealtimeTokenPayload = {
  sub: string;
  tenantId: string;
  stationId: string;
  mode: RealtimeMode;
  role: TenantRole;
};

export async function signRealtimeToken(secret: string, payload: RealtimeTokenPayload): Promise<string> {
  return new SignJWT({
    tenantId: payload.tenantId,
    stationId: payload.stationId,
    mode: payload.mode,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret));
}

export async function verifyRealtimeToken(
  secret: string,
  token: string,
): Promise<RealtimeTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer,
      audience,
      algorithms: ['HS256'],
    });
    const tenantId = String((payload as { tenantId?: string }).tenantId ?? '');
    const stationId = String((payload as { stationId?: string }).stationId ?? '');
    const mode = (payload as { mode?: string }).mode;
    const role = (payload as { role?: string }).role;
    if (!tenantId || !stationId) return null;
    if (mode !== 'operator' && mode !== 'viewer' && mode !== 'meter') return null;
    if (role !== 'viewer' && role !== 'operator' && role !== 'admin') return null;
    return {
      sub: String(payload.sub ?? ''),
      tenantId,
      stationId,
      mode,
      role,
    };
  } catch {
    return null;
  }
}
