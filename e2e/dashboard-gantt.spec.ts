import { expect, test } from '@playwright/test';

test.describe('Dashboard queue Gantt', () => {
  test('Gantt view exposes a scrollable timeline region', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sonic-bloom-locale', 'en');
    });
    // Narrow width so timeline (min ~260px + 520px) overflows horizontally
    await page.setViewportSize({ width: 600, height: 700 });
    await page.goto('/app/dashboard');

    await page.getByRole('radio', { name: 'Gantt chart' }).click();

    const scroll = page.getByTestId('queue-gantt-scroll');
    await expect(scroll).toBeVisible();

    const dims = await scroll.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    // Wide timeline + multiple rows should overflow at least one axis in default mock state
    const scrollable = dims.scrollWidth > dims.clientWidth || dims.scrollHeight > dims.clientHeight;
    expect(scrollable).toBe(true);

    // Smoke: programmatic scroll works (trackpad/wheel use same scroll metrics)
    await scroll.evaluate((el) => {
      el.scrollLeft = Math.min(40, el.scrollWidth - el.clientWidth);
      el.scrollTop = Math.min(20, el.scrollHeight - el.clientHeight);
    });
    const after = await scroll.evaluate((el) => ({ scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }));
    expect(Math.max(after.scrollLeft, after.scrollTop)).toBeGreaterThan(0);
  });
});
