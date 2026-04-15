/// <reference types="@cloudflare/workers-types" />

/** Pages Functions + Wrangler bindings */
export type SonicBloomEnv = {
  DB?: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  /**
   * Cloudflare Access team URL, e.g. `https://yourteam.cloudflareaccess.com`.
   * If set together with `ACCESS_POLICY_AUD`, `/api/*` requires a valid `Cf-Access-Jwt-Assertion`.
   */
  ACCESS_TEAM_DOMAIN?: string;
  /** Application Audience (AUD) tag from Zero Trust → Access → your app → Basic information. */
  ACCESS_POLICY_AUD?: string;
  /**
   * HS256 secret for app login sessions (JWT in `sb_session` cookie + optional `Authorization: Bearer`).
   * When set, `/api/*` requires a session except public auth/health routes.
   */
  AUTH_JWT_SECRET?: string;
  /** Optional `wss://` base for the realtime Worker (no path); returned in POST /api/realtime/token as `wsUrl`. */
  REALTIME_WS_URL?: string;
};

export const SCHEMA_VERSION = 4;
