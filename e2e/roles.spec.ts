import { test, expect } from '@playwright/test';
import { installMockApi, createMockState, loginAs } from './mock-backend';

/** Role boundaries: supervisor scope vs admin scope, backend-verified too. */
test.describe('role boundaries', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, createMockState());
  });

  test('SUPERVISOR sees validation + receipts nav, no admin entries', async ({ page }) => {
    await loginAs(page, 'sup@steg.tn', 'SUPERVISOR');
    const nav = page.getByRole('navigation', { name: /principal|primary/i });
    await expect(nav).toBeVisible();
    await expect(nav.getByText('Finance & paiements').first()).toBeVisible();
    await expect(nav.getByText('Stages').first()).toBeVisible();
    await expect(nav.getByText('Candidats').first()).toHaveCount(0);
    await expect(nav.getByText('Administration').first()).toHaveCount(0);
    await page.goto('/candidates');
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test('ADMIN views the finance case and holds decision power', async ({ page }) => {
    await loginAs(page, 'admin@steg.tn', 'ADMIN');
    await page.goto('/finance/case-1');
    await expect(page.getByText('FIN-2026-000009').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approuver le paiement' })).toBeVisible();
  });

  test('SUPERVISOR decides assigned finance cases (scoped backend-side)', async ({ page }) => {
    await loginAs(page, 'sup@steg.tn', 'SUPERVISOR');
    await page.goto('/finance/case-1');
    await expect(page.getByText('FIN-2026-000009').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approuver le paiement' })).toBeVisible();
  });

  test('SUPERVISOR cannot reach user administration or audit', async ({ page }) => {
    await loginAs(page, 'sup@steg.tn', 'SUPERVISOR');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/forbidden$/);
    await page.goto('/audit');
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});
