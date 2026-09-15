import { test, expect } from '@playwright/test';
import { installMockApi, createMockState, loginAs } from './mock-backend';

/**
 * Full staff lifecycle (mocked API, stateful):
 * HR review → accept → create internship → assign supervisor →
 * complete → certificate → FINANCE approve → receipt download.
 * Asserts server confirmations drive each step (status changes, references).
 */
test.describe('staff lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, createMockState());
  });

  test('HR reviews, accepts, staffs, completes, certifies; finance approves + receipt', async ({
    page,
  }) => {
    // --- HR: review & accept ---
    await loginAs(page, 'rh@steg.tn', 'HR');
    await page.goto('/applications');
    await page.getByRole('link', { name: 'APP-2026-000123' }).click();
    await expect(page).toHaveURL(/\/applications\/app-1$/);
    await expect(page.getByText('Amira Ben Salah').first()).toBeVisible();

    await page.getByRole('button', { name: 'Commencer l’instruction' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByRole('button', { name: 'Accepter' })).toBeVisible();

    await page.getByRole('button', { name: 'Accepter' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    const createLink = page.getByRole('link', { name: 'Créer le stage' });
    await expect(createLink).toBeVisible();

    // --- HR: create internship from the accepted application ---
    await createLink.click();
    await expect(page).toHaveURL(/\/internships\/new\?applicationId=app-1/);
    await expect(page.getByText('APP-2026-000123')).toBeVisible();
    await page.getByRole('button', { name: 'Créer le stage' }).click();
    await expect(page).toHaveURL(/\/internships\/ship-1$/);
    await expect(page.getByText('STAGE-2026-000007').first()).toBeVisible();
    await expect(page.getByText('PFE').first()).toBeVisible();

    // --- HR: activate + assign supervisor ---
    await page.getByRole('button', { name: 'Activer' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByRole('button', { name: 'Clôturer' })).toBeVisible();

    await page.getByRole('tab', { name: 'Affectation' }).click();
    await page.getByRole('button', { name: 'Affecter' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Département/).selectOption({ label: 'DSI (DSI)' });
    await dialog.getByLabel(/Encadrant/).selectOption({ label: 'Leila Mansour · Supervisor' });
    await dialog.getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByText('Leila Mansour').first()).toBeVisible();

    // --- HR: complete + certificate ---
    await page.getByRole('tab', { name: 'Aperçu' }).click();
    await page.getByRole('button', { name: 'Clôturer' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await page.getByRole('button', { name: 'Générer l’attestation' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByText('CERT-2026-000003')).toBeVisible();

    // --- FINANCE: review, approve, receipt ---
    await page.evaluate(() => localStorage.clear());
    await loginAs(page, 'finance@steg.tn', 'FINANCE');
    await page.goto('/finance');
    await page.getByRole('link', { name: 'FIN-2026-000009' }).click();
    await expect(page).toHaveURL(/\/finance\/case-1$/);
    // Backend-verbatim calculation: 6 completed months capped to 150 TND.
    await expect(page.getByText('150').first()).toBeVisible();
    await expect(page.getByText('Montant plafonné')).toBeVisible();

    await page.getByRole('button', { name: 'Approuver le paiement' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    // Receipt-consequence confirmation, then backend-confirmed receipt.
    await expect(
      page.getByText(/reçu de paiement PDF officiel|official PDF payment receipt/),
    ).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByText('PAY-2026-000004')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Télécharger|Download/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('PAY-2026-000004');
  });

  test('reject requires a reason and surfaces the rejected status', async ({ page }) => {
    await loginAs(page, 'finance@steg.tn', 'FINANCE');
    await page.goto('/finance');
    await page.getByRole('link', { name: 'FIN-2026-000009' }).click();
    await page.getByRole('button', { name: 'Rejeter le paiement' }).click();
    const dialog = page.getByRole('dialog');
    // Too short → client-side validation blocks.
    await dialog.getByLabel(/Commentaire/).fill('non');
    await dialog.getByRole('button', { name: 'Confirmer' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await dialog.getByLabel(/Commentaire/).fill('Pièce d’identité illisible, merci de renvoyer.');
    await dialog.getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.getByText('REJECTED').first()).toBeVisible();
  });
});
