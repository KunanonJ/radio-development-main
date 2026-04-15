/// <reference types="@cloudflare/workers-types" />

import type { SonicBloomEnv } from '../../../_lib/env';
import { getDb, selectAllTracks, trackRowToJson } from '../../../_lib/catalog-map';

type Ctx = { env: SonicBloomEnv; request: Request; params: { id: string } };

export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const db = getDb(ctx.env);
  const id = ctx.params?.id;
  if (!db || !id) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const row = await db
      .prepare(
        `SELECT b.id, b.title, b.artist_id, a.name AS artist_name, b.artwork, b.year, b.genre, b.source, b.date_added
         FROM albums b
         INNER JOIN artists a ON a.id = b.artist_id
         WHERE b.id = ?`,
      )
      .bind(id)
      .first<{
        id: string;
        title: string;
        artist_id: string;
        artist_name: string;
        artwork: string;
        year: number;
        genre: string;
        source: string;
        date_added: string | null;
      }>();

    if (!row) {
      return Response.json({ error: 'Album not found' }, { status: 404 });
    }

    const allTracks = await selectAllTracks(db, ctx.request);
    const tracks = allTracks
      .filter((t) => t.album_id === id)
      .map((t) => trackRowToJson(t, ctx.request));

    const album = {
      id: row.id,
      title: row.title,
      artist: row.artist_name,
      artistId: row.artist_id,
      artwork: row.artwork,
      year: Number(row.year),
      genre: row.genre,
      source: row.source,
      trackCount: tracks.length,
      dateAdded: row.date_added ?? undefined,
      tracks,
    };

    return Response.json({ album, source: 'd1' });
  } catch (e) {
    console.error('catalog/albums/[id]', e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
