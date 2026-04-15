/// <reference types="@cloudflare/workers-types" />

import type { SonicBloomEnv } from '../../_lib/env';
import { getDb, selectAllTracks, trackRowToJson } from '../../_lib/catalog-map';

type Ctx = { env: SonicBloomEnv; request: Request };

export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const db = getDb(ctx.env);
  if (!db) {
    return Response.json({ tracks: [], source: 'no-db' });
  }

  try {
    const rows = await selectAllTracks(db, ctx.request);
    const tracks = rows.map((r) => trackRowToJson(r, ctx.request));
    return Response.json({ tracks, source: 'd1' });
  } catch (e) {
    console.error('catalog', e);
    return Response.json(
      { tracks: [], source: 'error', error: e instanceof Error ? e.message : 'query failed' },
      { status: 200 },
    );
  }
}
