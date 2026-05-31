import type { LocalBroadcastRepository } from "@/lib/local-broadcast-db";
import { createStationClient, getTauriStationAdapter } from "@/lib/station/station-client";
import type { StationRepositoryContract, StationRuntimeState } from "@/lib/station/station-types";

let clientPromise: Promise<StationRepositoryContract> | null = null;

async function stationClient() {
  if (!clientPromise) {
    clientPromise = getTauriStationAdapter()
      .then(createStationClient)
      .catch((error) => {
        clientPromise = null;
        throw error;
      });
  }
  return clientPromise;
}

async function blobToBytes(blob: Blob): Promise<number[]> {
  const data = new Uint8Array(await blob.arrayBuffer());
  return Array.from(data);
}

export function createStationBroadcastRepository(): LocalBroadcastRepository {
  return {
    async saveAssetBlob(asset, blob) {
      await (await stationClient()).importAsset({
        asset,
        bytes: await blobToBytes(blob),
      });
    },
    async listAssets() {
      return (await stationClient()).listAssets();
    },
    async loadAssetBlob(blobKey) {
      const bytes = await (await stationClient()).readAssetBlob(blobKey);
      if (bytes.length === 0) return null;
      return new Blob([new Uint8Array(bytes)]);
    },
    async deleteAsset(assetId, blobKey) {
      await (await stationClient()).deleteAsset(assetId, blobKey);
    },
    async saveCartConfig(slots) {
      await (await stationClient()).saveCartSlots(slots);
    },
    async loadCartConfig() {
      return (await stationClient()).listCartSlots();
    },
    async saveSchedulerEvent(event) {
      await (await stationClient()).saveSchedulerEvent(event);
    },
    async listSchedulerEvents() {
      return (await stationClient()).listSchedulerEvents();
    },
    async deleteSchedulerEvent(eventId) {
      await (await stationClient()).deleteSchedulerEvent(eventId);
    },
    async saveCrossfadeProfiles(profiles) {
      await (await stationClient()).saveCrossfadeProfiles(profiles);
    },
    async loadCrossfadeProfiles() {
      return (await stationClient()).listCrossfadeProfiles();
    },
    async savePlaybackRoutingSettings(settings) {
      await (await stationClient()).savePlaybackSettings(settings);
    },
    async loadPlaybackRoutingSettings() {
      return (await stationClient()).loadPlaybackSettings();
    },
    async saveMicSettings(settings) {
      await (await stationClient()).saveMicSettings(settings);
    },
    async loadMicSettings() {
      return (await stationClient()).loadMicSettings();
    },
    async saveLowResourceSettings(settings) {
      await (await stationClient()).saveLowResourceSettings(settings);
    },
    async loadLowResourceSettings() {
      return (await stationClient()).loadLowResourceSettings();
    },
    async saveStreamingTarget(target) {
      await (await stationClient()).saveStreamingTarget(target);
    },
    async listStreamingTargets() {
      return (await stationClient()).listStreamingTargets();
    },
    async deleteStreamingTarget(targetId) {
      await (await stationClient()).deleteStreamingTarget(targetId);
    },
    async saveSoftwareUpdateSettings(settings) {
      await (await stationClient()).saveSoftwareUpdateSettings(settings);
    },
    async loadSoftwareUpdateSettings() {
      return (await stationClient()).loadSoftwareUpdateSettings();
    },
    async saveRuntimeState(state) {
      await (await stationClient()).saveRuntimeState(state as StationRuntimeState);
    },
    async loadRuntimeState() {
      return (await stationClient()).loadRuntimeState();
    },
  };
}
