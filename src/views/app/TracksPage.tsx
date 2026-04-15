"use client";
import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useMergedTracks } from '@/lib/library';
import { usePlayerStore } from '@/lib/store';
import { TrackRow } from '@/components/TrackRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Music2, ListChecks } from 'lucide-react';
import type { Track } from '@/lib/types';

type SortKey = 'title' | 'artist' | 'duration';

function sortTracks(list: Track[], key: SortKey): Track[] {
  const copy = [...list];
  copy.sort((a, b) => {
    if (key === 'duration') return a.duration - b.duration;
    if (key === 'artist') return a.artist.localeCompare(b.artist);
    return a.title.localeCompare(b.title);
  });
  return copy;
}

export default function TracksPage() {
  const { t } = useTranslation();
  const allTracks = useMergedTracks();
  const addToQueue = usePlayerStore((s) => s.addToQueue);

  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<string>('__all__');
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const genres = useMemo(() => {
    const g = new Set(allTracks.map((tr) => tr.genre).filter(Boolean));
    return ['__all__', ...[...g].sort((a, b) => a.localeCompare(b))];
  }, [allTracks]);

  const filtered = useMemo(() => {
    let list = allTracks;
    if (genre !== '__all__') {
      list = list.filter((tr) => tr.genre === genre);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (tr) =>
          tr.title.toLowerCase().includes(q) ||
          tr.artist.toLowerCase().includes(q) ||
          tr.album.toLowerCase().includes(q)
      );
    }
    return sortTracks(list, sortKey);
  }, [allTracks, genre, query, sortKey]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelected(new Set(filtered.map((tr) => tr.id)));
  }, [filtered]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const addSelectedToQueue = useCallback(() => {
    const ids = [...selected];
    let count = 0;
    for (const id of ids) {
      const tr = allTracks.find((x) => x.id === id);
      if (tr) {
        addToQueue(tr);
        count++;
      }
    }
    if (count > 0) {
      toast.success(t('tracks.addedToQueue', { count }));
      clearSelection();
      setSelectionMode(false);
    }
  }, [selected, allTracks, addToQueue, t, clearSelection]);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    clearSelection();
  }, [clearSelection]);

  return (
    <div className="app-page space-y-6">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <Music2 className="w-6 h-6 text-primary shrink-0" />
        <h1 className="text-3xl font-bold text-foreground">{t('tracks.title')}</h1>
        <span className="text-sm text-muted-foreground">{t('tracks.count', { count: allTracks.length })}</span>
      </div>
      <p className="text-sm text-muted-foreground max-w-[60ch]">{t('tracks.intro')}</p>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <Label htmlFor="tracks-search" className="text-xs text-muted-foreground">
            {t('search.title')}
          </Label>
          <Input
            id="tracks-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tracks.searchPlaceholder')}
            className="min-h-[44px]"
          />
        </div>
        <div className="space-y-1.5 w-full sm:w-44">
          <Label className="text-xs text-muted-foreground">{t('tracks.filterGenre')}</Label>
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {genres.map((g) => (
                <SelectItem key={g} value={g}>
                  {g === '__all__' ? t('tracks.allGenres') : g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 w-full sm:w-44">
          <Label className="text-xs text-muted-foreground">{t('tracks.sortBy')}</Label>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">{t('tracks.sortTitle')}</SelectItem>
              <SelectItem value="artist">{t('tracks.sortArtist')}</SelectItem>
              <SelectItem value="duration">{t('tracks.sortDuration')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant={selectionMode ? 'secondary' : 'outline'}
          className="gap-2 min-h-[44px]"
          onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
        >
          <ListChecks className="w-4 h-4" />
          {selectionMode ? t('tracks.doneSelecting') : t('tracks.selectMode')}
        </Button>
      </div>

      {selectionMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <span className="text-sm text-muted-foreground">{t('tracks.selectedCount', { count: selected.size })}</span>
          <Button type="button" variant="outline" size="sm" onClick={selectAllVisible}>
            {t('tracks.selectAll')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
            {t('tracks.clearSelection')}
          </Button>
          <Button type="button" size="sm" className="gap-1" onClick={addSelectedToQueue} disabled={selected.size === 0}>
            {t('tracks.addToQueue')}
          </Button>
        </div>
      )}

      <div className="surface-2 border border-border rounded-xl overflow-hidden min-h-[120px]">
        {allTracks.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">{t('tracks.emptyLibrary')}</p>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">{t('tracks.emptyFiltered')}</p>
        ) : (
          filtered.map((tr, i) => (
            <TrackRow
              key={tr.id}
              track={tr}
              index={i}
              selectionMode={selectionMode}
              selected={selected.has(tr.id)}
              onToggleSelect={toggleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
