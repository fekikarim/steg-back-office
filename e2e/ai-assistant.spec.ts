import { test, expect } from '@playwright/test';
import { installMockApi, createMockState, loginAs } from './mock-backend';

/** AI assistant panel: backend-first answers with graceful fallback. */
test.describe('ai assistant', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, createMockState());
  });

  test('HR asks a suggested question and gets a backend answer', async ({ page }) => {
    await loginAs(page, 'admin@steg.tn', 'ADMIN');
    await page.getByRole('button', { name: 'Assistant administratif' }).click();
    await page.getByRole('button', { name: 'Combien de candidatures en attente ?' }).click();
    await expect(page.getByText(/Réponse consultative \(mock\)/)).toBeVisible();
  });

  test('SUPERVISOR opens the assistant within the assigned scope', async ({ page }) => {
    await loginAs(page, 'sup@steg.tn', 'SUPERVISOR');
    await page.getByRole('button', { name: 'Assistant administratif' }).click();
    await expect(page.getByText(/chiffres proviennent du backend|backend/i).first()).toBeVisible();
  });
});
