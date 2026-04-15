"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Disc3,
  FolderPlus,
  Library,
  Mic,
  MicOff,
  Radio,
  Rows3,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SortableQueueList } from "@/components/queue/SortableQueueList";
import { extractAudioFilesFromDrop } from "@/lib/drop-audio-files";
import { sortedEventsByNextRun } from "@/lib/broadcast-scheduler";
import { useLocalBroadcastStore } from "@/lib/local-broadcast-store";
import { formatDuration } from "@/lib/format";
import { usePlayerStore } from "@/lib/store";

function StatusPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : tone === "warning"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
        : "border-border bg-muted/30 text-foreground";

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

export default function BroadcastConsolePage() {
  const [importingProgram, setImportingProgram] = useState(false);
  const [importingCartSlot, setImportingCartSlot] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queue = usePlayerStore((state) => state.queue);
  const queueIndex = usePlayerStore((state) => state.queueIndex);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const progress = usePlayerStore((state) => state.progress);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const getNextTrack = usePlayerStore((state) => state.getNextTrack);
  const addToQueue = usePlayerStore((state) => state.addToQueue);
  const setQueue = usePlayerStore((state) => state.setQueue);

  const assets = useLocalBroadcastStore((state) => state.assets);
  const cartSlots = useLocalBroadcastStore((state) => state.cartSlots);
  const schedulerEvents = useLocalBroadcastStore((state) => state.schedulerEvents);
  const playbackSettings = useLocalBroadcastStore((state) => state.playbackSettings);
  const micSettings = useLocalBroadcastStore((state) => state.micSettings);
  const micLive = useLocalBroadcastStore((state) => state.micLive);
  const micLevel = useLocalBroadcastStore((state) => state.micLevel);
  const activeDeck = useLocalBroadcastStore((state) => state.activeDeck);
  const audioUnlockState = useLocalBroadcastStore((state) => state.audioUnlockState);
  const importAudioFiles = useLocalBroadcastStore((state) => state.importAudioFiles);
  const setCartSlotAsset = useLocalBroadcastStore((state) => state.setCartSlotAsset);
  const updateCartSlot = useLocalBroadcastStore((state) => state.updateCartSlot);
  const triggerCartSlot = useLocalBroadcastStore((state) => state.triggerCartSlot);
  const setMicLive = useLocalBroadcastStore((state) => state.setMicLive);

  const nextScheduled = useMemo(
    () => sortedEventsByNextRun(schedulerEvents, new Date())[0] ?? null,
    [schedulerEvents],
  );

  const nextTrack = getNextTrack();
  const remainingSec = currentTrack
    ? Math.max(0, Math.round(currentTrack.duration * (1 - progress)))
    : 0;

  const assetTitleById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset.title])),
    [assets],
  );

  const queueDropHint =
    queue.length === 0 ? "Drop audio files here to build the main playlist." : "Drop more files to append them to the main playlist.";

  async function importIntoProgram(files: File[]) {
    if (files.length === 0) return;
    setImportingProgram(true);
    try {
      const hadLocalAssets = assets.length > 0;
      const { added, errors } = await importAudioFiles(files, { audioClass: "music" });
      if (added.length > 0) {
        const replaceQueue =
          !hadLocalAssets &&
          (queue.length === 0 || queue.every((track) => track.source !== "local")) &&
          !isPlaying;
        if (replaceQueue) {
          setQueue(added, 0);
        } else {
          for (const track of added) {
            addToQueue(track);
          }
        }
        toast.success(
          added.length === 1
            ? `Imported ${added[0].title}`
            : `Imported ${added.length} files to the playlist`,
        );
      }
      for (const error of errors) {
        toast.error(error);
      }
    } finally {
      setImportingProgram(false);
    }
  }

  async function importIntoCart(slotIndex: number, files: File[]) {
    if (files.length === 0) return;
    setImportingCartSlot(slotIndex);
    try {
      const { assetIds, added, errors } = await importAudioFiles(files, { audioClass: "cart" });
      const importedTitleById = new Map(
        added
          .filter((track) => track.assetId)
          .map((track) => [track.assetId as string, track.title]),
      );
      for (let index = 0; index < assetIds.length; index += 1) {
        const targetSlot = slotIndex + index;
        if (targetSlot > 11) break;
        const assetId = assetIds[index];
        await setCartSlotAsset(targetSlot, assetId);
        const label =
          importedTitleById.get(assetId) ??
          assetTitleById.get(assetId) ??
          `Cart ${targetSlot + 1}`;
        await updateCartSlot(targetSlot, { label });
      }
      if (assetIds.length > 0) {
        toast.success(
          assetIds.length === 1
            ? `Assigned file to cart slot ${slotIndex + 1}`
            : `Assigned ${Math.min(assetIds.length, 12 - slotIndex)} cart slots`,
        );
      }
      for (const error of errors) {
        toast.error(error);
      }
    } finally {
      setImportingCartSlot(null);
    }
  }

  return (
    <div className="app-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Radio className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Broadcast Console</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Import local audio, manage the live queue, fire carts instantly, and watch the next scheduled event.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/app/automation">
              <CalendarClock className="mr-2 h-4 w-4" />
              Scheduler
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/app/cart">
              <Disc3 className="mr-2 h-4 w-4" />
              Cart setup
            </Link>
          </Button>
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importingProgram}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            {importingProgram ? "Importing..." : "Import audio"}
          </Button>
        </div>
      </div>

      {audioUnlockState === "suspended" && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Audio is waiting for a browser gesture</p>
              <p className="mt-1 text-amber-50/80">
                Click anywhere in the app or use the button to unlock the local audio engine.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.dispatchEvent(new CustomEvent("broadcast-audio-unlock"))}
            >
              Enable audio
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-5">
        <StatusPill
          label="On-air"
          tone={isPlaying ? "success" : "warning"}
          value={isPlaying ? "LIVE" : "Stopped"}
        />
        <StatusPill label="Program deck" value={activeDeck} />
        <StatusPill
          label="Current track"
          value={currentTrack ? `${currentTrack.title} · ${formatDuration(remainingSec)} left` : "No program track"}
        />
        <StatusPill
          label="Up next"
          value={nextTrack ? nextTrack.title : "No next track"}
        />
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mic</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {micLive ? "Open" : "Closed"}
              </p>
              <p className="text-xs text-muted-foreground">
                Duck {micSettings.duckDb} dB · {micSettings.mode === "ptt" ? "Push to talk" : "Toggle"}
              </p>
            </div>
            {micSettings.mode === "toggle" ? (
              <Button
                type="button"
                variant={micLive ? "destructive" : "secondary"}
                onClick={() => setMicLive(!micLive)}
              >
                {micLive ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                {micLive ? "Close mic" : "Open mic"}
              </Button>
            ) : (
              <Button
                type="button"
                variant={micLive ? "destructive" : "secondary"}
                onMouseDown={() => setMicLive(true)}
                onMouseUp={() => setMicLive(false)}
                onMouseLeave={() => setMicLive(false)}
                onTouchStart={() => setMicLive(true)}
                onTouchEnd={() => setMicLive(false)}
              >
                <Mic className="mr-2 h-4 w-4" />
                Hold to talk
              </Button>
            )}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/70">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${Math.max(4, Math.round(micLevel * 100))}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2.2fr)_minmax(360px,1fr)]">
        <div className="space-y-4">
          <div
            className="rounded-2xl border border-dashed border-border bg-muted/20 p-4"
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDrop={async (event) => {
              event.preventDefault();
              event.stopPropagation();
              const files = await extractAudioFilesFromDrop(event);
              await importIntoProgram(files);
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Main playlist</p>
                <p className="text-xs text-muted-foreground">{queueDropHint}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Rows3 className="h-4 w-4" />
                Drag to reorder queue rows
              </div>
            </div>
          </div>

          <div className="surface-2 overflow-hidden rounded-2xl border border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Program queue</p>
                <p className="text-xs text-muted-foreground">
                  {queue.length} tracks · Monitor {Math.round(playbackSettings.monitorVolume * 100)}%
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/app/queue">
                  <Library className="mr-2 h-4 w-4" />
                  Open queue page
                </Link>
              </Button>
            </div>
            {queue.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Import audio to create your first live playlist.
              </div>
            ) : (
              <SortableQueueList
                queue={queue}
                queueIndex={queueIndex}
                progress={progress}
                currentTrack={currentTrack}
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-2 rounded-2xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Cart wall</p>
                <p className="text-xs text-muted-foreground">
                  Keys 1–9 trigger slots 1–9. Drop audio on a slot to assign it instantly.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/app/cart">Configure</Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {cartSlots.map((slot) => {
                const slotTitle = slot.assetId ? assetTitleById.get(slot.assetId) ?? slot.label : slot.label;
                return (
                  <button
                    key={slot.slotIndex}
                    type="button"
                    className={`min-h-[92px] rounded-xl border p-3 text-left transition hover:scale-[1.01] hover:border-primary/40 ${slot.color}`}
                    onClick={() => triggerCartSlot(slot.slotIndex)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onDrop={async (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const files = await extractAudioFilesFromDrop(event);
                      await importIntoCart(slot.slotIndex, files);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Slot {slot.slotIndex + 1}
                          {slot.hotkey ? ` · ${slot.hotkey}` : ""}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
                          {slotTitle}
                        </p>
                      </div>
                      <Volume2 className="h-4 w-4 shrink-0 text-primary" />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {slot.assetId ? "Click to fire over program audio." : "Drop file here"}
                    </p>
                    {importingCartSlot === slot.slotIndex && (
                      <p className="mt-2 text-xs text-primary">Importing...</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="surface-2 rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Next scheduled event</p>
                <p className="text-xs text-muted-foreground">
                  The scheduler checks every second and supports interrupt or queue-complete launches.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/app/automation">Open scheduler</Link>
              </Button>
            </div>
            <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
              {nextScheduled?.nextRun ? (
                <>
                  <p className="text-sm font-medium text-foreground">{nextScheduled.event.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {nextScheduled.event.mode === "interrupt" ? "Interrupt" : "Queue complete"} ·{" "}
                    {nextScheduled.nextRun.toLocaleString()}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No active events scheduled.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg,.opus,.webm"
        multiple
        className="hidden"
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          await importIntoProgram(files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
