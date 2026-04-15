-- Multi-tenant catalog + stations + scheduler hooks.
-- Existing single-tenant rows are backfilled to tenant `tnt-default`.

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO tenants (id, name, slug) VALUES (
  'tnt-default',
  'Default station',
  'default'
);

-- ---------------------------------------------------------------------------
-- Membership: links auth_users to tenants with a role
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_members (
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'operator', 'admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, tenant_id),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);

-- Demo user is admin on default tenant (id matches 0003 seed).
INSERT OR IGNORE INTO tenant_members (user_id, tenant_id, role) VALUES (
  'user-demo',
  'tnt-default',
  'admin'
);

-- ---------------------------------------------------------------------------
-- Stations (broadcast desk / remote-control scope; one Durable Object room per row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_stations_tenant ON stations(tenant_id);

INSERT OR IGNORE INTO stations (id, tenant_id, name, slug) VALUES (
  'st-default',
  'tnt-default',
  'Main',
  'main'
);

-- ---------------------------------------------------------------------------
-- Catalog: tenant_id on all library tables
-- ---------------------------------------------------------------------------
ALTER TABLE artists ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'tnt-default';
ALTER TABLE albums ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'tnt-default';
ALTER TABLE tracks ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'tnt-default';
ALTER TABLE tracks ADD COLUMN audio_class TEXT CHECK (
  audio_class IS NULL OR audio_class IN ('music', 'commercial', 'jingle', 'cart', 'break')
);
ALTER TABLE playlists ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'tnt-default';
ALTER TABLE playlist_tracks ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'tnt-default';
ALTER TABLE media_objects ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'tnt-default';

CREATE INDEX IF NOT EXISTS idx_artists_tenant ON artists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artists_tenant_name ON artists(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_albums_tenant ON albums(tenant_id);
CREATE INDEX IF NOT EXISTS idx_albums_tenant_artist ON albums(tenant_id, artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_tenant ON tracks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tracks_tenant_album ON tracks(tenant_id, album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_tenant_artist ON tracks(tenant_id, artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_tenant_class ON tracks(tenant_id, audio_class);
CREATE INDEX IF NOT EXISTS idx_playlists_tenant ON playlists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_tenant_pl ON playlist_tracks(tenant_id, playlist_id);
CREATE INDEX IF NOT EXISTS idx_media_objects_tenant ON media_objects(tenant_id);

-- ---------------------------------------------------------------------------
-- Scheduled automation (persisted events; Workers cron / DO can claim rows)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduler_events (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  station_id TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  action_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'claimed', 'done', 'cancelled', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scheduler_tenant_station_time
  ON scheduler_events(tenant_id, station_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduler_state_pending
  ON scheduler_events(state, scheduled_at)
  WHERE state = 'pending';
