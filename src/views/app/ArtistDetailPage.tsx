"use client";
import { useParams } from "next/navigation";
import { mockArtists, mockTracks, mockAlbums } from '@/lib/mock-data';
import { useCatalogArtist } from '@/lib/catalog-queries';
import { TrackRow } from '@/components/TrackRow';
import { AlbumCard } from '@/components/AlbumCard';
import { ArtistCard } from '@/components/ArtistCard';
import { Play } from 'lucide-react';
import { usePlayerStore } from '@/lib/store';

export default function ArtistDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];
  const { data: apiArtist } = useCatalogArtist(id);
  const artist = apiArtist ?? mockArtists.find((a) => a.id === id) ?? mockArtists[0];

  const artistTracks =
    apiArtist?.tracks ?? mockTracks.filter((t) => t.artistId === artist.id);
  const artistAlbums = apiArtist?.albums ?? mockAlbums.filter((a) => a.artistId === artist.id);
  const related = mockArtists.filter((a) => a.id !== artist.id).slice(0, 4);
  const { setQueue } = usePlayerStore();

  return (
    <div className="app-page">
      {/* Hero */}
      <div className="relative h-64 rounded-2xl overflow-hidden mb-8">
        <img src={artist.artwork} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-6 left-6">
          <h1 className="text-4xl font-bold text-foreground">{artist.name}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            {artist.monthlyListeners != null && (
              <span>{(artist.monthlyListeners / 1000).toFixed(0)}K listeners</span>
            )}
            <span>{artist.albumCount} albums</span>
            <span>{artist.trackCount} tracks</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setQueue(artistTracks.length > 0 ? artistTracks : mockTracks.slice(0, 5))}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity glow-sm mb-8"
      >
        <Play className="w-4 h-4" /> Play All
      </button>

      {/* Top Tracks */}
      <h2 className="text-lg font-semibold text-foreground mb-3">Top Tracks</h2>
      <div className="surface-2 border border-border rounded-xl overflow-hidden mb-10">
        {(artistTracks.length > 0 ? artistTracks : mockTracks.slice(0, 5))
          .slice(0, 5)
          .map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} />
          ))}
      </div>

      {/* Discography */}
      {artistAlbums.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-4">Discography</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {artistAlbums.map((a, i) => (
              <AlbumCard key={a.id} album={a} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Related */}
      <h2 className="text-lg font-semibold text-foreground mb-4">Related Artists</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {related.map((a, i) => (
          <ArtistCard key={a.id} artist={a} index={i} />
        ))}
      </div>
    </div>
  );
}
