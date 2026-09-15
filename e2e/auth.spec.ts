import { test, expect } from '@playwright/test';
import { installMockApi, createMockState, loginAs } from './mock-backend';

test.describe('auth & route guards', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, createMockState());
  });

  test('unauthenticated dashboard access redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /connexion|sign in/i })).toBeVisible();
  });

  test('demo login as HR lands on the dashboard shell', async ({ page }) => {
    await loginAs(page, 'rh@steg.tn', 'HR');
    await expect(page.getByRole('navigation', { name: /principal|primary/i })).toBeVisible();
    await expect(page.locator('#st-content')).toBeVisible();
  });

  test('SUPERVISOR is denied the finance workspace (guard, then forbidden page)', async ({
    page,
  }) => {
    await loginAs(page, 'sup@steg.tn', 'SUPERVISOR');
    await page.goto('/finance');
    await expect(page).toHaveURL(/\/forbidden$/);
    await expect(page.getByText(/accès restreint|restricted/i).first()).toBeVisible();
  });

  test('HR cannot reach the ADMIN workspace', async ({ page }) => {
    await loginAs(page, 'rh@steg.tn', 'HR');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});
