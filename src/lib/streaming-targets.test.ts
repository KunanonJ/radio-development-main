import { describe, expect, it } from "vitest";
import { createStreamingTarget, validateStreamingTarget } from "@/lib/streaming-targets";

describe("streaming target validation", () => {
  it("requires RTMPS for managed platform targets", () => {
    const target = {
      ...createStreamingTarget("youtube"),
      serverUrl: "rtmp://a.rtmp.youtube.com/live2",
      streamKey: "valid-stream-key",
    };

    expect(validateStreamingTarget(target)).toBe(
      "YouTube Live targets must use rtmps:// for stream-key protection.",
    );
  });

  it("rejects stream keys with line breaks", () => {
    const target = {
      ...createStreamingTarget("facebook"),
      streamKey: "abc\nInjected-Header: value",
    };

    expect(validateStreamingTarget(target)).toBe("Stream key cannot contain line breaks.");
  });
});
