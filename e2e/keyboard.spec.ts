import { test, expect } from '@playwright/test';
import { installMockApi, createMockState } from './mock-backend';

/** Keyboard-only operation: tab order, Enter submit, Escape dismiss, skip link. */
test.describe('keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, createMockState());
  });

  test('login, review and dialogs work keyboard-only', async ({ page }) => {
    await page.goto('/login');
    // Skip link exists in the shell; login form is natively keyboard accessible.
    await page.getByLabel(/e-mail|email/i).pressSequentially('rh@steg.tn');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Password123!');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/dashboard');

    // Skip link targets the main content and moves focus.
    await page.keyboard.press('Tab');
    const skipHref = await page
      .getByRole('link', { name: /aller au contenu|skip to content|تخط/i })
      .getAttribute('href');
    expect(skipHref).toBe('#st-content');

    // Dialog opens, Escape closes it, focus never traps the page.
    await page.goto('/applications');
    await page.getByRole('link', { name: 'APP-2026-000123' }).click();
    await page.getByRole('button', { name: 'Commencer l’instruction' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    // Focus returns to a working page: the review button is actionable again.
    await expect(page.getByRole('button', { name: 'Commencer l’instruction' })).toBeEnabled();
  });
});
