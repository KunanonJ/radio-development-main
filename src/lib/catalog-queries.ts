import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-base';
import type { Album, Artist, Playlist, Track } from '@/lib/types';
import { setApiCatalogTracks } from '@/lib/catalog-cache';

const CATALOG_STALE_MS = 5 * 60_000;

const catalogQueryOptions = {
  staleTime: CATALOG_STALE_MS,
  retry: 1,
} as const;

export type CatalogResponse = { tracks: Track[]; source?: string };

export async function fetchCatalogTracks(): Promise<Track[]> {
  const res = await apiFetch('/api/catalog');
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  const data: CatalogResponse = await res.json();
  return data.tracks ?? [];
}

export async function fetchCatalogAlbums(): Promise<Album[]> {
  const res = await apiFetch('/api/catalog/albums');
  if (!res.ok) throw new Error(`albums ${res.status}`);
  const data = (await res.json()) as { albums: Album[] };
  return data.albums ?? [];
}

export async function fetchCatalogAlbum(id: string): Promise<Album | null> {
  const res = await apiFetch(`/api/catalog/albums/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`album ${res.status}`);
  const data = (await res.json()) as { album: Album };
  return data.album ?? null;
}

export async function fetchCatalogPlaylists(): Promise<Playlist[]> {
  const res = await apiFetch('/api/catalog/playlists');
  if (!res.ok) throw new Error(`playlists ${res.status}`);
  const data = (await res.json()) as { playlists: Playlist[] };
  return data.playlists ?? [];
}

export async function fetchCatalogPlaylist(id: string): Promise<Playlist | null> {
  const res = await apiFetch(`/api/catalog/playlists/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`playlist ${res.status}`);
  const data = (await res.json()) as { playlist: Playlist };
  return data.playlist ?? null;
}

export async function fetchCatalogArtists(): Promise<Artist[]> {
  const res = await apiFetch('/api/catalog/artists');
  if (!res.ok) throw new Error(`artists ${res.status}`);
  const data = (await res.json()) as { artists: Artist[] };
  return data.artists ?? [];
}

export type CatalogArtistDetail = Artist & {
  tracks: Track[];
  albums: Album[];
};

export async function fetchCatalogArtist(id: string): Promise<CatalogArtistDetail | null> {
  const res = await apiFetch(`/api/catalog/artists/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`artist ${res.status}`);
  const data = (await res.json()) as { artist: CatalogArtistDetail };
  return data.artist ?? null;
}

export function useCatalogTracks() {
  const q = useQuery({
    queryKey: ['catalog', 'tracks'],
    queryFn: fetchCatalogTracks,
    ...catalogQueryOptions,
  });
  useEffect(() => {
    if (q.data) setApiCatalogTracks(q.data);
  }, [q.data]);
  return q;
}

export function useCatalogAlbums() {
  return useQuery({
    queryKey: ['catalog', 'albums'],
    queryFn: fetchCatalogAlbums,
    ...catalogQueryOptions,
  });
}

export function useCatalogPlaylists() {
  return useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: fetchCatalogPlaylists,
    ...catalogQueryOptions,
  });
}

export function useCatalogArtists() {
  return useQuery({
    queryKey: ['catalog', 'artists'],
    queryFn: fetchCatalogArtists,
    ...catalogQueryOptions,
  });
}

export function useCatalogAlbum(id: string | undefined) {
  return useQuery({
    queryKey: ['catalog', 'album', id],
    queryFn: () => fetchCatalogAlbum(id!),
    enabled: Boolean(id),
    ...catalogQueryOptions,
  });
}

export function useCatalogPlaylist(id: string | undefined) {
  return useQuery({
    queryKey: ['catalog', 'playlist', id],
    queryFn: () => fetchCatalogPlaylist(id!),
    enabled: Boolean(id),
    ...catalogQueryOptions,
  });
}

export function useCatalogArtist(id: string | undefined) {
  return useQuery({
    queryKey: ['catalog', 'artist', id],
    queryFn: () => fetchCatalogArtist(id!),
    enabled: Boolean(id),
    ...catalogQueryOptions,
  });
}
