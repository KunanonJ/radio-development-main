import { runWithRemoteRealtimeApply } from '@/lib/realtime-local-emit';
import { getLocalAssetTracks, useLocalBroadcastStore } from '@/lib/local-broadcast-store';
import { mockTracks } from '@/lib/mock-data';
import type { RealtimeCmdAction } from '@/lib/realtime-protocol';
import { usePlayerStore } from '@/lib/store';
import type { Track } from '@/lib/types';

export type DuckTimerRef = { current: ReturnType<typeof setTimeout> | null };

function buildTrackIndex(): Map<string, Track> {
  const map = new Map<string, Track>();
  for (const t of mockTracks) map.set(t.id, t);
  for (const t of usePlayerStore.getState().queue) map.set(t.id, t);
  for (const t of getLocalAssetTracks()) map.set(t.id, t);
  return map;
}

function applyRemoteCmdInner(payload: RealtimeCmdAction, duckTimerRef: DuckTimerRef) {
  const player = usePlayerStore.getState();

  switch (payload.action) {
    case 'play':
      player.play();
      return;
    case 'pause':
      player.pause();
      return;
    case 'stop':
      player.pause();
      player.seek(0);
      return;
    case 'next':
      player.next();
      return;
    case 'previous':
      player.previous();
      return;
    case 'seek':
      player.seek(payload.progress);
      return;
    case 'load_track': {
      const track = buildTrackIndex().get(payload.trackId);
      if (track) player.play(track);
      return;
    }
    case 'set_queue': {
      const map = buildTrackIndex();
      const tracks: Track[] = [];
      for (const id of payload.trackIds) {
        const t = map.get(id);
        if (t) tracks.push(t);
      }
      if (tracks.length > 0) player.setQueue(tracks, 0);
      return;
    }
    case 'duck': {
      if (duckTimerRef.current) clearTimeout(duckTimerRef.current);
      const lb = useLocalBroadcastStore.getState();
      const prevDuck = lb.micSettings.duckDb;
      useLocalBroadcastStore.setState({
        micSettings: { ...lb.micSettings, duckDb: payload.db },
      });
      const ms = Math.max(0, payload.ms);
      duckTimerRef.current = setTimeout(() => {
        duckTimerRef.current = null;
        const s = useLocalBroadcastStore.getState();
        useLocalBroadcastStore.setState({
          micSettings: { ...s.micSettings, duckDb: prevDuck },
        });
      }, ms);
      return;
    }
    case 'mic':
      useLocalBroadcastStore.getState().setMicLive(payload.on);
      return;
    default: {
      const _exhaustive: never = payload;
      return _exhaustive;
    }
  }
}

/** Apply a remote control payload inside the “remote apply” guard (no echo to WebSocket). */
export function applyRemoteRealtimeCmd(payload: RealtimeCmdAction, duckTimerRef: DuckTimerRef) {
  return runWithRemoteRealtimeApply(() => applyRemoteCmdInner(payload, duckTimerRef));
}
