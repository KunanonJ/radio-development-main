"use client";
import { Download, Plus, RadioTower, RefreshCw, Trash2 } from 'lucide-react';
import { CloudUploadPanel } from '@/components/CloudUploadPanel';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { mockIntegrations } from '@/lib/mock-data';
import { useIntegrationsStore } from '@/lib/integrations-store';
import { useLocalBroadcastStore } from '@/lib/local-broadcast-store';
import {
  createStreamingTarget,
  protocolFromServerUrl,
  STREAMING_PLATFORM_PRESETS,
  validateStreamingTarget,
} from '@/lib/streaming-targets';
import { useUiThemeStore, type UiAccent } from '@/lib/ui-theme-store';
import type {
  ConnectionStatus,
  IntegrationSource,
  SoftwareUpdateChannel,
  SourceType,
  StreamingPlatform,
  StreamingTarget,
} from '@/lib/types';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

function statusForSource(id: SourceType, override: ConnectionStatus | undefined, fallback: ConnectionStatus) {
  return override ?? fallback;
}

function integrationStatusLine(t: TFunction, status: ConnectionStatus, source: IntegrationSource): string {
  switch (status) {
    case 'connected':
      return t('settings.status.connected', {
        count: source.trackCount ?? 0,
        when: source.lastSync ?? t('common.recently'),
      });
    case 'not-connected':
      return t('settings.status.notConnected');
    case 'expired':
      return t('settings.status.expired');
    case 'syncing':
      return t('settings.status.syncing', { count: source.trackCount ?? 0 });
    case 'error':
      return t('settings.status.error');
    default:
      return t('settings.status.notConnected');
  }
}

/** Streaming catalog integrations — connect flow not shipped yet. */
const COMING_SOON_SOURCES = new Set<SourceType>(['apple-music', 'spotify', 'plex', 'youtube']);

function isComingSoonSource(id: SourceType) {
  return COMING_SOON_SOURCES.has(id);
}

function integrationActionLabel(t: TFunction, status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return t('settings.actions.disconnect');
    case 'not-connected':
      return t('settings.actions.connect');
    case 'expired':
      return t('settings.actions.reconnect');
    case 'syncing':
      return t('settings.actions.cancel');
    case 'error':
      return t('settings.actions.retry');
    default:
      return t('settings.actions.connect');
  }
}

export function SettingsIntegrations() {
  const { t } = useTranslation();
  const statusBySource = useIntegrationsStore((s) => s.statusBySource);
  const toggleConnect = useIntegrationsStore((s) => s.toggleConnect);
  const streamingTargets = useLocalBroadcastStore((s) => s.streamingTargets);
  const saveStreamingTarget = useLocalBroadcastStore((s) => s.saveStreamingTarget);
  const removeStreamingTarget = useLocalBroadcastStore((s) => s.removeStreamingTarget);

  function updateStreamingTarget(target: StreamingTarget, patch: Partial<StreamingTarget>) {
    const nextServerUrl = patch.serverUrl ?? target.serverUrl;
    void saveStreamingTarget({
      ...target,
      ...patch,
      protocol: protocolFromServerUrl(nextServerUrl),
      lastError: null,
      status: 'idle',
    });
  }

  function addStreamingTarget(platform: StreamingPlatform) {
    void saveStreamingTarget(createStreamingTarget(platform));
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground mb-4">{t('settings.musicSources')}</h2>
      <p className="text-xs text-muted-foreground -mt-2 mb-2">{t('settings.integrationsMock')}</p>
      <CloudUploadPanel />
      <div className="surface-2 border border-border rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg surface-3">
              <RadioTower className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">Online broadcast targets</h3>
              <p className="text-xs text-muted-foreground">RTMP/RTMPS targets for radio casting.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STREAMING_PLATFORM_PRESETS) as StreamingPlatform[]).map((platform) => (
              <Button
                key={platform}
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => addStreamingTarget(platform)}
              >
                <Plus className="h-3.5 w-3.5" />
                {STREAMING_PLATFORM_PRESETS[platform].name}
              </Button>
            ))}
          </div>
        </div>

        {streamingTargets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
            No broadcast targets configured.
          </div>
        ) : (
          <div className="space-y-3">
            {streamingTargets.map((target) => {
              const validation = target.enabled ? validateStreamingTarget(target) : null;
              return (
                <div key={target.id} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Input
                        value={target.name}
                        aria-label="Broadcast target name"
                        onChange={(event) => updateStreamingTarget(target, { name: event.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {target.protocol.toUpperCase()} · {target.audioBitrateKbps} kbps
                      </span>
                      <Switch
                        checked={target.enabled}
                        onCheckedChange={(enabled) => updateStreamingTarget(target, { enabled })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${target.name}`}
                        onClick={() => void removeStreamingTarget(target.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[180px_1fr_1fr_150px]">
                    <Select
                      value={target.platform}
                      onValueChange={(platform) => {
                        const typedPlatform = platform as StreamingPlatform;
                        const preset = STREAMING_PLATFORM_PRESETS[typedPlatform];
                        updateStreamingTarget(target, {
                          platform: typedPlatform,
                          name: target.name || preset.name,
                          serverUrl: preset.serverUrl || target.serverUrl,
                        });
                      }}
                    >
                      <SelectTrigger aria-label="Streaming platform">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="youtube">YouTube Live</SelectItem>
                        <SelectItem value="facebook">Facebook Live</SelectItem>
                        <SelectItem value="custom-rtmp">Custom RTMP</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={target.serverUrl}
                      aria-label="Server URL"
                      placeholder="rtmps://server/live"
                      onChange={(event) =>
                        updateStreamingTarget(target, { serverUrl: event.target.value })
                      }
                    />
                    <Input
                      value={target.streamKey}
                      aria-label="Stream key"
                      type="password"
                      placeholder="Stream key"
                      onChange={(event) =>
                        updateStreamingTarget(target, { streamKey: event.target.value })
                      }
                    />
                    <Select
                      value={String(target.audioBitrateKbps)}
                      onValueChange={(value) =>
                        updateStreamingTarget(target, {
                          audioBitrateKbps: Number(value) as StreamingTarget['audioBitrateKbps'],
                        })
                      }
                    >
                      <SelectTrigger aria-label="Audio bitrate">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[96, 128, 160, 192, 256, 320].map((bitrate) => (
                          <SelectItem key={bitrate} value={String(bitrate)}>
                            {bitrate} kbps
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {validation ? (
                    <p className="text-xs text-neon-amber">{validation}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Target is ready for the native streaming encoder.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {mockIntegrations.map((source) => {
        const comingSoon = isComingSoonSource(source.id);
        const status = statusForSource(source.id, statusBySource[source.id], source.status);
        return (
          <div key={source.id} className="surface-2 border border-border rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg surface-3 flex items-center justify-center text-xl">
                {source.icon}
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground">{source.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {comingSoon ? t('settings.comingSoon') : integrationStatusLine(t, status, source)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  comingSoon
                    ? 'bg-muted-foreground/30'
                    : status === 'connected'
                      ? 'bg-primary'
                      : status === 'syncing'
                        ? 'bg-neon-amber animate-pulse'
                        : status === 'expired'
                          ? 'bg-neon-amber'
                          : status === 'error'
                            ? 'bg-destructive'
                            : 'bg-muted-foreground/30'
                }`}
              />
              {comingSoon ? (
                <span
                  className="px-4 py-1.5 rounded-lg text-xs font-medium border border-border bg-muted/40 text-muted-foreground"
                  aria-label={t('settings.comingSoon')}
                >
                  {t('settings.comingSoon')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleConnect(source.id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    status === 'connected'
                      ? 'surface-3 text-muted-foreground hover:text-foreground'
                      : status === 'not-connected'
                        ? 'bg-primary text-primary-foreground hover:opacity-90'
                        : 'border border-border text-foreground hover:bg-secondary'
                  }`}
                >
                  {integrationActionLabel(t, status)}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function updateStatusLabel(status: string) {
  switch (status) {
    case 'checking':
      return 'Checking';
    case 'up-to-date':
      return 'Up to date';
    case 'available':
      return 'Update available';
    case 'downloading':
      return 'Installing';
    case 'ready-to-restart':
      return 'Restarting';
    case 'error':
      return 'Error';
    case 'unavailable':
      return 'Unavailable';
    default:
      return 'Idle';
  }
}

export function SettingsUpdates() {
  const settings = useLocalBroadcastStore((s) => s.softwareUpdateSettings);
  const setSoftwareUpdateSettings = useLocalBroadcastStore((s) => s.setSoftwareUpdateSettings);
  const checkForSoftwareUpdate = useLocalBroadcastStore((s) => s.checkForSoftwareUpdate);
  const installSoftwareUpdate = useLocalBroadcastStore((s) => s.installSoftwareUpdate);
  const busy = settings.status === 'checking' || settings.status === 'downloading';
  const canInstall = settings.status === 'available' && Boolean(settings.lastAvailableVersion);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Software updates</h2>

      <div className="surface-2 border border-border rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">Station app version</h3>
            <p className="text-xs text-muted-foreground">
              Status: {updateStatusLabel(settings.status)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={busy}
              onClick={() => void checkForSoftwareUpdate()}
            >
              <RefreshCw className={`h-4 w-4 ${settings.status === 'checking' ? 'animate-spin' : ''}`} />
              Check for updates
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2"
              disabled={!canInstall || busy}
              onClick={() => void installSoftwareUpdate()}
            >
              <Download className="h-4 w-4" />
              Install update
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="software-update-channel">
              Release channel
            </label>
            <Select
              value={settings.channel}
              onValueChange={(value) =>
                void setSoftwareUpdateSettings({ channel: value as SoftwareUpdateChannel })
              }
            >
              <SelectTrigger id="software-update-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stable">Stable</SelectItem>
                <SelectItem value="beta">Beta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">Last checked</p>
            <p className="mt-1 text-sm text-foreground">
              {settings.lastCheckedAt
                ? new Date(settings.lastCheckedAt).toLocaleString()
                : 'Never'}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">Available version</p>
            <p className="mt-1 text-sm text-foreground">
              {settings.lastAvailableVersion ?? 'None'}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex min-h-[52px] items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3 py-2">
            <span className="text-sm text-foreground">Automatically check for updates</span>
            <Switch
              checked={settings.autoCheckEnabled}
              onCheckedChange={(autoCheckEnabled) =>
                void setSoftwareUpdateSettings({ autoCheckEnabled })
              }
            />
          </label>

          <label className="flex min-h-[52px] items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3 py-2">
            <span className="text-sm text-foreground">Automatically install new versions</span>
            <Switch
              checked={settings.autoDownloadAndInstall}
              onCheckedChange={(autoDownloadAndInstall) =>
                void setSoftwareUpdateSettings({
                  autoDownloadAndInstall,
                  autoCheckEnabled: autoDownloadAndInstall ? true : settings.autoCheckEnabled,
                })
              }
            />
          </label>
        </div>

        {settings.lastError ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {settings.lastError}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Signed updates require a configured station update endpoint.
          </p>
        )}
      </div>
    </div>
  );
}

const UI_THEME_IDS = ['day', 'dark', 'midnight', 'oled', 'system'] as const;

const ACCENT_IDS: UiAccent[] = ['green', 'cyan', 'violet', 'amber'];

export function SettingsAppearance() {
  const { t } = useTranslation();
  const theme = useUiThemeStore((s) => s.theme);
  const setTheme = useUiThemeStore((s) => s.setTheme);
  const accent = useUiThemeStore((s) => s.accent);
  const setAccent = useUiThemeStore((s) => s.setAccent);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">{t('settings.appearanceTitle')}</h2>

      <div className="surface-2 border border-border rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-medium text-foreground">{t('settings.languageSection')}</h3>
        <p className="text-xs text-muted-foreground">{t('settings.languageHint')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="surface-2 border border-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-foreground mb-3">{t('settings.theme')}</h3>
        <div className="flex flex-wrap gap-3">
          {UI_THEME_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                theme === id ? 'bg-primary text-primary-foreground' : 'surface-3 text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(`settings.themes.${id}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="surface-2 border border-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-foreground mb-3">{t('settings.accent')}</h3>
        <div className="flex flex-wrap gap-3">
          {ACCENT_IDS.map((id) => {
            const swatch =
              id === 'green'
                ? 'bg-neon-green'
                : id === 'cyan'
                  ? 'bg-neon-cyan'
                  : id === 'violet'
                    ? 'bg-neon-violet'
                    : 'bg-neon-amber';
            const name = t(`settings.accents.${id}`);
            return (
              <button
                key={id}
                type="button"
                title={name}
                aria-label={`Accent ${name}`}
                aria-pressed={accent === id}
                onClick={() => setAccent(id)}
                className={`w-8 h-8 rounded-full ${swatch} transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  accent === id ? 'ring-2 ring-offset-2 ring-offset-background ring-primary' : ''
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
