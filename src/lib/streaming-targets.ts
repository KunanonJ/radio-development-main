import type { StreamingPlatform, StreamingTarget } from "@/lib/types";

export const STREAMING_PLATFORM_PRESETS: Record<
  StreamingPlatform,
  {
    name: string;
    serverUrl: string;
  }
> = {
  youtube: {
    name: "YouTube Live",
    serverUrl: "rtmps://a.rtmps.youtube.com/live2",
  },
  facebook: {
    name: "Facebook Live",
    serverUrl: "rtmps://live-api-s.facebook.com:443/rtmp/",
  },
  "custom-rtmp": {
    name: "Custom RTMP/RTMPS",
    serverUrl: "",
  },
};

export function protocolFromServerUrl(serverUrl: string) {
  return serverUrl.trim().toLowerCase().startsWith("rtmps://") ? "rtmps" : "rtmp";
}

export function createStreamingTarget(platform: StreamingPlatform): StreamingTarget {
  const preset = STREAMING_PLATFORM_PRESETS[platform];
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: preset.name,
    platform,
    serverUrl: preset.serverUrl,
    streamKey: "",
    enabled: true,
    protocol: protocolFromServerUrl(preset.serverUrl),
    audioBitrateKbps: 160,
    videoMode: "audio-slate",
    status: "idle",
    lastError: null,
    updatedAt: now,
  };
}

export function validateStreamingTarget(target: StreamingTarget) {
  const url = target.serverUrl.trim().toLowerCase();
  if (!url.startsWith("rtmp://") && !url.startsWith("rtmps://")) {
    return "Server URL must start with rtmp:// or rtmps://.";
  }
  if (/[\r\n]/.test(target.serverUrl)) {
    return "Server URL cannot contain line breaks.";
  }
  if (target.streamKey.trim().length === 0) {
    return "Stream key is required.";
  }
  if (/[\r\n]/.test(target.streamKey)) {
    return "Stream key cannot contain line breaks.";
  }
  if ((target.platform === "youtube" || target.platform === "facebook") && !url.startsWith("rtmps://")) {
    return `${STREAMING_PLATFORM_PRESETS[target.platform].name} targets must use rtmps:// for stream-key protection.`;
  }
  return null;
}
