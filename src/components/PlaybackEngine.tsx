'use client';

import { useEffect, useRef } from 'react';
import { useLocalBroadcastStore } from '@/lib/local-broadcast-store';
import { MAX_RECOVERY_ATTEMPTS, recoveryBackoffMs } from '@/lib/playback-recovery';
import { pushRealtimeProgramVuSample } from '@/lib/realtime-program-vu';
import { usePlayerStore } from '@/lib/store';
import type { AudioClass, CrossfadeProfile, Track } from '@/lib/types';

type DeckId = 'A' | 'B';

type AudioGraph = {
  context: AudioContext;
  masterGain: GainNode;
  programOutputGain: GainNode;
  programDuckGain: GainNode;
  cartOutputGain: GainNode;
  previewOutputGain: GainNode;
  deckGains: Record<DeckId, GainNode>;
  cartGains: GainNode[];
  previewGain: GainNode;
  micGain: GainNode;
  analyser: AnalyserNode;
  programAnalyser: AnalyserNode;
  micSource: MediaStreamAudioSourceNode | null;
  micStream: MediaStream | null;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function dbToGain(db: number) {
  return Math.pow(10, db / 20);
}

function incomingProfileForTrack(
  track: Track | null,
  profiles: Record<AudioClass, CrossfadeProfile>,
): CrossfadeProfile {
  if (!track?.audioClass) return profiles.music;
  return profiles[track.audioClass] ?? profiles.music;
}

function fadeDurationMs(profile: CrossfadeProfile) {
  return Math.max(profile.mixPointSec, profile.fadeInSec, profile.fadeOutSec, 0) * 1000;
}

export function PlaybackEngine() {
  const deckRefs = useRef<Record<DeckId, HTMLAudioElement>>({
    A: new Audio(),
    B: new Audio(),
  });
  const previewRef = useRef(new Audio());
  const cartRefs = useRef(Array.from({ length: 4 }, () => new Audio()));
  const graphRef = useRef<AudioGraph | null>(null);
  const frameRef = useRef<number | null>(null);
  const programVuFrameRef = useRef<number | null>(null);
  const activeDeckRef = useRef<DeckId>('A');
  const loadedTrackIdsRef = useRef<Record<DeckId, string | null>>({ A: null, B: null });
  const cartIndexRef = useRef(0);
  const crossfadeRef = useRef<{ active: boolean; nextTrackId: string | null }>({
    active: false,
    nextTrackId: null,
  });
  const interruptHandledRef = useRef<number>(0);
  const previewHandledRef = useRef<number>(0);
  const cartHandledRef = useRef<number>(0);
  const recoveryAttemptsRef = useRef(0);
  const recoveryTimerRef = useRef<number | null>(null);

  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const progress = usePlayerStore((state) => state.progress);
  const volume = usePlayerStore((state) => state.volume);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const repeat = usePlayerStore((state) => state.repeat);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const syncProgress = usePlayerStore((state) => state.syncProgress);
  const handleTrackEnded = usePlayerStore((state) => state.handleTrackEnded);
  const advanceAfterCurrentTrackEnd = usePlayerStore((state) => state.advanceAfterCurrentTrackEnd);
  const getNextTrack = usePlayerStore((state) => state.getNextTrack);

  const playbackSettings = useLocalBroadcastStore((state) => state.playbackSettings);
  const crossfadeProfiles = useLocalBroadcastStore((state) => state.crossfadeProfiles);
  const micSettings = useLocalBroadcastStore((state) => state.micSettings);
  const micLive = useLocalBroadcastStore((state) => state.micLive);
  const previewRequest = useLocalBroadcastStore((state) => state.previewRequest);
  const cartRequest = useLocalBroadcastStore((state) => state.cartRequest);
  const interruptRequest = useLocalBroadcastStore((state) => state.interruptRequest);

  const mediaUrl = currentTrack?.mediaUrl ?? null;
  const effectiveProgramVolume = isMuted ? 0 : volume;
  function clearRecoveryTimer() {
    if (recoveryTimerRef.current != null) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }

  function updateProgramGain(force = false) {
    const graph = graphRef.current;
    if (!graph) return;
    if (!crossfadeRef.current.active || force) {
      graph.programOutputGain.gain.setValueAtTime(
        effectiveProgramVolume,
        graph.context.currentTime,
      );
    }
  }

  function cancelCrossfade() {
    const graph = graphRef.current;
    if (!graph) return;
    crossfadeRef.current = { active: false, nextTrackId: null };
    for (const deck of ['A', 'B'] as DeckId[]) {
      graph.deckGains[deck].gain.cancelScheduledValues(graph.context.currentTime);
    }
    graph.deckGains[activeDeckRef.current].gain.setValueAtTime(1, graph.context.currentTime);
    const inactiveDeck = activeDeckRef.current === 'A' ? 'B' : 'A';
    graph.deckGains[inactiveDeck].gain.setValueAtTime(0, graph.context.currentTime);
    updateProgramGain(true);
  }

  function ensureContext() {
    if (graphRef.current) return graphRef.current;
    const AudioContextCtor = window.AudioContext ?? (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;

    if (!AudioContextCtor) {
      useLocalBroadcastStore.getState().setAudioUnlockState('unsupported');
      return null;
    }

    const context = new AudioContextCtor();
    const masterGain = context.createGain();
    const programOutputGain = context.createGain();
    const programDuckGain = context.createGain();
    const cartOutputGain = context.createGain();
    const previewOutputGain = context.createGain();
    const micGain = context.createGain();
    const analyser = context.createAnalyser();

    masterGain.connect(context.destination);
    programOutputGain.connect(programDuckGain);
    const programAnalyser = context.createAnalyser();
    programAnalyser.fftSize = 256;
    programDuckGain.connect(programAnalyser);
    programAnalyser.connect(masterGain);
    cartOutputGain.connect(masterGain);
    previewOutputGain.connect(masterGain);
    micGain.connect(masterGain);

    const deckGains = {
      A: context.createGain(),
      B: context.createGain(),
    };
    const previewGain = context.createGain();
    const cartGains = cartRefs.current.map(() => context.createGain());

    for (const deck of ['A', 'B'] as DeckId[]) {
      const source = context.createMediaElementSource(deckRefs.current[deck]);
      source.connect(deckGains[deck]);
      deckGains[deck].connect(programOutputGain);
    }

    const previewSource = context.createMediaElementSource(previewRef.current);
    previewSource.connect(previewGain);
    previewGain.connect(previewOutputGain);

    cartRefs.current.forEach((element, index) => {
      const source = context.createMediaElementSource(element);
      source.connect(cartGains[index]);
      cartGains[index].connect(cartOutputGain);
    });

    const graph: AudioGraph = {
      context,
      masterGain,
      programOutputGain,
      programDuckGain,
      cartOutputGain,
      previewOutputGain,
      deckGains,
      cartGains,
      previewGain,
      micGain,
      analyser,
      programAnalyser,
      micSource: null,
      micStream: null,
    };

    graphRef.current = graph;
    graph.programOutputGain.gain.value = effectiveProgramVolume;
    graph.programDuckGain.gain.value = 1;
    graph.cartOutputGain.gain.value = effectiveProgramVolume;
    graph.previewOutputGain.gain.value = playbackSettings.previewEnabled
      ? playbackSettings.monitorVolume
      : 0;
    graph.deckGains.A.gain.value = 1;
    graph.deckGains.B.gain.value = 0;
    graph.previewGain.gain.value = 1;
    graph.cartGains.forEach((gain) => {
      gain.gain.value = 1;
    });
    graph.micGain.gain.value = 0;
    graph.analyser.fftSize = 256;
    graph.programAnalyser.fftSize = 256;
    useLocalBroadcastStore.getState().setAudioUnlockState(
      context.state === 'running' ? 'ready' : 'suspended',
    );
    return graph;
  }

  function resumeContext() {
    const graph = ensureContext();
    if (!graph) return;
    void graph.context.resume().then(
      () => useLocalBroadcastStore.getState().setAudioUnlockState('ready'),
      () => useLocalBroadcastStore.getState().setAudioUnlockState('suspended'),
    );
  }

  useEffect(() => {
    const graph = ensureContext();
    if (!graph) return;
    const previewElement = previewRef.current;
    const cartElements = cartRefs.current;
    const deckElements = deckRefs.current;

    const unlock = () => resumeContext();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    window.addEventListener('broadcast-audio-unlock', unlock as EventListener);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('broadcast-audio-unlock', unlock as EventListener);
      clearRecoveryTimer();
      cancelCrossfade();
      previewElement.pause();
      previewElement.removeAttribute('src');
      previewElement.load();
      cartElements.forEach((element) => {
        element.pause();
        element.removeAttribute('src');
        element.load();
      });
      deckElements.A.pause();
      deckElements.B.pause();
      graph.micStream?.getTracks().forEach((track) => track.stop());
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      graph.context.close().catch(() => undefined);
      previewRef.current = new Audio();
      cartRefs.current = Array.from({ length: cartElements.length }, () => new Audio());
      deckRefs.current = {
        A: new Audio(),
        B: new Audio(),
      };
      loadedTrackIdsRef.current = { A: null, B: null };
      graphRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.programOutputGain.gain.setValueAtTime(
      effectiveProgramVolume,
      graph.context.currentTime,
    );
    graph.cartOutputGain.gain.setValueAtTime(effectiveProgramVolume, graph.context.currentTime);
  }, [effectiveProgramVolume]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.previewOutputGain.gain.setValueAtTime(
      playbackSettings.previewEnabled ? playbackSettings.monitorVolume : 0,
      graph.context.currentTime,
    );
  }, [playbackSettings.monitorVolume, playbackSettings.previewEnabled]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const target = micLive ? dbToGain(micSettings.duckDb) : 1;
    graph.programDuckGain.gain.cancelScheduledValues(graph.context.currentTime);
    graph.programDuckGain.gain.setValueAtTime(graph.programDuckGain.gain.value, graph.context.currentTime);
    graph.programDuckGain.gain.linearRampToValueAtTime(
      target,
      graph.context.currentTime + (micLive ? 0.2 : 0.75),
    );
  }, [micLive, micSettings.duckDb]);

  useEffect(() => {
    if (!micSettings.enabled) {
      const graph = graphRef.current;
      if (graph?.micStream) {
        graph.micStream.getTracks().forEach((track) => track.stop());
        graph.micStream = null;
        graph.micSource?.disconnect();
        graph.micSource = null;
      }
      useLocalBroadcastStore.getState().setMicPermission('unknown');
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      useLocalBroadcastStore.getState().setMicPermission('unsupported', 'Browser input APIs are unavailable');
      return;
    }

    let cancelled = false;

    async function requestMic() {
      const graph = ensureContext();
      if (!graph) return;
      if (graph.micStream) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: micSettings.inputDeviceId ? { exact: micSettings.inputDeviceId } : undefined,
            sampleRate: micSettings.preferredSampleRate,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        graph.micStream = stream;
        graph.micSource = graph.context.createMediaStreamSource(stream);
        graph.micSource.connect(graph.analyser);
        graph.micSource.connect(graph.micGain);
        useLocalBroadcastStore.getState().setMicPermission('granted');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Microphone unavailable';
        useLocalBroadcastStore.getState().setMicPermission(
          message.toLowerCase().includes('denied') ? 'denied' : 'error',
          message,
        );
      }
    }

    void requestMic();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Web Audio graph lifecycle; ensureContext intentionally omitted
  }, [micSettings.enabled, micSettings.inputDeviceId, micSettings.preferredSampleRate]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !graph.analyser) return;
    const data = new Uint8Array(graph.analyser.frequencyBinCount);
    let mounted = true;

    const tick = () => {
      if (!mounted) return;
      graph.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const sample of data) {
        const normalized = (sample - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / data.length);
      useLocalBroadcastStore.getState().setMicLevel(clamp01(rms * 4));
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [micSettings.enabled]);

  useEffect(() => {
    const data = new Uint8Array(256);
    let mounted = true;
    let lastSent = 0;

    const tick = (now: number) => {
      if (!mounted) return;
      const graph = graphRef.current;
      if (graph?.programAnalyser) {
        graph.programAnalyser.getByteTimeDomainData(data);
        let peak = 0;
        let sum = 0;
        for (const sample of data) {
          const normalized = Math.abs((sample - 128) / 128);
          if (normalized > peak) peak = normalized;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / data.length);
        if (now - lastSent >= 64) {
          lastSent = now;
          pushRealtimeProgramVuSample(clamp01(peak), clamp01(rms));
        }
      }
      programVuFrameRef.current = requestAnimationFrame(tick);
    };

    programVuFrameRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (programVuFrameRef.current != null) cancelAnimationFrame(programVuFrameRef.current);
      programVuFrameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const graph = ensureContext();
    if (!graph) return;
    const activeDeck = activeDeckRef.current;
    const element = deckRefs.current[activeDeck];

    if (!currentTrack || !mediaUrl) {
      element.pause();
      return;
    }

    if (loadedTrackIdsRef.current[activeDeck] === currentTrack.id && element.src === mediaUrl) {
      return;
    }

    cancelCrossfade();
    loadedTrackIdsRef.current[activeDeck] = currentTrack.id;
    element.src = mediaUrl;
    element.preload = 'metadata';
    element.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deck load; refs + partial track identity deps only
  }, [currentTrack?.id, mediaUrl]);

  useEffect(() => {
    const element = deckRefs.current[activeDeckRef.current];
    if (!element || !mediaUrl) return;
    if (isPlaying) {
      resumeContext();
      void element.play().catch(() => {
        useLocalBroadcastStore.getState().setAudioUnlockState('suspended');
      });
    } else {
      element.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- play/pause; resumeContext via audio element graph
  }, [isPlaying, mediaUrl, currentTrack?.id]);

  useEffect(() => {
    const element = deckRefs.current[activeDeckRef.current];
    if (!element || !currentTrack || !mediaUrl) return;
    const duration = Number.isFinite(element.duration) && element.duration > 0
      ? element.duration
      : currentTrack.duration;
    if (!duration) return;
    const target = clamp01(progress) * duration;
    if (Math.abs(element.currentTime - target) > 0.25) {
      element.currentTime = target;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seek sync; duration from element or currentTrack snapshot
  }, [progress, currentTrack?.id, mediaUrl]);

  useEffect(() => {
    recoveryAttemptsRef.current = 0;
    clearRecoveryTimer();
  }, [currentTrack?.id, mediaUrl]);

  useEffect(() => {
    const onOffline = () => usePlayerStore.getState().setPlaybackConnectionState('offline');
    const onOnline = () => usePlayerStore.getState().setPlaybackConnectionState('ok');
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    const activeDeck = activeDeckRef.current;
    const activeElement = deckRefs.current[activeDeck];

    const onTimeUpdate = () => {
      const duration = Number.isFinite(activeElement.duration) && activeElement.duration > 0
        ? activeElement.duration
        : currentTrack?.duration ?? 0;
      if (duration > 0) {
        syncProgress(activeElement.currentTime / duration);
      }

      const candidateNext = getNextTrack();
      const profile = incomingProfileForTrack(candidateNext, crossfadeProfiles);
      const fadeMs = fadeDurationMs(profile);
      const canCrossfade =
        fadeMs > 0 &&
        !shuffle &&
        repeat !== 'one' &&
        candidateNext?.mediaUrl &&
        currentTrack?.mediaUrl &&
        !crossfadeRef.current.active;

      if (!canCrossfade || !candidateNext) return;
      const remaining = Math.max(0, duration - activeElement.currentTime);
      if (remaining > profile.mixPointSec + 0.05) return;

      const graph = ensureContext();
      if (!graph) return;
      const nextDeck: DeckId = activeDeck === 'A' ? 'B' : 'A';
      const nextElement = deckRefs.current[nextDeck];
      loadedTrackIdsRef.current[nextDeck] = candidateNext.id;
      nextElement.src = candidateNext.mediaUrl!;
      nextElement.preload = 'auto';
      nextElement.load();
      crossfadeRef.current = { active: true, nextTrackId: candidateNext.id };
      graph.deckGains[nextDeck].gain.setValueAtTime(0, graph.context.currentTime);
      graph.deckGains[activeDeck].gain.setValueAtTime(1, graph.context.currentTime);
      resumeContext();
      void nextElement.play().catch(() => {
        crossfadeRef.current = { active: false, nextTrackId: null };
      });

      const endAt = graph.context.currentTime + fadeMs / 1000;
      const curveStart = profile.curve === 'log' ? 0.001 : 0;
      graph.deckGains[nextDeck].gain.cancelScheduledValues(graph.context.currentTime);
      graph.deckGains[activeDeck].gain.cancelScheduledValues(graph.context.currentTime);
      graph.deckGains[nextDeck].gain.setValueAtTime(curveStart, graph.context.currentTime);
      graph.deckGains[activeDeck].gain.setValueAtTime(1, graph.context.currentTime);
      if (profile.curve === 'log') {
        graph.deckGains[nextDeck].gain.exponentialRampToValueAtTime(1, endAt);
        graph.deckGains[activeDeck].gain.exponentialRampToValueAtTime(0.001, endAt);
      } else {
        graph.deckGains[nextDeck].gain.linearRampToValueAtTime(1, endAt);
        graph.deckGains[activeDeck].gain.linearRampToValueAtTime(0, endAt);
      }
    };

    const onEnded = () => {
      const nextDeck: DeckId = activeDeck === 'A' ? 'B' : 'A';
      const nextElement = deckRefs.current[nextDeck];

      if (
        crossfadeRef.current.active &&
        nextElement.src &&
        crossfadeRef.current.nextTrackId === getNextTrack()?.id
      ) {
        const next = getNextTrack();
        if (next) {
          const progressForNext = Math.min(
            1,
            nextElement.currentTime / Math.max(1, next.duration || nextElement.duration || 1),
          );
          activeDeckRef.current = nextDeck;
          useLocalBroadcastStore.getState().setActiveDeck(nextDeck);
          advanceAfterCurrentTrackEnd(progressForNext);
          cancelCrossfade();
        }
        return;
      }

      cancelCrossfade();
      handleTrackEnded();
    };

    const onError = () => {
      const state = usePlayerStore.getState();
      if (!state.currentTrack?.mediaUrl || !state.isPlaying) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        state.setPlaybackConnectionState('offline');
        return;
      }
      if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
        state.setPlaybackConnectionState('failed');
        return;
      }
      state.setPlaybackConnectionState('recovering');
      recoveryAttemptsRef.current += 1;
      clearRecoveryTimer();
      recoveryTimerRef.current = window.setTimeout(() => {
        activeElement.pause();
        activeElement.load();
        void activeElement.play().then(
          () => {
            recoveryAttemptsRef.current = 0;
            usePlayerStore.getState().setPlaybackConnectionState('ok');
          },
          () => undefined,
        );
      }, recoveryBackoffMs(recoveryAttemptsRef.current));
    };

    const onPlaying = () => {
      recoveryAttemptsRef.current = 0;
      clearRecoveryTimer();
      usePlayerStore.getState().setPlaybackConnectionState('ok');
    };

    activeElement.addEventListener('timeupdate', onTimeUpdate);
    activeElement.addEventListener('ended', onEnded);
    activeElement.addEventListener('error', onError);
    activeElement.addEventListener('playing', onPlaying);
    return () => {
      activeElement.removeEventListener('timeupdate', onTimeUpdate);
      activeElement.removeEventListener('ended', onEnded);
      activeElement.removeEventListener('error', onError);
      activeElement.removeEventListener('playing', onPlaying);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- active deck listeners; store fns + crossfade graph
  }, [
    advanceAfterCurrentTrackEnd,
    crossfadeProfiles,
    currentTrack?.id,
    getNextTrack,
    handleTrackEnded,
    repeat,
    shuffle,
    syncProgress,
  ]);

  useEffect(() => {
    if (!previewRequest || previewRequest.nonce === previewHandledRef.current) return;
    previewHandledRef.current = previewRequest.nonce;
    const previewElement = previewRef.current;
    if (!previewRequest.track?.mediaUrl) {
      previewElement.pause();
      previewElement.removeAttribute('src');
      previewElement.load();
      return;
    }
    resumeContext();
    previewElement.src = previewRequest.track.mediaUrl;
    previewElement.load();
    void previewElement.play().catch(() => {
      useLocalBroadcastStore.getState().setAudioUnlockState('suspended');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preview pipe; resumeContext stable for this flow
  }, [previewRequest]);

  useEffect(() => {
    if (!cartRequest || cartRequest.nonce === cartHandledRef.current) return;
    cartHandledRef.current = cartRequest.nonce;
    if (!cartRequest.track.mediaUrl) return;
    resumeContext();
    const index = cartIndexRef.current % cartRefs.current.length;
    cartIndexRef.current += 1;
    const element = cartRefs.current[index];
    element.src = cartRequest.track.mediaUrl;
    element.load();
    void element.play().catch(() => {
      useLocalBroadcastStore.getState().setAudioUnlockState('suspended');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cart fire-and-forget
  }, [cartRequest]);

  useEffect(() => {
    if (!interruptRequest || interruptRequest.nonce === interruptHandledRef.current) return;
    interruptHandledRef.current = interruptRequest.nonce;
    const graph = ensureContext();
    if (!graph) return;

    const activeDeck = activeDeckRef.current;
    graph.programOutputGain.gain.cancelScheduledValues(graph.context.currentTime);
    graph.programOutputGain.gain.setValueAtTime(graph.programOutputGain.gain.value, graph.context.currentTime);
    graph.programOutputGain.gain.linearRampToValueAtTime(
      0,
      graph.context.currentTime + interruptRequest.fadeMs / 1000,
    );

    window.setTimeout(() => {
      const player = usePlayerStore.getState();
      player.play(interruptRequest.track);
      graph.deckGains.A.gain.setValueAtTime(activeDeck === 'A' ? 1 : 0, graph.context.currentTime);
      graph.deckGains.B.gain.setValueAtTime(activeDeck === 'B' ? 1 : 0, graph.context.currentTime);
      updateProgramGain(true);
    }, interruptRequest.fadeMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- interrupt fade + ensureContext
  }, [interruptRequest]);

  useEffect(() => {
    if (!currentTrack || mediaUrl || !currentTrack.duration || !isPlaying) return;
    const id = window.setInterval(() => {
      const state = usePlayerStore.getState();
      if (!state.currentTrack || state.currentTrack.mediaUrl) return;
      const nextProgress = clamp01(state.progress + 0.1 / Math.max(1, state.currentTrack.duration));
      state.syncProgress(nextProgress);
      if (nextProgress >= 1) {
        state.handleTrackEnded();
      }
    }, 100);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mock progress ticks use store inside interval
  }, [currentTrack?.id, currentTrack?.duration, isPlaying, mediaUrl]);

  return null;
}
