"use client";

import { Activity, PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRealtimeStationOptional } from "@/components/realtime/RealtimeStationProvider";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalBroadcastStore } from "@/lib/local-broadcast-store";
import { usePlayerStore } from "@/lib/store";

export function SettingsPlayback() {
  const { t } = useTranslation();
  const realtime = useRealtimeStationOptional();
  const playbackSettings = useLocalBroadcastStore((state) => state.playbackSettings);
  const lowResourceSettings = useLocalBroadcastStore((state) => state.lowResourceSettings);
  const setPlaybackSettings = useLocalBroadcastStore((state) => state.setPlaybackSettings);
  const setLowResourceSettings = useLocalBroadcastStore((state) => state.setLowResourceSettings);
  const stopPreview = useLocalBroadcastStore((state) => state.stopPreview);
  const autoResumePlayback = usePlayerStore((state) => state.autoResumePlayback);
  const setAutoResumePlayback = usePlayerStore((state) => state.setAutoResumePlayback);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <PlayCircle className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Playback routing</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Localhost mode simulates desktop routing. The browser still outputs through the same physical device,
        but on-air and monitor controls stay separate so the UI is ready for a later desktop shell.
      </p>

      <div className="surface-2 rounded-xl border border-border p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Driver</label>
            <Select
              value={playbackSettings.driverLabel}
              onValueChange={(value) =>
                void setPlaybackSettings({
                  driverLabel: value as "WASAPI" | "ASIO" | "DirectSound",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WASAPI">WASAPI (simulated)</SelectItem>
                <SelectItem value="ASIO">ASIO (simulated)</SelectItem>
                <SelectItem value="DirectSound">DirectSound (simulated)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Main output</label>
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground">
              {playbackSettings.mainOutputLabel}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Monitor output</label>
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground">
              {playbackSettings.monitorOutputLabel}
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-foreground">On-air gain</label>
              <span className="text-xs font-mono text-muted-foreground">
                {Math.round(playbackSettings.onAirVolume * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[Math.round(playbackSettings.onAirVolume * 100)]}
              onValueChange={(value) =>
                void setPlaybackSettings({ onAirVolume: (value[0] ?? 0) / 100 })
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-foreground">Monitor / preview gain</label>
              <span className="text-xs font-mono text-muted-foreground">
                {Math.round(playbackSettings.monitorVolume * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[Math.round(playbackSettings.monitorVolume * 100)]}
              onValueChange={(value) =>
                void setPlaybackSettings({ monitorVolume: (value[0] ?? 0) / 100 })
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Preview channel</p>
            <p className="text-xs text-muted-foreground">
              This is simulated in localhost mode and still plays through the browser output.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Enabled</span>
              <Switch
                checked={playbackSettings.previewEnabled}
                onCheckedChange={(checked) => void setPlaybackSettings({ previewEnabled: checked })}
              />
            </div>
            <Button type="button" variant="secondary" onClick={stopPreview}>
              Stop preview
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Auto-resume after reconnect</p>
            <p className="text-xs text-muted-foreground">
              Keeps the existing queue snapshot behavior for local browser sessions.
            </p>
          </div>
          <Switch checked={autoResumePlayback} onCheckedChange={setAutoResumePlayback} />
        </div>
      </div>

      <div className="surface-2 rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Low-resource mode</h3>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Station performance preset</p>
            <p className="text-xs text-muted-foreground">
              Larger buffers, simpler UI rendering, throttled meters, and paused imports while on-air.
            </p>
          </div>
          <Switch
            checked={lowResourceSettings.enabled}
            onCheckedChange={(enabled) => void setLowResourceSettings({ enabled })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">VU rate</label>
            <Select
              value={String(lowResourceSettings.vuFps)}
              onValueChange={(value) =>
                void setLowResourceSettings({ vuFps: Number(value) as 10 | 15 | 30 })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 fps</SelectItem>
                <SelectItem value="15">15 fps</SelectItem>
                <SelectItem value="30">30 fps</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Import batch</label>
            <Select
              value={String(lowResourceSettings.importBatchSize)}
              onValueChange={(value) =>
                void setLowResourceSettings({ importBatchSize: Number(value) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 files</SelectItem>
                <SelectItem value="8">8 files</SelectItem>
                <SelectItem value="16">16 files</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Stable buffer</label>
            <Select
              value={String(lowResourceSettings.stableAudioBufferFrames)}
              onValueChange={(value) =>
                void setLowResourceSettings({
                  stableAudioBufferFrames: Number(value) as 512 | 1024 | 2048,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="512">512 frames</SelectItem>
                <SelectItem value="1024">1024 frames</SelectItem>
                <SelectItem value="2048">2048 frames</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <span>
              <span className="block text-sm font-medium text-foreground">Simple surfaces</span>
              <span className="block text-xs text-muted-foreground">Disable blur and glow styling.</span>
            </span>
            <Switch
              checked={lowResourceSettings.simpleSurfaces}
              onCheckedChange={(simpleSurfaces) =>
                void setLowResourceSettings({ simpleSurfaces })
              }
            />
          </label>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <span>
              <span className="block text-sm font-medium text-foreground">Reduced motion</span>
              <span className="block text-xs text-muted-foreground">Minimize transitions and animations.</span>
            </span>
            <Switch
              checked={lowResourceSettings.reduceMotion}
              onCheckedChange={(reduceMotion) => void setLowResourceSettings({ reduceMotion })}
            />
          </label>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <span>
              <span className="block text-sm font-medium text-foreground">Fast import metadata</span>
              <span className="block text-xs text-muted-foreground">Skip browser duration probing.</span>
            </span>
            <Switch
              checked={lowResourceSettings.skipImportDurationScan}
              onCheckedChange={(skipImportDurationScan) =>
                void setLowResourceSettings({ skipImportDurationScan })
              }
            />
          </label>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <span>
              <span className="block text-sm font-medium text-foreground">Pause imports on-air</span>
              <span className="block text-xs text-muted-foreground">Protect playback on slow disks.</span>
            </span>
            <Switch
              checked={lowResourceSettings.suspendBackgroundWorkOnAir}
              onCheckedChange={(suspendBackgroundWorkOnAir) =>
                void setLowResourceSettings({ suspendBackgroundWorkOnAir })
              }
            />
          </label>
        </div>
      </div>

      <div className="surface-2 rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            {t("settings.playback.sectionRealtime")}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">{t("settings.playback.realtimeIntro")}</p>
        {!realtime?.configured ? (
          <p className="text-sm text-muted-foreground">{t("settings.playback.realtimeDisabled")}</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="text-muted-foreground">{t("settings.playback.realtimeConnection")}</span>
              <span className="font-mono text-foreground">{realtime.connection}</span>
            </div>
            {realtime.role ? (
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span className="text-muted-foreground">{t("settings.playback.realtimeRole")}</span>
                <span className="font-mono text-foreground">{realtime.role}</span>
              </div>
            ) : null}
            {realtime.clientId ? (
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span className="text-muted-foreground">{t("settings.playback.realtimeClientId")}</span>
                <span className="font-mono text-xs text-foreground break-all">{realtime.clientId}</span>
              </div>
            ) : null}
            {realtime.lastError ? (
              <p className="text-destructive text-xs break-words">
                {t("settings.playback.realtimeError")}: {realtime.lastError}
              </p>
            ) : null}
            {realtime.remoteVu ? (
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <p className="text-xs text-muted-foreground">{t("settings.playback.realtimeVuHint")}</p>
                <div className="flex items-end gap-1 h-8">
                  <div
                    className="w-2 rounded-sm bg-primary/90 transition-[height] duration-75"
                    style={{ height: `${Math.max(10, realtime.remoteVu.peak * 100)}%` }}
                  />
                  <div
                    className="w-2 rounded-sm bg-primary/50 transition-[height] duration-75"
                    style={{ height: `${Math.max(10, realtime.remoteVu.rms * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
            {(realtime.role === "operator" || realtime.role === "admin") && realtime.connection === "connected" ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => realtime.sendCommand({ action: "pause" })}
              >
                {t("settings.playback.realtimeTestPause")}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
