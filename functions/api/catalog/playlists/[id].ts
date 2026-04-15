/// <reference types="@cloudflare/workers-types" />

import type { SonicBloomEnv } from '../../../_lib/env';
import { getDb, selectAllTracks, trackRowToJson, type TrackRow } from '../../../_lib/catalog-map';

type Ctx = { env: SonicBloomEnv; request: Request; params: { id: string } };

function durationForTracks(rows: TrackRow[]): number {
  return rows.reduce((s, t) => s + t.duration, 0);
}

export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const db = getDb(ctx.env);
  const id = ctx.params?.id;
  if (!db || !id) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const row = await db
      .prepare(
        `SELECT id, title, description, artwork, created_by, is_public FROM playlists WHERE id = ?`,
      )
      .bind(id)
      .first<{
        id: string;
        title: string;
        description: string;
        artwork: string;
        created_by: string;
        is_public: number;
      }>();

    if (!row) {
      return Response.json({ error: 'Playlist not found' }, { status: 404 });
    }

    const allTracks = await selectAllTracks(db, ctx.request);
    const trackById = new Map(allTracks.map((t) => [t.id, t]));

    const { results: links } = await db
      .prepare(
        `SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY sort_order`,
      )
      .bind(id)
      .all<{ track_id: string }>();

    const trows: TrackRow[] = [];
    for (const l of links ?? []) {
      const tr = trackById.get(l.track_id);
      if (tr) trows.push(tr);
    }
    const tracks = trows.map((t) => trackRowToJson(t, ctx.request));

    const playlist = {
      id: row.id,
      title: row.title,
      description: row.description,
      artwork: row.artwork,
      createdBy: row.created_by,
      isPublic: Boolean(row.is_public),
      trackCount: tracks.length,
      duration: durationForTracks(trows),
      tracks,
    };

    return Response.json({ playlist, source: 'd1' });
  } catch (e) {
    console.error('catalog/playlists/[id]', e);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
