import { describe, expect, it, vi } from "vitest";
import {
  checkStationSoftwareUpdate,
  installStationSoftwareUpdate,
  type StationUpdaterRuntime,
} from "./software-updater";

function runtimeWithUpdate(): StationUpdaterRuntime & {
  update: { downloadAndInstall: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
} {
  const update = {
    currentVersion: "0.1.0",
    version: "0.2.0",
    date: "2026-05-31T00:00:00Z",
    body: "Signed Windows station update",
    downloadAndInstall: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };

  return {
    update,
    available: () => true,
    check: vi.fn(async () => update),
    relaunch: vi.fn(async () => undefined),
  };
}

describe("station software updater", () => {
  it("reports unavailable outside station mode", async () => {
    const result = await checkStationSoftwareUpdate("stable", {
      available: () => false,
      check: vi.fn(),
      relaunch: vi.fn(),
    });

    expect(result).toEqual({
      available: false,
      currentVersion: null,
      version: null,
      reason: "unavailable",
    });
  });

  it("checks and installs a signed update through the runtime", async () => {
    const runtime = runtimeWithUpdate();

    await expect(checkStationSoftwareUpdate("stable", runtime)).resolves.toMatchObject({
      available: true,
      currentVersion: "0.1.0",
      version: "0.2.0",
    });
    await installStationSoftwareUpdate("stable", runtime);

    expect(runtime.check).toHaveBeenCalledWith("stable");
    expect(runtime.update.downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(runtime.relaunch).toHaveBeenCalledTimes(1);
    expect(runtime.update.close).toHaveBeenCalledTimes(1);
  });

  it("does not install a cached update from a different channel", async () => {
    const stableUpdate = {
      currentVersion: "0.1.0",
      version: "0.2.0",
      downloadAndInstall: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    const betaUpdate = {
      currentVersion: "0.1.0",
      version: "0.3.0-beta.1",
      downloadAndInstall: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    const runtime: StationUpdaterRuntime = {
      available: () => true,
      check: vi.fn(async (channel) => (channel === "beta" ? betaUpdate : stableUpdate)),
      relaunch: vi.fn(async () => undefined),
    };

    await checkStationSoftwareUpdate("stable", runtime);
    await installStationSoftwareUpdate("beta", runtime);

    expect(stableUpdate.downloadAndInstall).not.toHaveBeenCalled();
    expect(betaUpdate.downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(runtime.check).toHaveBeenCalledWith("beta");
  });
});
