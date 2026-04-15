import { useEffect } from 'react';
import { eventMatchesSecond, localSecondKey } from '@/lib/broadcast-scheduler';
import { trackFromLocalAsset, useLocalBroadcastStore } from '@/lib/local-broadcast-store';
import { usePlayerStore } from '@/lib/store';

export function SchedulerBridge() {
  const hydrated = useLocalBroadcastStore((state) => state.hydrated);
  const schedulerEvents = useLocalBroadcastStore((state) => state.schedulerEvents);
  const runtime = useLocalBroadcastStore((state) => state.runtime);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  useEffect(() => {
    if (!hydrated) return;

    const id = window.setInterval(() => {
      const now = new Date();
      const key = localSecondKey(now);
      const store = useLocalBroadcastStore.getState();
      const player = usePlayerStore.getState();

      for (const event of store.schedulerEvents) {
        if (!eventMatchesSecond(event, now)) continue;
        if (store.runtime.lastFiredKeys[event.id] === key) continue;

        void store.setSchedulerLastFiredKey(event.id, key);
        const track = trackFromLocalAsset(event.assetId);
        if (!track) continue;

        if (event.mode === 'interrupt') {
          store.requestInterruptPlayback(track, 350);
          void store.setSchedulerPending(event.id, false);
          continue;
        }

        if (player.currentTrack && player.isPlaying) {
          player.playNext(track);
          void store.setSchedulerPending(event.id, true);
        } else {
          player.play(track);
          void store.setSchedulerPending(event.id, false);
        }
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || runtime.pendingEventIds.length === 0) return;
    if (!currentTrack?.assetId || !isPlaying) return;

    for (const eventId of runtime.pendingEventIds) {
      const event = schedulerEvents.find((item) => item.id === eventId);
      if (!event) continue;
      if (event.assetId === currentTrack.assetId) {
        void useLocalBroadcastStore.getState().setSchedulerPending(eventId, false);
      }
    }
  }, [currentTrack?.assetId, hydrated, isPlaying, runtime.pendingEventIds, schedulerEvents]);

  return null;
}
