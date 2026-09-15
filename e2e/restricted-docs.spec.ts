import { test, expect } from '@playwright/test';
import { installMockApi, createMockState, loginAs } from './mock-backend';

/** CIN/restricted documents: strong indicator, permission-gated actions, clean 403s. */
test.describe('restricted documents', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, createMockState());
  });

  test('HR sees the sensitive badge but cannot download the CIN', async ({ page }) => {
    await loginAs(page, 'rh@steg.tn', 'HR');
    await page.goto('/applications');
    await page.getByRole('link', { name: 'APP-2026-000123' }).click();
    await page.getByRole('tab', { name: 'Documents' }).click();
    const cinRow = page.locator('.st-docrow', { hasText: 'cin.png' });
    await expect(cinRow.getByText('Donnée sensible')).toBeVisible();
    await expect(cinRow.getByRole('button', { name: /Télécharger/ })).toBeDisabled();
    // …while the unrestricted CV downloads normally.
    const cvRow = page.locator('.st-docrow', { hasText: 'cv.pdf' });
    const downloadPromise = page.waitForEvent('download');
    await cvRow.getByRole('button', { name: /Télécharger/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('cv.pdf');
  });

  test('ADMIN downloads the restricted CIN through the guarded endpoint', async ({ page }) => {
    let restrictedHit = false;
    page.on('request', (req) => {
      if (req.url().includes('/documents/doc-cin-app/download-restricted')) restrictedHit = true;
    });
    await loginAs(page, 'admin@steg.tn', 'ADMIN');
    await page.goto('/applications');
    await page.getByRole('link', { name: 'APP-2026-000123' }).click();
    await page.getByRole('tab', { name: 'Documents' }).click();
    const cinRow = page.locator('.st-docrow', { hasText: 'cin.png' });
    const downloadPromise = page.waitForEvent('download');
    await cinRow.getByRole('button', { name: /Télécharger/ }).click();
    await downloadPromise;
    expect(restrictedHit).toBe(true);
  });

  test('finance dossier flags the CIN row for a reader without the permission', async ({
    page,
  }) => {
    await loginAs(page, 'dir@steg.tn', 'DIRECTOR');
    await page.goto('/finance/case-1');
    await page.getByRole('tab', { name: 'Pièces' }).click();
    const cinRow = page.locator('.st-docrow', { hasText: 'CIN_COPY' });
    await expect(cinRow.getByText('Donnée sensible')).toBeVisible();
    await expect(cinRow.getByRole('button', { name: /Télécharger/ })).toBeDisabled();
  });
});
