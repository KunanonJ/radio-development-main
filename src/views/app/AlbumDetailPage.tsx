"use client";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from 'react-i18next';
import { mockAlbums, mockTracks } from '@/lib/mock-data';
import { useMergedAlbums } from '@/lib/library';
import { TrackRow } from '@/components/TrackRow';
import { AlbumCard } from '@/components/AlbumCard';
import { usePlayerStore } from '@/lib/store';
import { shuffleArray } from '@/lib/utils';
import { Play, Shuffle } from 'lucide-react';
import { ArtworkImage } from '@/components/ArtworkImage';

export default function AlbumDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];
  const router = useRouter();
  const albums = useMergedAlbums();
  const { setQueue } = usePlayerStore();
  const album = id ? albums.find((a) => a.id === id) : undefined;

  if (id && !album) {
    router.replace("/app/library/albums");
    return null;
  }

  const resolved = album ?? albums[0] ?? mockAlbums[0];
  const displayTracks =
    resolved.tracks.length > 0 ? resolved.tracks : mockTracks.filter((t) => t.albumId === resolved.id);
  const fallbackTracks = displayTracks.length > 0 ? displayTracks : mockTracks.slice(0, 8);
  const relatedAlbums = albums.filter((a) => a.id !== resolved.id).slice(0, 4);

  return (
    <div className="app-page">
      <div className="flex gap-8 mb-8">
        <ArtworkImage
          src={resolved.artwork}
          alt={resolved.title}
          width={224}
          height={224}
          className="w-56 h-56 rounded-xl object-cover shadow-2xl"
          priority
        />
        <div className="flex flex-col justify-end">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            {t('albumDetail.kind')}
          </p>
          <h1 className="text-4xl font-bold text-foreground">{resolved.title}</h1>
          <p className="text-muted-foreground mt-2">
            {resolved.artist} · {resolved.year} · {resolved.genre}
          </p>
          <div className="flex items-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => setQueue(fallbackTracks)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity glow-sm"
            >
              <Play className="w-4 h-4" /> {t('albumDetail.play')}
            </button>
            <button
              type="button"
              onClick={() => setQueue(shuffleArray(fallbackTracks))}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-border text-foreground text-sm hover:bg-secondary transition-colors"
            >
              <Shuffle className="w-4 h-4" /> {t('albumDetail.shuffle')}
            </button>
          </div>
        </div>
      </div>

      <div className="surface-2 border border-border rounded-xl overflow-hidden mb-10">
        {fallbackTracks.map((tr, i) => (
          <TrackRow key={tr.id} track={tr} index={i} showAlbum={false} />
        ))}
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4">
        {t('albumDetail.moreBy', { artist: resolved.artist })}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {relatedAlbums.map((a, i) => (
          <AlbumCard key={a.id} album={a} index={i} />
        ))}
      </div>
    </div>
  );
}
