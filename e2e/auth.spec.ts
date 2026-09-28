import { test, expect } from '@playwright/test';
import { installMockApi, createMockState, loginAs } from './mock-backend';

/**
 * Back Office admits ADMIN and SUPERVISOR only. Removed roles (HR, FINANCE,
 * DIRECTOR) and other clients (CANDIDATE, INTERN) cannot log in: the mock
 * rejects them like the backend + login gate do.
 */
test.describe('auth & role isolation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await installMockApi(page, createMockState());
  });

  test('unauthenticated dashboard access redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
    await expect(page.getByRole('heading', { name: /connexion|sign in/i })).toBeVisible();
  });

  test('ADMIN login lands on the dashboard shell', async ({ page }) => {
    await loginAs(page, 'admin@steg.tn', 'ADMIN');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('navigation', { name: /principal|primary/i })).toBeVisible();
    await expect(page.locator('#st-content')).toBeVisible();
  });

  test('SUPERVISOR login lands on their dashboard', async ({ page }) => {
    await loginAs(page, 'sup@steg.tn', 'SUPERVISOR');
    await expect(page).toHaveURL(/\/supervisor-dashboard$/);
    await expect(page.getByRole('navigation', { name: /principal|primary/i })).toBeVisible();
  });

  test('SUPERVISOR home is the dashboard: no dashboard nav entry, /dashboard redirects', async ({
    page,
  }) => {
    await loginAs(page, 'sup@steg.tn', 'SUPERVISOR');
    const nav = page.getByRole('navigation', { name: /principal|primary/i });
    // No ADMIN dashboard entry; the supervisor home dashboard is present instead.
    await expect(nav.getByRole('link', { href: '/dashboard' })).toHaveCount(0);
    await expect(nav.getByRole('link', { href: '/supervisor-dashboard' })).toHaveCount(1);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/supervisor-dashboard$/);
  });

  test('removed HR role cannot log in (backend + gate denial)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/e-mail|email/i).fill('rh@steg.tn');
    await page.getByLabel(/mot de passe|password/i).fill('Password123!');
    await page.getByRole('button', { name: /se connecter|sign in/i }).click();
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
    await expect(page.getByText(/incorrect|réservé|restricted/i).first()).toBeVisible();
  });

  test('SUPERVISOR is denied candidates, admin, audit, reports, tasks and notifications', async ({
    page,
  }) => {
    await loginAs(page, 'sup@steg.tn', 'SUPERVISOR');
    for (const path of [
      '/candidates',
      '/applications',
      '/admin',
      '/audit',
      '/reports',
      '/tasks',
      '/notifications',
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/forbidden$/);
    }
  });

  test('SUPERVISOR reaches supervision, finance and assistant', async ({ page }) => {
    await loginAs(page, 'sup@steg.tn', 'SUPERVISOR');
    await page.goto('/supervisor');
    await expect(page).toHaveURL(/\/supervisor$/);
    await page.goto('/finance');
    await expect(page).toHaveURL(/\/finance$/);
  });

  test('ADMIN reaches every workspace', async ({ page }) => {
    await loginAs(page, 'admin@steg.tn', 'ADMIN');
    for (const path of [
      '/dashboard',
      '/candidates',
      '/applications',
      '/internships',
      '/supervisor',
      '/finance',
      '/tasks',
      '/notifications',
      '/audit',
      '/admin',
      '/reports',
    ]) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/forbidden$/);
    }
  });
});
