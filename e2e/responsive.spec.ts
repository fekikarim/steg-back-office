import { test, expect } from '@playwright/test';
import { installMockApi, createMockState, loginAs } from './mock-backend';

/** Mobile / tablet / desktop: drawer nav, no overflow, dialogs fit the viewport. */
test.describe('responsive', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, createMockState());
  });

  test('mobile drawer navigation works and nothing overflows', async ({ page }) => {
    await loginAs(page, 'rh@steg.tn', 'HR');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('.st-shell__side--open')).toBeAttached();
    await page.goto('/applications');
    await page.getByRole('link', { name: 'APP-2026-000123' }).click();
    await expect(page).toHaveURL(/\/applications\/app-1$/);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('dialogs fit small viewports', async ({ page }) => {
    await loginAs(page, 'rh@steg.tn', 'HR');
    await page.goto('/applications');
    await page.getByRole('link', { name: 'APP-2026-000123' }).click();
    await page.getByRole('button', { name: 'Commencer l’instruction' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.width).toBeLessThanOrEqual(viewport.width);
  });

  test('200% zoom keeps the dashboard usable without horizontal scroll', async ({ page }) => {
    await loginAs(page, 'rh@steg.tn', 'HR');
    await page.evaluate(() => {
      document.body.style.zoom = '200%';
    });
    await expect(page.locator('#st-content')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
