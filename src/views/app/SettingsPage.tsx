"use client";
import { CloudUploadPanel } from '@/components/CloudUploadPanel';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { mockIntegrations } from '@/lib/mock-data';
import { useIntegrationsStore } from '@/lib/integrations-store';
import { useUiThemeStore, type UiAccent } from '@/lib/ui-theme-store';
import type { ConnectionStatus, IntegrationSource, SourceType } from '@/lib/types';
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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground mb-4">{t('settings.musicSources')}</h2>
      <p className="text-xs text-muted-foreground -mt-2 mb-2">{t('settings.integrationsMock')}</p>
      <CloudUploadPanel />
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
