/// <reference types="@cloudflare/workers-types" />

import type { SonicBloomEnv } from '../_lib/env';
import { getDb, getR2 } from '../_lib/catalog-map';

const CLOUD_ARTWORK =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop';

type Ctx = { env: SonicBloomEnv; request: Request };

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'audio.bin';
}

/**
 * POST /api/upload — multipart `file` → R2 + D1 track row (UAT).
 * Without R2 binding, returns dev-shaped JSON only (no persist).
 */
export async function onRequestPost(ctx: Ctx): Promise<Response> {
  const { request, env } = ctx;
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('multipart/form-data')) {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing file field' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const safe = safeFileName(file.name);
  const key = `uploads/${id}/${safe}`;
  const db = getDb(env);
  const bucket = getR2(env);

  if (!bucket || !db) {
    return Response.json({
      ok: true,
      id,
      key: `dev/${id}/${safe}`,
      size: file.size,
      warning: 'R2 or D1 not bound — dev fallback only',
    });
  }

  try {
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    });
  } catch (e) {
    console.error('r2 put', e);
    return Response.json({ error: 'Storage write failed' }, { status: 500 });
  }

  const withoutExt = file.name.replace(/\.[^.]+$/, '');
  const title = withoutExt || '(untitled)';
  const trackId = `cloud-${id}`;
  const now = new Date().toISOString();

  try {
    await db.batch([
      db.prepare(
        `INSERT INTO tracks (id, title, artist_id, album_id, duration, artwork, source, genre, year, track_number, date_added, media_r2_key, content_hash)
         VALUES (?, ?, 'cloud-upload', 'cloud-lib', 0, ?, 'cloud', 'Upload', ?, 1, ?, ?, NULL)`,
      ).bind(trackId, title, CLOUD_ARTWORK, new Date().getFullYear(), now, key),
      db.prepare(
        `INSERT INTO media_objects (id, r2_key, track_id, bytes, content_type, content_hash, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      ).bind(id, key, trackId, file.size, file.type || 'application/octet-stream', now),
    ]);
  } catch (e) {
    console.error('d1 insert', e);
    try {
      await bucket.delete(key);
    } catch {
      /* ignore */
    }
    return Response.json({ error: 'Database write failed' }, { status: 500 });
  }

  return Response.json({
    ok: true,
    id,
    key,
    size: file.size,
    trackId,
  });
}
