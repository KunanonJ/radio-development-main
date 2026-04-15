import { useMemo } from 'react';
import { mockTracks, mockSpotAds, mockAlbums } from '@/lib/mock-data';
import { CLOUD_ARTWORK, useCloudLibraryStore } from '@/lib/cloud-library-store';
import { useCatalogAlbums, useCatalogTracks } from '@/lib/catalog-queries';
import { getLocalAssetTracks, useLocalAssetTracks } from '@/lib/local-broadcast-store';
import type { Album, Track } from '@/lib/types';

function mergeUniqueTracks(lists: Track[][]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const list of lists) {
    for (const t of list) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}

/** Cloud + mock (sync). Use `useMergedTracks` for API catalog when online. */
export function getMergedTracks(): Track[] {
  const cloud = useCloudLibraryStore.getState().tracks;
  const local = getLocalAssetTracks();
  return mergeUniqueTracks([local, cloud, mockSpotAds, mockTracks]);
}

/** Cloud + optional `/api/catalog` + mock (deduped by id). */
export function useMergedTracks(): Track[] {
  const cloud = useCloudLibraryStore((s) => s.tracks);
  const local = useLocalAssetTracks();
  const { data: apiTracks } = useCatalogTracks();
  return useMemo(
    () => mergeUniqueTracks([local, cloud, apiTracks ?? [], mockSpotAds, mockTracks]),
    [local, cloud, apiTracks]
  );
}

/** D1/API albums when available, else mock + optional “Cloud library” album when uploads exist. */
export function useMergedAlbums(): Album[] {
  const cloudTracks = useCloudLibraryStore((s) => s.tracks);
  const localTracks = useLocalAssetTracks();
  const { data: apiAlbums } = useCatalogAlbums();
  return useMemo(() => {
    const base =
      apiAlbums && apiAlbums.length > 0
        ? apiAlbums.map((a) => ({ ...a, tracks: [...a.tracks] }))
        : mockAlbums.map((a) => ({ ...a, tracks: [...a.tracks] }));
    const dynamicAlbums = [...base];

    if (localTracks.length > 0) {
      const newestLocal =
        localTracks
          .map((track) => (track.dateAdded ? new Date(track.dateAdded).getTime() : 0))
          .sort((a, b) => b - a)[0] ?? Date.now();
      dynamicAlbums.push({
        id: 'local-broadcast-library',
        title: 'Local broadcast library',
        artist: 'Local import',
        artistId: 'local-import',
        artwork: CLOUD_ARTWORK,
        year: new Date().getFullYear(),
        genre: 'Broadcast',
        trackCount: localTracks.length,
        tracks: [...localTracks],
        source: 'local',
        dateAdded: new Date(newestLocal).toISOString(),
      });
    }

    if (cloudTracks.length === 0) return dynamicAlbums;

    let maxTs = 0;
    for (const t of cloudTracks) {
      const ts = t.dateAdded ? new Date(t.dateAdded).getTime() : 0;
      if (ts > maxTs) maxTs = ts;
    }
    const dateAdded =
      maxTs > 0
        ? new Date(maxTs).toISOString()
        : cloudTracks[0]?.dateAdded ?? new Date().toISOString();

    const cloudAlbum: Album = {
      id: 'cloud-lib',
      title: 'Cloud library',
      artist: 'Upload',
      artistId: 'cloud-upload',
      artwork: CLOUD_ARTWORK,
      year: new Date().getFullYear(),
      genre: 'Upload',
      trackCount: cloudTracks.length,
      tracks: [...cloudTracks],
      source: 'cloud',
      dateAdded,
    };

    return [...dynamicAlbums, cloudAlbum];
  }, [cloudTracks, localTracks, apiAlbums]);
}
