/// <reference types="@cloudflare/workers-types" />

import type { SonicBloomEnv } from '../../_lib/env';
import { getDb, selectAllTracks, trackRowToJson } from '../../_lib/catalog-map';

type Ctx = { env: SonicBloomEnv; request: Request };

export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const db = getDb(ctx.env);
  if (!db) {
    return Response.json({ albums: [], source: 'no-db' });
  }

  try {
    const { results } = await db
      .prepare(
        `SELECT b.id, b.title, b.artist_id, a.name AS artist_name, b.artwork, b.year, b.genre, b.source, b.date_added,
                (SELECT COUNT(*) FROM tracks t WHERE t.album_id = b.id) AS track_count
         FROM albums b
         INNER JOIN artists a ON a.id = b.artist_id
         ORDER BY b.title`,
      )
      .all<{
        id: string;
        title: string;
        artist_id: string;
        artist_name: string;
        artwork: string;
        year: number;
        genre: string;
        source: string;
        date_added: string | null;
        track_count: number;
      }>();

    const allTracks = await selectAllTracks(db, ctx.request);
    const byAlbum = new Map<string, ReturnType<typeof trackRowToJson>[]>();
    for (const row of allTracks) {
      const j = trackRowToJson(row, ctx.request);
      const list = byAlbum.get(row.album_id) ?? [];
      list.push(j);
      byAlbum.set(row.album_id, list);
    }

    const albums = (results ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      artist: r.artist_name,
      artistId: r.artist_id,
      artwork: r.artwork,
      year: Number(r.year),
      genre: r.genre,
      source: r.source,
      trackCount: Number(r.track_count),
      dateAdded: r.date_added ?? undefined,
      tracks: byAlbum.get(r.id) ?? [],
    }));

    return Response.json({ albums, source: 'd1' });
  } catch (e) {
    console.error('catalog/albums', e);
    return Response.json({ albums: [], source: 'error' });
  }
}
