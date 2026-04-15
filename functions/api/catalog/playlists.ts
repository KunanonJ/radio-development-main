/// <reference types="@cloudflare/workers-types" />

import type { SonicBloomEnv } from '../../_lib/env';
import { getDb, selectAllTracks, trackRowToJson, type TrackRow } from '../../_lib/catalog-map';

type Ctx = { env: SonicBloomEnv; request: Request };

function durationForTracks(rows: TrackRow[]): number {
  return rows.reduce((s, t) => s + t.duration, 0);
}

export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const db = getDb(ctx.env);
  if (!db) {
    return Response.json({ playlists: [], source: 'no-db' });
  }

  try {
    const { results: pls } = await db
      .prepare(`SELECT id, title, description, artwork, created_by, is_public FROM playlists ORDER BY title`)
      .all<{
        id: string;
        title: string;
        description: string;
        artwork: string;
        created_by: string;
        is_public: number;
      }>();

    const allTracks = await selectAllTracks(db, ctx.request);
    const trackById = new Map(allTracks.map((t) => [t.id, t]));

    const playlists = [];
    for (const p of pls ?? []) {
      const { results: links } = await db
        .prepare(
          `SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY sort_order`,
        )
        .bind(p.id)
        .all<{ track_id: string }>();

      const trows: TrackRow[] = [];
      for (const l of links ?? []) {
        const tr = trackById.get(l.track_id);
        if (tr) trows.push(tr);
      }
      const tracks = trows.map((t) => trackRowToJson(t, ctx.request));
      playlists.push({
        id: p.id,
        title: p.title,
        description: p.description,
        artwork: p.artwork,
        createdBy: p.created_by,
        isPublic: Boolean(p.is_public),
        trackCount: tracks.length,
        duration: durationForTracks(trows),
        tracks,
      });
    }

    return Response.json({ playlists, source: 'd1' });
  } catch (e) {
    console.error('catalog/playlists', e);
    return Response.json({ playlists: [], source: 'error' });
  }
}
