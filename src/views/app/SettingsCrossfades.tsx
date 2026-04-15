"use client";

import { WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalBroadcastStore } from "@/lib/local-broadcast-store";
import type { AudioClass } from "@/lib/types";

const AUDIO_CLASSES: AudioClass[] = ["music", "commercial", "jingle", "cart", "break"];

export function SettingsCrossfades() {
  const profiles = useLocalBroadcastStore((state) => state.crossfadeProfiles);
  const assets = useLocalBroadcastStore((state) => state.assets);
  const setCrossfadeProfile = useLocalBroadcastStore((state) => state.setCrossfadeProfile);
  const requestPreview = useLocalBroadcastStore((state) => state.requestPreview);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <WandSparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Crossfades</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Each audio class can fade differently. Music defaults to a smooth overlap; commercials and carts default to hard cuts.
      </p>

      <div className="space-y-4">
        {AUDIO_CLASSES.map((audioClass) => {
          const profile = profiles[audioClass];
          return (
            <div key={audioClass} className="surface-2 rounded-xl border border-border p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium capitalize text-foreground">{audioClass}</h3>
                  <p className="text-xs text-muted-foreground">
                    Mix point drives when the next item starts. Fade-in and fade-out shape the overlap.
                  </p>
                </div>
                <Select
                  value={profile.curve}
                  onValueChange={(value) =>
                    void setCrossfadeProfile(audioClass, { curve: value as "linear" | "log" })
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linear</SelectItem>
                    <SelectItem value="log">Logarithmic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { label: "Mix point", key: "mixPointSec" as const, value: profile.mixPointSec },
                  { label: "Fade in", key: "fadeInSec" as const, value: profile.fadeInSec },
                  { label: "Fade out", key: "fadeOutSec" as const, value: profile.fadeOutSec },
                ].map((field) => (
                  <div key={field.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-sm font-medium text-foreground">{field.label}</label>
                      <span className="text-xs font-mono text-muted-foreground">{field.value.toFixed(1)}s</span>
                    </div>
                    <Slider
                      min={0}
                      max={8}
                      step={0.1}
                      value={[field.value]}
                      onValueChange={(value) =>
                        void setCrossfadeProfile(audioClass, {
                          [field.key]: Number((value[0] ?? 0).toFixed(1)),
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Preview transition</p>
                  <p className="text-xs text-muted-foreground">
                    Plays one local asset in the monitor channel so you can verify the current routing chain.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={assets.length === 0}
                  onClick={() => {
                    const candidate = assets.find((asset) => asset.audioClass === audioClass) ?? assets[0];
                    if (!candidate) return;
                    requestPreview({
                      id: `asset-${candidate.id}`,
                      title: candidate.title,
                      artist: candidate.artist || "Local import",
                      artistId: "local-import",
                      album: candidate.album || "Local broadcast library",
                      albumId: "local-broadcast-library",
                      duration: Math.round(candidate.durationSec),
                      artwork: candidate.artwork || "/placeholder.svg",
                      source: "local",
                      genre: candidate.audioClass,
                      year: new Date().getFullYear(),
                      trackNumber: 1,
                      mediaUrl: candidate.objectUrl,
                      audioClass: candidate.audioClass,
                      assetId: candidate.id,
                    });
                  }}
                >
                  Preview
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
