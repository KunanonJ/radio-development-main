"use client";

import { useEffect } from "react";
import { Mic2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalBroadcastStore } from "@/lib/local-broadcast-store";

export function SettingsInput() {
  const micSettings = useLocalBroadcastStore((state) => state.micSettings);
  const availableInputDevices = useLocalBroadcastStore((state) => state.availableInputDevices);
  const canEnumerateDevices = useLocalBroadcastStore((state) => state.canEnumerateDevices);
  const micPermission = useLocalBroadcastStore((state) => state.micPermission);
  const micError = useLocalBroadcastStore((state) => state.micError);
  const micLevel = useLocalBroadcastStore((state) => state.micLevel);
  const micLive = useLocalBroadcastStore((state) => state.micLive);
  const refreshInputDevices = useLocalBroadcastStore((state) => state.refreshInputDevices);
  const setMicSettings = useLocalBroadcastStore((state) => state.setMicSettings);
  const setMicLive = useLocalBroadcastStore((state) => state.setMicLive);

  useEffect(() => {
    void refreshInputDevices();
  }, [refreshInputDevices]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Mic2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Input</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Browser mic input is live in localhost mode. Keep headphones on if you route the mic back to the same device to avoid feedback.
      </p>

      <div className="surface-2 rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Enable microphone system</p>
            <p className="text-xs text-muted-foreground">
              Permission state: {micPermission}
              {micError ? ` · ${micError}` : ""}
            </p>
          </div>
          <Switch
            checked={micSettings.enabled}
            onCheckedChange={(checked) => void setMicSettings({ enabled: checked })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Input device</label>
            {canEnumerateDevices ? (
              <Select
                value={micSettings.inputDeviceId ?? "__default"}
                onValueChange={(value) =>
                  void setMicSettings({ inputDeviceId: value === "__default" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Default microphone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default">Default microphone</SelectItem>
                  {availableInputDevices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                Device enumeration is not available in this browser.
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mic mode</label>
            <Select
              value={micSettings.mode}
              onValueChange={(value) =>
                void setMicSettings({ mode: value as "toggle" | "ptt" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toggle">Toggle</SelectItem>
                <SelectItem value="ptt">Push to talk</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Preferred sample rate</label>
            <Select
              value={String(micSettings.preferredSampleRate)}
              onValueChange={(value) =>
                void setMicSettings({ preferredSampleRate: Number(value) as 44100 | 48000 })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="48000">48 kHz</SelectItem>
                <SelectItem value="44100">44.1 kHz</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-foreground">Duck level</label>
              <span className="text-xs font-mono text-muted-foreground">{micSettings.duckDb} dB</span>
            </div>
            <Slider
              min={-30}
              max={0}
              step={1}
              value={[micSettings.duckDb]}
              onValueChange={(value) => void setMicSettings({ duckDb: value[0] ?? -15 })}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Live mic test</p>
              <p className="text-xs text-muted-foreground">
                {micSettings.mode === "ptt"
                  ? "Use the PTT button to open the mic only while pressed."
                  : "Use the toggle button to open and close the mic."}
              </p>
            </div>
            {micSettings.mode === "toggle" ? (
              <Button type="button" variant={micLive ? "destructive" : "secondary"} onClick={() => setMicLive(!micLive)}>
                {micLive ? "Close mic" : "Open mic"}
              </Button>
            ) : (
              <Button
                type="button"
                variant={micLive ? "destructive" : "secondary"}
                onMouseDown={() => setMicLive(true)}
                onMouseUp={() => setMicLive(false)}
                onMouseLeave={() => setMicLive(false)}
                onTouchStart={() => setMicLive(true)}
                onTouchEnd={() => setMicLive(false)}
              >
                Hold to talk
              </Button>
            )}
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-background/80">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${Math.max(4, Math.round(micLevel * 100))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
