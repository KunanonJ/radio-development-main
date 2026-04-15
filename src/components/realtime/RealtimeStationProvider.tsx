"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { applyRemoteRealtimeCmd, type DuckTimerRef } from "@/lib/realtime-apply-cmd";
import { fetchRealtimeToken, openRealtimeWebSocket, resolveRealtimeWsUrl } from "@/lib/realtime-client";
import {
  registerRealtimeLocalCmdEmitter,
  shouldEmitLocalPlaybackRealtime,
} from "@/lib/realtime-local-emit";
import type { RealtimeCmdAction } from "@/lib/realtime-protocol";
import { isRealtimeServerMessage } from "@/lib/realtime-protocol";
import {
  setRealtimeProgramVuActive,
  setRealtimeProgramVuSink,
} from "@/lib/realtime-program-vu";
import { useLocalBroadcastStore } from "@/lib/local-broadcast-store";

const RECONNECT_MS_MAX = 30_000;
const PING_MS = 25_000;

function envFlag(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function parseMode(raw: string | undefined): "operator" | "viewer" | "meter" {
  if (raw === "operator" || raw === "viewer" || raw === "meter") return raw;
  return "viewer";
}

export type RealtimeConnectionState = "idle" | "connecting" | "connected" | "error";

export type RemoteVuFrame = {
  peak: number;
  rms: number;
  t: number;
  fromClientId: string;
};

type RealtimeStationContextValue = {
  configured: boolean;
  connection: RealtimeConnectionState;
  role: string | null;
  mode: string | null;
  clientId: string | null;
  lastError: string | null;
  remoteVu: RemoteVuFrame | null;
  sendCommand: (payload: RealtimeCmdAction) => boolean;
};

const RealtimeStationContext = createContext<RealtimeStationContextValue | null>(null);

export function useRealtimeStation(): RealtimeStationContextValue {
  const ctx = useContext(RealtimeStationContext);
  if (!ctx) {
    throw new Error("useRealtimeStation must be used within RealtimeStationProvider");
  }
  return ctx;
}

export function useRealtimeStationOptional(): RealtimeStationContextValue | null {
  return useContext(RealtimeStationContext);
}

export type RealtimeStationProviderProps = {
  children?: React.ReactNode;
  enabled?: boolean;
  tenantId?: string;
  stationId?: string;
  mode?: "operator" | "viewer" | "meter";
};

export function RealtimeStationProvider(props: RealtimeStationProviderProps) {
  const envEnabled = envFlag("NEXT_PUBLIC_REALTIME_ENABLED") === "true";
  const enabled = props.enabled ?? envEnabled;
  const tenantId = props.tenantId ?? envFlag("NEXT_PUBLIC_REALTIME_TENANT_ID");
  const stationId = props.stationId ?? envFlag("NEXT_PUBLIC_REALTIME_STATION_ID");
  const mode = props.mode ?? parseMode(envFlag("NEXT_PUBLIC_REALTIME_MODE"));

  const pushVu = envFlag("NEXT_PUBLIC_REALTIME_PUSH_VU") !== "false";

  const [connection, setConnection] = useState<RealtimeConnectionState>("idle");
  const [role, setRole] = useState<string | null>(null);
  const [modeState, setModeState] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [remoteVu, setRemoteVu] = useState<RemoteVuFrame | null>(null);

  const duckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duckBox = useMemo<DuckTimerRef>(
    () => ({
      get current() {
        return duckTimerRef.current;
      },
      set current(v) {
        duckTimerRef.current = v;
      },
    }),
    [],
  );

  const wsRef = useRef<WebSocket | null>(null);
  const seqRef = useRef(0);
  const tenantRef = useRef("");
  const stationRef = useRef("");
  const reconnectAttemptRef = useRef(0);
  const stoppedRef = useRef(false);

  const configured = Boolean(enabled && tenantId && stationId);

  const sendCommand = useCallback((payload: RealtimeCmdAction): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    const tid = tenantRef.current;
    const sid = stationRef.current;
    if (!tid || !sid) return false;
    seqRef.current += 1;
    ws.send(
      JSON.stringify({
        type: "cmd",
        seq: seqRef.current,
        tenantId: tid,
        stationId: sid,
        payload,
      }),
    );
    return true;
  }, []);

  useEffect(() => {
    if (!configured || !tenantId || !stationId) {
      setConnection("idle");
      setRole(null);
      setModeState(null);
      setClientId(null);
      registerRealtimeLocalCmdEmitter(null);
      setRealtimeProgramVuSink(null);
      setRealtimeProgramVuActive(false);
      return;
    }

    stoppedRef.current = false;
    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cmdEmitterActive = false;
    let vuSinkActive = false;

    const clearTimers = () => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const teardownEmitters = () => {
      if (cmdEmitterActive) {
        registerRealtimeLocalCmdEmitter(null);
        cmdEmitterActive = false;
      }
      if (vuSinkActive) {
        setRealtimeProgramVuSink(null);
        setRealtimeProgramVuActive(false);
        vuSinkActive = false;
      }
    };

    const attachVuSink = (allowVu: boolean) => {
      if (!pushVu || !allowVu) {
        if (vuSinkActive) {
          setRealtimeProgramVuSink(null);
          setRealtimeProgramVuActive(false);
          vuSinkActive = false;
        }
        return;
      }
      setRealtimeProgramVuSink((peak, rms) => {
        const w = wsRef.current;
        if (!w || w.readyState !== WebSocket.OPEN) return;
        w.send(JSON.stringify({ type: "vu", t: Date.now(), peak, rms }));
      });
      setRealtimeProgramVuActive(true);
      vuSinkActive = true;
    };

    const connect = () => {
      if (stoppedRef.current) return;
      setConnection("connecting");
      setLastError(null);

      void (async () => {
        try {
          const tokenRes = await fetchRealtimeToken({ tenantId, stationId, mode });
          tenantRef.current = tokenRes.tenantId;
          stationRef.current = tokenRes.stationId;
          const dbRole = tokenRes.role;
          const tokenMode = tokenRes.mode;
          const canCmd = dbRole === "admin" || dbRole === "operator";
          const canVu = canCmd || tokenMode === "meter";

          const wsUrl = resolveRealtimeWsUrl(tokenRes);
          ws = openRealtimeWebSocket(wsUrl, tokenRes.token);
          wsRef.current = ws;
          reconnectAttemptRef.current = 0;

          if (canCmd) {
            registerRealtimeLocalCmdEmitter(sendCommand);
            cmdEmitterActive = true;
          }

          ws.onmessage = (ev) => {
            let data: unknown;
            try {
              data = JSON.parse(String(ev.data));
            } catch {
              return;
            }
            if (!isRealtimeServerMessage(data)) return;
            if (data.type === "welcome") {
              setRole(data.role);
              setClientId(data.clientId);
              setModeState(tokenMode);
              return;
            }
            if (data.type === "cmd_broadcast") {
              if (!data.payload || typeof data.payload !== "object") return;
              applyRemoteRealtimeCmd(data.payload as RealtimeCmdAction, duckBox);
              return;
            }
            if (data.type === "vu_broadcast") {
              const f = data.frame;
              if (!f || typeof f !== "object") return;
              const peak = typeof f.peak === "number" ? f.peak : 0;
              const rms = typeof f.rms === "number" ? f.rms : 0;
              const t = typeof f.t === "number" ? f.t : Date.now();
              setRemoteVu({ peak, rms, t, fromClientId: data.fromClientId });
              return;
            }
            if (data.type === "error") {
              setLastError(data.message ?? data.code ?? "error");
            }
          };

          ws.onopen = () => {
            if (stoppedRef.current) {
              ws?.close();
              return;
            }
            setConnection("connected");
            attachVuSink(canVu);
            pingTimer = setInterval(() => {
              if (!ws || ws.readyState !== WebSocket.OPEN) return;
              ws.send(JSON.stringify({ type: "ping", nonce: Date.now() }));
            }, PING_MS);
          };

          ws.onerror = () => {
            /* onclose reconnects */
          };

          ws.onclose = () => {
            clearTimers();
            wsRef.current = null;
            ws = null;
            teardownEmitters();
            setConnection(stoppedRef.current ? "idle" : "error");
            if (stoppedRef.current) return;
            const attempt = reconnectAttemptRef.current + 1;
            reconnectAttemptRef.current = attempt;
            const delay = Math.min(RECONNECT_MS_MAX, 1000 * 2 ** Math.min(attempt, 5));
            reconnectTimer = setTimeout(connect, delay);
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setLastError(msg);
          setConnection("error");
          teardownEmitters();
          console.warn("[realtime] connect failed", e);
          if (stoppedRef.current) return;
          const attempt = reconnectAttemptRef.current + 1;
          reconnectAttemptRef.current = attempt;
          const delay = Math.min(RECONNECT_MS_MAX, 1000 * 2 ** Math.min(attempt, 5));
          reconnectTimer = setTimeout(connect, delay);
        }
      })();
    };

    connect();

    return () => {
      stoppedRef.current = true;
      clearTimers();
      teardownEmitters();
      if (duckTimerRef.current) {
        clearTimeout(duckTimerRef.current);
        duckTimerRef.current = null;
      }
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close();
      }
      wsRef.current = null;
    };
  }, [configured, tenantId, stationId, mode, sendCommand, pushVu, duckBox]);

  useEffect(() => {
    if (!configured || connection !== "connected") return;
    if (role !== "operator" && role !== "admin") return;
    let prevMic = useLocalBroadcastStore.getState().micLive;
    return useLocalBroadcastStore.subscribe((state) => {
      const live = state.micLive;
      if (live === prevMic) return;
      prevMic = live;
      if (!shouldEmitLocalPlaybackRealtime()) return;
      sendCommand({ action: "mic", on: live });
    });
  }, [configured, connection, role, sendCommand]);

  const value = useMemo<RealtimeStationContextValue>(
    () => ({
      configured,
      connection,
      role,
      mode: modeState,
      clientId,
      lastError,
      remoteVu,
      sendCommand,
    }),
    [configured, connection, role, modeState, clientId, lastError, remoteVu, sendCommand],
  );

  return (
    <RealtimeStationContext.Provider value={value}>
      {props.children}
    </RealtimeStationContext.Provider>
  );
}
