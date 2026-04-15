/// <reference types="@cloudflare/workers-types" />

import type { SonicBloomEnv } from './env';

export type TrackRow = {
  id: string;
  title: string;
  artist_id: string;
  artist_name: string;
  album_id: string;
  album_title: string;
  duration: number;
  artwork: string;
  source: string;
  genre: string;
  year: number;
  track_number: number;
  date_added: string | null;
  media_r2_key: string | null;
  content_hash: string | null;
};

/** JSON shape aligned with src/lib/types Track (subset + server fields). */
export function trackRowToJson(row: TrackRow, request: Request): Record<string, unknown> {
  const origin = new URL(request.url).origin;
  const base: Record<string, unknown> = {
    id: row.id,
    title: row.title,
    artist: row.artist_name,
    artistId: row.artist_id,
    album: row.album_title,
    albumId: row.album_id,
    duration: row.duration,
    artwork: row.artwork,
    source: row.source,
    genre: row.genre,
    year: row.year,
    trackNumber: row.track_number,
  };
  if (row.date_added) base.dateAdded = row.date_added;
  if (row.media_r2_key) {
    base.cloudKey = row.media_r2_key;
    base.mediaUrl = `${origin}/api/tracks/${encodeURIComponent(row.id)}/stream`;
  }
  if (row.content_hash) base.contentHash = row.content_hash;
  return base;
}

export async function selectAllTracks(db: D1Database, request: Request): Promise<TrackRow[]> {
  const { results } = await db
    .prepare(
      `SELECT t.id, t.title, t.artist_id, a.name AS artist_name, t.album_id, b.title AS album_title,
              t.duration, t.artwork, t.source, t.genre, t.year, t.track_number, t.date_added,
              t.media_r2_key, t.content_hash
       FROM tracks t
       INNER JOIN artists a ON a.id = t.artist_id
       INNER JOIN albums b ON b.id = t.album_id
       ORDER BY b.id, t.track_number, t.id`,
    )
    .all<TrackRow>();
  return (results ?? []).map((r) => ({
    ...r,
    duration: Number(r.duration),
    year: Number(r.year),
    track_number: Number(r.track_number),
  }));
}

export function getDb(env: SonicBloomEnv): D1Database | null {
  return env.DB ?? null;
}

export function getR2(env: SonicBloomEnv): R2Bucket | null {
  return env.MEDIA_BUCKET ?? null;
}
