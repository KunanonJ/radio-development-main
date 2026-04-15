"use client";
import { useParams } from "next/navigation";
import { mockPlaylists, mockTracks } from '@/lib/mock-data';
import { shuffleArray } from '@/lib/utils';
import { useCatalogPlaylist } from '@/lib/catalog-queries';
import { TrackRow } from '@/components/TrackRow';
import { usePlayerStore } from '@/lib/store';
import { Play, Shuffle, Clock } from 'lucide-react';
import { formatDurationLong } from '@/lib/format';
import { ArtworkImage } from '@/components/ArtworkImage';

export default function PlaylistDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];
  const { data: apiPlaylist } = useCatalogPlaylist(id);
  const playlist = apiPlaylist ?? mockPlaylists.find((p) => p.id === id) ?? mockPlaylists[0];
  const { setQueue } = usePlayerStore();

  return (
    <div className="app-page">
      {/* Hero */}
      <div className="flex gap-8 mb-8">
        <ArtworkImage
          src={playlist.artwork}
          alt={playlist.title}
          width={224}
          height={224}
          className="w-56 h-56 rounded-xl object-cover shadow-2xl"
          priority
        />
        <div className="flex flex-col justify-end">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Playlist</p>
          <h1 className="text-4xl font-bold text-foreground">{playlist.title}</h1>
          <p className="text-muted-foreground mt-2">{playlist.description}</p>
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <span>{playlist.trackCount} tracks</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDurationLong(playlist.duration)}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => setQueue(playlist.tracks.length > 0 ? playlist.tracks : mockTracks.slice(0, 8))}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity glow-sm"
            >
              <Play className="w-4 h-4" /> Play
            </button>
            <button
              type="button"
              onClick={() =>
                setQueue(
                  playlist.tracks.length > 0 ? shuffleArray(playlist.tracks) : mockTracks.slice(0, 8)
                )
              }
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-border text-foreground text-sm hover:bg-secondary transition-colors"
            >
              <Shuffle className="w-4 h-4" /> Shuffle
            </button>
          </div>
        </div>
      </div>

      {/* Tracks */}
      <div className="surface-2 border border-border rounded-xl overflow-hidden">
        {playlist.tracks.map((t, i) => (
          <TrackRow key={t.id} track={t} index={i} />
        ))}
      </div>
    </div>
  );
}
