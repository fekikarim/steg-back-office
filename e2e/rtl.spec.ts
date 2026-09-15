import { test, expect } from '@playwright/test';
import { installMockApi, createMockState, loginAs } from './mock-backend';

/** True RTL: placement, tables, dialogs and directional icons — not just translated strings. */
test.describe('arabic RTL', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, createMockState());
    await loginAs(page, 'rh@steg.tn', 'HR');
  });

  test('switching to Arabic flips the whole layout', async ({ page }) => {
    await page.locator('header select').first().selectOption('ar');
    await expect(page.locator('html[dir="rtl"]')).toBeAttached();

    // Sidebar docks on the inline-start side in RTL → physical right.
    const sidebar = page.locator('.st-side');
    await expect(sidebar).toBeVisible();
    const box = await sidebar.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.x + box.width).toBeGreaterThan(viewport.width - 4);

    // Arabic strings render; tables keep working.
    await expect(page.getByText('لوحة القيادة').first()).toBeVisible();
    await page.goto('/applications');
    await page.getByRole('link', { name: 'APP-2026-000123' }).click();
    await expect(page.getByText('Amira Ben Salah').first()).toBeVisible();
  });

  test('dialogs and review flow work mirrored', async ({ page }) => {
    await page.locator('header select').first().selectOption('ar');
    await page.goto('/applications');
    await page.getByRole('link', { name: 'APP-2026-000123' }).click();
    await page.getByRole('button', { name: 'بدء الدراسة' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'تأكيد' }).click();
    await expect(page.getByRole('button', { name: 'قبول' })).toBeVisible();
  });
});
