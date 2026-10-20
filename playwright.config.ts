import { defineConfig, devices } from '@playwright/test';

const seite = `http://localhost:4173${process.env.NEXT_PUBLIC_BASIS_PFAD ?? '/ImmoBerlin'}/`;

// Browser-Tests gegen den fertigen statischen Export (npm run test:e2e).
// Vorher bauen mit NEXT_PUBLIC_SUPABASE_URL=http://supabase.test, die Tests ersetzen Supabase vollständig.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: seite,
    locale: 'de-DE',
    trace: 'retain-on-failure',
    // In der Cloud-Sandbox liegt Chromium an einem festen Ort, sonst lädt "npx playwright install" ihn
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /handy\.spec\.ts/ },
    { name: 'handy', use: { ...devices['Pixel 7'] }, testMatch: /handy\.spec\.ts/ },
  ],
  webServer: {
    command: 'node tests/e2e/server.mjs',
    url: seite,
    reuseExistingServer: !process.env.CI,
  },
});
