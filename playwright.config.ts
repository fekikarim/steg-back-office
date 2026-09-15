import { defineConfig, devices } from '@playwright/test';

/**
 * Back Office E2E (Phase C7). The suite drives the real UI against a
 * stateful mocked API (see e2e/mock-backend.ts): deterministic, hermetic,
 * and independent of backend seed data. A live-backend smoke path is
 * documented in docs/BACK_OFFICE_QA_REPORT.md.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: '**/responsive.spec.ts',
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: '**/responsive.spec.ts' },
  ],
  webServer: {
    command: 'npm start -- --port 4200',
    url: 'http://localhost:4200/login',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
