import { mockTracks, mockSpotAds } from '@/lib/mock-data';
import { getApiCatalogTracks } from '@/lib/catalog-cache';
import { useCloudLibraryStore } from '@/lib/cloud-library-store';
import { getLocalAssetTracks } from '@/lib/local-broadcast-store';
import type { Track } from '@/lib/types';

/** Resolve a track by id from cloud + API catalog + mock spots + mock tracks (sync; first match wins). */
export function resolveTrackById(id: string): Track | null {
  const cloud = useCloudLibraryStore.getState().tracks;
  const local = getLocalAssetTracks();
  const api = getApiCatalogTracks();
  const merged = [...local, ...mockSpotAds, ...api, ...mockTracks, ...cloud];
  return merged.find((t) => t.id === id) ?? null;
}
