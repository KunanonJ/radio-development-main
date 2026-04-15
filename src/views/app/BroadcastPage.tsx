"use client";
import { useBroadcastStore, formatBroadcastMetadata } from '@/lib/broadcast-store';
import { usePlayerStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Radio, Copy, AlertCircle } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export default function BroadcastPage() {
  const { t } = useTranslation();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isOnAir = useBroadcastStore((s) => s.isOnAir);
  const streamMount = useBroadcastStore((s) => s.streamMount);
  const metadataTemplate = useBroadcastStore((s) => s.metadataTemplate);
  const encoderStatus = useBroadcastStore((s) => s.encoderStatus);
  const lastMetadata = useBroadcastStore((s) => s.lastMetadata);
  const lastError = useBroadcastStore((s) => s.lastError);
  const setStreamMount = useBroadcastStore((s) => s.setStreamMount);
  const setMetadataTemplate = useBroadcastStore((s) => s.setMetadataTemplate);
  const mockStartEncoder = useBroadcastStore((s) => s.mockStartEncoder);
  const mockStopEncoder = useBroadcastStore((s) => s.mockStopEncoder);
  const setLastError = useBroadcastStore((s) => s.setLastError);

  const preview = currentTrack
    ? formatBroadcastMetadata(metadataTemplate, currentTrack.title, currentTrack.artist, currentTrack.album)
    : '';

  const encoderStatusLabel = t(`broadcast.encoderStates.${encoderStatus}` as const);

  const copyLine = useCallback(async () => {
    const line = lastMetadata || preview;
    if (!line) return;
    try {
      await navigator.clipboard.writeText(line);
    } catch {
      setLastError(t('broadcast.clipboardError'));
    }
  }, [lastMetadata, preview, setLastError, t]);

  return (
    <div className="app-page-narrow">
      <div className="flex items-center gap-3 mb-2">
        <Radio className="w-6 h-6 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">{t('broadcast.title')}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">{t('broadcast.intro')}</p>

      <div className="surface-2 border border-border rounded-xl p-5 space-y-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Switch
              id="on-air"
              checked={isOnAir}
              onCheckedChange={(v) => {
                if (v) mockStartEncoder();
                else mockStopEncoder();
              }}
            />
            <Label htmlFor="on-air" className="text-base cursor-pointer">
              {t('broadcast.onAir')}
            </Label>
          </div>
          <div
            className={`text-xs font-mono px-2 py-1 rounded-md border ${
              encoderStatus === 'streaming'
                ? 'border-primary text-primary bg-primary/10'
                : encoderStatus === 'connecting'
                  ? 'border-neon-amber text-neon-amber'
                  : 'border-border text-muted-foreground'
            }`}
          >
            {t('broadcast.encoderLabel', { status: encoderStatusLabel })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mount">{t('broadcast.mountLabel')}</Label>
          <Input
            id="mount"
            value={streamMount}
            onChange={(e) => setStreamMount(e.target.value)}
            placeholder="/stream"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="meta-tpl">{t('broadcast.metadataTemplate')}</Label>
          <Input
            id="meta-tpl"
            value={metadataTemplate}
            onChange={(e) => setMetadataTemplate(e.target.value)}
            placeholder="{artist} — {title}"
          />
          <p className="text-[11px] text-muted-foreground">{t('broadcast.placeholderHint')}</p>
        </div>

        <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t('broadcast.livePreview')}</p>
          <p className="text-sm font-mono text-foreground break-all">{preview || '—'}</p>
          <p className="text-[11px] text-muted-foreground">
            {t('broadcast.lastPushed')} <span className="text-foreground">{lastMetadata || '—'}</span>
          </p>
        </div>

        {lastError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {lastError}
          </div>
        )}

        <Button type="button" variant="secondary" className="gap-2" onClick={() => void copyLine()}>
          <Copy className="w-4 h-4" />
          {t('broadcast.copyMetadata')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{t('broadcast.tip')}</p>
    </div>
  );
}
