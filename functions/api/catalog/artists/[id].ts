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
      .prepare(`SELECT id, name, artwork, genres_json FROM artists WHERE id = ?`)
      .bind(id)
      .first<{ id: string; name: string; artwork: string; genres_json: string }>();

    if (!row) {
      return Response.json({ error: 'Artist not found' }, { status: 404 });
    }

    let genres: string[] = [];
    try {
      genres = JSON.parse(row.genres_json) as string[];
    } catch {
      genres = [];
    }

    const allTracks = await selectAllTracks(db, ctx.request);
    const tracks = allTracks
      .filter((t) => t.artist_id === id)
      .map((t) => trackRowToJson(t, ctx.request));

    const { results: albumRows } = await db
      .prepare(
        `SELECT b.id, b.title, b.artist_id, a.name AS artist_name, b.artwork, b.year, b.genre, b.source, b.date_added,
                (SELECT COUNT(*) FROM tracks t WHERE t.album_id = b.id) AS track_count
         FROM albums b
         INNER JOIN artists a ON a.id = b.artist_id
         WHERE b.artist_id = ?
         ORDER BY b.title`,
      )
      .bind(id)
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

    const albumsOnArtist = (albumRows ?? []).map((b) => {
      const tks = allTracks
        .filter((t) => t.album_id === b.id)
        .map((t) => trackRowToJson(t, ctx.request));
      return {
        id: b.id,
        title: b.title,
        artist: b.artist_name,
        artistId: b.artist_id,
        artwork: b.artwork,
        year: Number(b.year),
        genre: b.genre,
        source: b.source,
        trackCount: Number(b.track_count),
        dateAdded: b.date_added ?? undefined,
        tracks: tks,
      };
    });

    const artist = {
      id: row.id,
      name: row.name,
      artwork: row.artwork,
      genres,
      albumCount: albumsOnArtist.length,
      trackCount: tracks.length,
      tracks,
      albums: albumsOnArtist,
    };

    return Response.json({ artist, source: 'd1' });
  } catch (e) {
    console.error('catalog/artists/[id]', e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
