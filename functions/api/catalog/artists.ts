/// <reference types="@cloudflare/workers-types" />

import type { SonicBloomEnv } from '../../_lib/env';
import { getDb } from '../../_lib/catalog-map';

type Ctx = { env: SonicBloomEnv; request: Request };

export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const db = getDb(ctx.env);
  if (!db) {
    return Response.json({ artists: [], source: 'no-db' });
  }

  try {
    const { results } = await db
      .prepare(
        `SELECT a.id, a.name, a.artwork, a.genres_json,
                (SELECT COUNT(DISTINCT album_id) FROM tracks t WHERE t.artist_id = a.id) AS album_count,
                (SELECT COUNT(*) FROM tracks t WHERE t.artist_id = a.id) AS track_count
         FROM artists a
         ORDER BY a.name`,
      )
      .all<{
        id: string;
        name: string;
        artwork: string;
        genres_json: string;
        album_count: number;
        track_count: number;
      }>();

    const artists = (results ?? []).map((r) => {
      let genres: string[] = [];
      try {
        genres = JSON.parse(r.genres_json) as string[];
      } catch {
        genres = [];
      }
      return {
        id: r.id,
        name: r.name,
        artwork: r.artwork,
        genres,
        albumCount: Number(r.album_count),
        trackCount: Number(r.track_count),
      };
    });

    return Response.json({ artists, source: 'd1' });
  } catch (e) {
    console.error('catalog/artists', e);
    return Response.json({ artists: [], source: 'error' });
  }
}
