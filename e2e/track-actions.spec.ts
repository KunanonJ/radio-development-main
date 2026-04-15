import { expect, test } from '@playwright/test';

test.describe('Track actions menu', () => {
  test('adds a track to the queue from the row actions menu', async ({ page }) => {
    await page.goto('/app/queue');
    const initialQueueCount = await page.getByTestId('queue-list').locator(':scope > div').count();

    await page.locator('a[href="/app/library/tracks"]').first().click();
    await expect(page).toHaveURL(/\/app\/library\/tracks$/);

    const firstRow = page.getByTestId('track-row').first();
    await expect(firstRow).toBeVisible();
    await firstRow.hover();

    const trackTitle = (await firstRow.locator('p').first().textContent())?.trim();
    expect(trackTitle).toBeTruthy();

    await firstRow.getByTestId('track-actions-trigger').click();
    await expect(page.getByTestId('track-action-add-to-queue')).toBeVisible();
    await page.getByTestId('track-action-add-to-queue').click();

    await page.locator('a[href="/app/queue"]').first().click();
    await expect(page).toHaveURL(/\/app\/queue$/);
    await expect(page.getByTestId('queue-list')).toBeVisible();
    const queueRows = page.getByTestId('queue-list').locator(':scope > div');
    await expect(queueRows).toHaveCount(initialQueueCount + 1);

    const lastRow = queueRows.last();
    await expect(lastRow.getByText(trackTitle ?? '')).toBeVisible();
  });

  test('hides invalid album and artist actions for spot rows', async ({ page }) => {
    await page.goto('/app/library/tracks');

    const spotRow = page
      .getByTestId('track-row')
      .filter({ has: page.getByText('Spot — Local sponsor A') })
      .first();

    await expect(spotRow).toBeVisible();
    await spotRow.hover();
    await spotRow.getByTestId('track-actions-trigger').click();

    await expect(page.getByTestId('track-action-play-now')).toBeVisible();
    await expect(page.getByTestId('track-action-go-to-album')).toHaveCount(0);
    await expect(page.getByTestId('track-action-go-to-artist')).toHaveCount(0);
  });

  test('play now targets the selected duplicate queue row', async ({ page }) => {
    await page.goto('/app/library/tracks');

    const sourceRow = page.getByTestId('track-row').filter({ has: page.getByText('Afterglow') }).first();
    await expect(sourceRow).toBeVisible();
    await sourceRow.hover();
    await sourceRow.getByTestId('track-actions-trigger').click();
    await page.getByTestId('track-action-add-to-queue').click();

    await page.locator('a[href="/app/queue"]').first().click();
    await expect(page).toHaveURL(/\/app\/queue$/);

    const duplicateRows = page.getByTestId('track-row').filter({ has: page.getByText('Afterglow') });
    await expect(duplicateRows).toHaveCount(2);

    const firstDuplicate = duplicateRows.first();
    const targetRow = duplicateRows.last();

    await targetRow.hover();
    await targetRow.getByTestId('track-actions-trigger').click();
    await page.getByTestId('track-action-play-now').click();

    await expect(targetRow).toHaveAttribute('data-active', 'true');
    await expect(firstDuplicate).toHaveAttribute('data-active', 'false');
  });

  test('inline play button targets the selected duplicate queue row', async ({ page }) => {
    await page.goto('/app/library/tracks');

    const sourceRow = page.getByTestId('track-row').filter({ has: page.getByText('Afterglow') }).first();
    await expect(sourceRow).toBeVisible();
    await sourceRow.hover();
    await sourceRow.getByTestId('track-actions-trigger').click();
    await page.getByTestId('track-action-add-to-queue').click();

    await page.locator('a[href="/app/queue"]').first().click();
    await expect(page).toHaveURL(/\/app\/queue$/);

    const duplicateRows = page.getByTestId('track-row').filter({ has: page.getByText('Afterglow') });
    await expect(duplicateRows).toHaveCount(2);

    const firstDuplicate = duplicateRows.first();
    const targetRow = duplicateRows.last();

    await targetRow.hover();
    await targetRow.getByTestId('track-row-play-button').click();

    await expect(targetRow).toHaveAttribute('data-active', 'true');
    await expect(firstDuplicate).toHaveAttribute('data-active', 'false');
  });
});
