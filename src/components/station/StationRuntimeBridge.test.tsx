import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLocalBroadcastStore } from "@/lib/local-broadcast-store";
import type { StationBridgeEvents, StationEventName } from "@/lib/station/station-types";
import { usePlayerStore } from "@/lib/store";
import { StationRuntimeBridge } from "./StationRuntimeBridge";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  health: vi.fn(async () => ({ ok: true })),
  setTransport: vi.fn(async (patch) => patch),
  getTauriStationAdapter: vi.fn(async () => ({
    invoke: vi.fn(),
    listen: vi.fn(async () => vi.fn()),
  })),
  listenToStationEvents: vi.fn(async () => vi.fn()),
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("@/lib/station/station-mode", () => ({ isStationMode: () => true }));
vi.mock("@/lib/station/station-client", () => ({
  createStationClient: () => ({
    health: mocks.health,
    setTransport: mocks.setTransport,
  }),
  getTauriStationAdapter: mocks.getTauriStationAdapter,
  listenToStationEvents: mocks.listenToStationEvents,
}));

describe("StationRuntimeBridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    usePlayerStore.setState({
      isPlaying: false,
      progress: 0,
      currentTrackStartedAtMs: null,
    });
    useLocalBroadcastStore.setState({
      micLevel: 0,
      lowResourceSettings: {
        enabled: false,
        reduceMotion: true,
        simpleSurfaces: true,
        vuFps: 15,
        importBatchSize: 8,
        skipImportDurationScan: false,
        stableAudioBufferFrames: 1024,
        suspendBackgroundWorkOnAir: true,
      },
    });
  });

  it("mounts the station backend bridge in station mode", () => {
    const { container } = render(<StationRuntimeBridge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stops transport sync if station event subscription fails", async () => {
    mocks.listenToStationEvents.mockRejectedValueOnce(new Error("event bus failed"));
    render(<StationRuntimeBridge />);

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("event bus failed"));
    const callsAfterFailure = mocks.setTransport.mock.calls.length;

    await act(async () => {
      usePlayerStore.setState({ isPlaying: true });
    });

    expect(mocks.setTransport).toHaveBeenCalledTimes(callsAfterFailure);
  });

  it("throttles VU updates when low-resource mode is enabled", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    let vuHandler: ((frame: { peak: number; rms: number; t: number }) => void) | undefined;
    mocks.listenToStationEvents.mockImplementationOnce(async (...args: unknown[]) => {
      const handlers = args[1] as Partial<{
        [K in StationEventName]: (payload: StationBridgeEvents[K]) => void;
      }>;
      vuHandler = handlers["station:vu"];
      return vi.fn();
    });
    useLocalBroadcastStore.setState({
      lowResourceSettings: {
        enabled: true,
        reduceMotion: true,
        simpleSurfaces: true,
        vuFps: 10,
        importBatchSize: 8,
        skipImportDurationScan: false,
        stableAudioBufferFrames: 1024,
        suspendBackgroundWorkOnAir: true,
      },
    });

    render(<StationRuntimeBridge />);
    await waitFor(() => expect(vuHandler).toBeDefined());

    act(() => {
      vuHandler?.({ peak: 0.8, rms: 0.2, t: 1_000 });
      now.mockReturnValue(1_010);
      vuHandler?.({ peak: 0.9, rms: 0.7, t: 1_010 });
    });
    expect(useLocalBroadcastStore.getState().micLevel).toBe(0.2);

    now.mockReturnValue(1_200);
    act(() => {
      vuHandler?.({ peak: 0.9, rms: 0.7, t: 1_200 });
    });
    expect(useLocalBroadcastStore.getState().micLevel).toBe(0.7);
  });
});
