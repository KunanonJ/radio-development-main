import type { RealtimeCmdAction } from '@/lib/realtime-protocol';

let remoteApplyDepth = 0;

/** Wrap inbound `cmd_broadcast` handling so local store updates are not re-broadcast as outbound cmds. */
export function runWithRemoteRealtimeApply<T>(fn: () => T): T {
  remoteApplyDepth += 1;
  try {
    return fn();
  } finally {
    remoteApplyDepth -= 1;
  }
}

export function shouldEmitLocalPlaybackRealtime(): boolean {
  return remoteApplyDepth === 0;
}

type EmitCmd = (cmd: RealtimeCmdAction) => void;

let emitCmd: EmitCmd | null = null;

/** Registered by `RealtimeStationProvider` when the socket can send `cmd` frames. */
export function registerRealtimeLocalCmdEmitter(fn: EmitCmd | null) {
  emitCmd = fn;
}

/** Called from `usePlayerStore` after user-driven transport changes. */
export function emitPlaybackRealtime(cmd: RealtimeCmdAction) {
  if (!shouldEmitLocalPlaybackRealtime()) return;
  emitCmd?.(cmd);
}
