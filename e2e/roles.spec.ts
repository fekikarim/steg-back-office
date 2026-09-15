import { test, expect } from '@playwright/test';
import { installMockApi, createMockState, loginAs } from './mock-backend';

/** Client-side visibility is UX convenience; every denial is backend-verified too. */
test.describe('role boundaries', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, createMockState());
  });

  test('SUPERVISOR sees no finance entry and is blocked from finance routes', async ({ page }) => {
    await loginAs(page, 'sup@steg.tn', 'SUPERVISOR');
    await expect(page.getByRole('navigation', { name: /principal|primary/i })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: /principal|primary/i }).getByText('Finance & paiements'),
    ).toHaveCount(0);
    await page.goto('/finance');
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test('ADMIN views the finance case but gets no payment decision buttons', async ({ page }) => {
    await loginAs(page, 'admin@steg.tn', 'ADMIN');
    await page.goto('/finance/case-1');
    await expect(page.getByText('FIN-2026-000009').first()).toBeVisible();
    // canDecide() requires the FINANCE role: decision buttons stay hidden.
    await expect(page.getByRole('button', { name: 'Approuver le paiement' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Rejeter le paiement' })).toHaveCount(0);
    // …while read-only review affordances remain.
    await expect(page.getByRole('button', { name: 'Recalculer' })).toBeVisible();
  });

  test('HR is blocked from the finance workspace entirely', async ({ page }) => {
    await loginAs(page, 'rh@steg.tn', 'HR');
    await page.goto('/finance/case-1');
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test('FINANCE cannot reach user administration', async ({ page }) => {
    await loginAs(page, 'finance@steg.tn', 'FINANCE');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});
