import { expect, test, type Page } from '@playwright/test';

async function installMockTauri(page: Page) {
  await page.addInitScript(() => {
    const commands: Array<{ command: string; args: unknown }> = [];
    Object.assign(window, {
      __TAURI_INTERNALS__: {},
      __stationCommands: commands,
      __TAURI__: {
        core: {
          invoke: async (command: string, args: Record<string, unknown> = {}) => {
            commands.push({ command, args });
            if (command === 'station_health') {
              return {
                ok: true,
                appMode: 'station',
                audioBackend: 'CPAL/ASIO',
                dbPath: 'mock/station.sqlite3',
                mediaDir: 'mock/media',
              };
            }
            if (command === 'station_set_transport') {
              const patch = (args.patch ?? {}) as Record<string, unknown>;
              return {
                playing: false,
                currentAssetId: null,
                queueAssetIds: [],
                positionSec: 0,
                activeDeck: 'A',
                ...patch,
              };
            }
            if (command === 'station_list_audio_devices') {
              return [
                {
                  id: 'asio-main',
                  name: 'Mock ASIO Interface',
                  host: 'ASIO',
                  inputChannels: 2,
                  outputChannels: 4,
                  sampleRates: [48000],
                  defaultSampleRate: 48000,
                },
              ];
            }
            if (
              command.startsWith('station_list_') ||
              command === 'station_load_playback_settings' ||
              command === 'station_load_mic_settings' ||
              command === 'station_load_low_resource_settings' ||
              command === 'station_load_software_update_settings' ||
              command === 'station_load_runtime_state'
            ) {
              return command.startsWith('station_list_') ? [] : null;
            }
            return null;
          },
        },
        event: {
          listen: async () => () => undefined,
        },
      },
    });
  });
}

async function stationCommands(page: Page) {
  return page.evaluate(() =>
    ((window as unknown as { __stationCommands?: Array<{ command: string }> }).__stationCommands ??
      []).map((entry) => entry.command),
  );
}

test.describe('Station mode with mocked Tauri API', () => {
  test.beforeEach(async ({ page }) => {
    await installMockTauri(page);
  });

  test('broadcast console mounts native station bridge', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator('aside')).toBeVisible();
    await expect.poll(() => stationCommands(page)).toContain('station_health');
    await expect.poll(() => stationCommands(page)).toContain('station_set_transport');
  });

  test('cart page remains available in station mode', async ({ page }) => {
    await page.goto('/app/cart');
    await expect(page.locator('aside')).toBeVisible();
    await expect.poll(() => stationCommands(page)).toContain('station_health');
  });

  test('scheduler page remains available in station mode', async ({ page }) => {
    await page.goto('/app/automation');
    await expect(page.locator('aside')).toBeVisible();
    await expect.poll(() => stationCommands(page)).toContain('station_health');
  });

  test('settings uses native device discovery in station mode', async ({ page }) => {
    await page.goto('/app/settings/playback');
    await expect(page.locator('aside')).toBeVisible();
    await expect.poll(() => stationCommands(page)).toContain('station_list_audio_devices');
  });

  test('settings exposes station software update controls', async ({ page }) => {
    await page.goto('/app/settings/updates');
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Software updates' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Check for updates' })).toBeVisible();
    await expect(page.getByText('Automatically check for updates')).toBeVisible();
    await expect.poll(() => stationCommands(page)).toContain('station_load_software_update_settings');
  });
});
