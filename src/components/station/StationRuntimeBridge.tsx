"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import {
  createStationClient,
  getTauriStationAdapter,
  listenToStationEvents,
} from "@/lib/station/station-client";
import { isStationMode } from "@/lib/station/station-mode";
import { useLocalBroadcastStore } from "@/lib/local-broadcast-store";
import { usePlayerStore } from "@/lib/store";

function trackAssetId(track: { assetId?: string; id: string } | null) {
  return track?.assetId ?? track?.id ?? null;
}

function readTransportPatch() {
  const player = usePlayerStore.getState();
  const broadcast = useLocalBroadcastStore.getState();
  const duration = player.currentTrack?.duration ?? 0;

  return {
    playing: player.isPlaying,
    currentAssetId: trackAssetId(player.currentTrack),
    queueAssetIds: player.queue.map((track) => trackAssetId(track)).filter(Boolean) as string[],
    positionSec: Math.max(0, player.progress * duration),
    activeDeck: broadcast.activeDeck,
  };
}

export function StationRuntimeBridge() {
  useEffect(() => {
    if (!isStationMode()) return;
    let active = true;
    let applyingNativeState = false;
    let stopEvents: (() => void) | null = null;
    let stopPlayerSync: (() => void) | null = null;
    let stopDeckSync: (() => void) | null = null;
    let lastVuAt = 0;
    const stopRuntimeSync = () => {
      stopPlayerSync?.();
      stopPlayerSync = null;
      stopDeckSync?.();
      stopDeckSync = null;
      stopEvents?.();
      stopEvents = null;
    };

    void getTauriStationAdapter()
      .then(async (adapter) => {
        if (!active) return;
        const client = createStationClient(adapter);
        await client.health();
        if (!active) return;
        let lastTransportSignature = "";
        const syncTransport = () => {
          if (applyingNativeState) return;
          const patch = readTransportPatch();
          const signature = JSON.stringify(patch);
          if (signature === lastTransportSignature) return;
          lastTransportSignature = signature;
          void client.setTransport(patch).catch((error) => {
            const message = error instanceof Error ? error.message : "Station transport failed";
            toast.error(message);
          });
        };

        syncTransport();
        stopPlayerSync = usePlayerStore.subscribe(syncTransport);
        stopDeckSync = useLocalBroadcastStore.subscribe(syncTransport);

        const unlistenEvents = await listenToStationEvents(adapter, {
          "station:transport": (state) => {
            applyingNativeState = true;
            usePlayerStore.setState({
              isPlaying: state.playing,
              progress: 0,
              currentTrackStartedAtMs: state.playing ? Date.now() : null,
            });
            useLocalBroadcastStore.getState().setActiveDeck(state.activeDeck);
            lastTransportSignature = JSON.stringify(readTransportPatch());
            applyingNativeState = false;
          },
          "station:vu": (frame) => {
            const { lowResourceSettings } = useLocalBroadcastStore.getState();
            if (lowResourceSettings.enabled) {
              const now = Date.now();
              const minFrameMs = 1000 / lowResourceSettings.vuFps;
              if (now - lastVuAt < minFrameMs) return;
              lastVuAt = now;
            }
            useLocalBroadcastStore.getState().setMicLevel(frame.rms);
          },
          "station:engine-error": (error) => {
            toast.error(error.message);
          },
          "station:persistence-error": (error) => {
            toast.error(`${error.operation}: ${error.message}`);
          },
        });
        if (!active) {
          unlistenEvents();
          return;
        }
        stopEvents = unlistenEvents;
      })
      .catch((error) => {
        stopRuntimeSync();
        const message = error instanceof Error ? error.message : "Station backend unavailable";
        toast.error(message);
      });

    return () => {
      active = false;
      stopRuntimeSync();
    };
  }, []);

  return null;
}
