import { expect, test } from '@playwright/test';

test.describe('Queue page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/queue');
  });

  test('shows queue heading and list region when queue has seed tracks', async ({ page }) => {
    const root = page.getByTestId('queue-page');
    await expect(root).toBeVisible();
    await expect(root.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('queue-list')).toBeVisible();

    const handles = page.getByTestId('queue-drag-handle');
    await expect(handles.first()).toBeVisible();
    expect(await handles.count()).toBeGreaterThan(0);
  });

  test('shows reorder hint', async ({ page }) => {
    await expect(page.getByTestId('queue-reorder-hint')).toBeVisible();
  });

  test('drag handle count matches sortable rows', async ({ page }) => {
    const rowCount = await page.getByTestId('queue-list').locator(':scope > div').count();
    const handleCount = await page.getByTestId('queue-drag-handle').count();
    expect(handleCount).toBe(rowCount);
  });

  test('reorder drag activates pointer sensor (smoke)', async ({ page }) => {
    const first = page.getByTestId('queue-drag-handle').first();
    await first.hover();
    await first.dispatchEvent('pointerdown', { button: 0 });
    await expect(first).toBeVisible();
    await page.mouse.up();
  });
});
