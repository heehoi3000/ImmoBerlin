// Angaben für Suchmaschinen und geteilte Links: Titel, Beschreibung, Vorschaubild, Symbole, Sitemap.
import { expect, test } from '@playwright/test';
import { STANDARD_DATEN, attrappeEinrichten } from './attrappe';

test('Startseite hat Titel, Beschreibung, Vorschaubild und Symbol', async ({ page, request }) => {
  await attrappeEinrichten(page, STANDARD_DATEN);
  await page.goto('');
  await expect(page).toHaveTitle(/^IMMOBIL – /);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Bahn-, Tram- oder Buslinie/);
  const bild = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(bild).toMatch(/\/vorschau\.png$/);
  // Bilder und Symbole müssen unter dem Seitenpfad wirklich da sein
  for (const pfad of ['vorschau.png', 'icon.png', 'apple-icon.png']) {
    const antwort = await request.get(pfad);
    expect(antwort.status(), pfad).toBe(200);
    expect(antwort.headers()['content-type']).toContain('image/png');
  }
  const symbol = await page.locator('link[rel="icon"]').getAttribute('href');
  expect((await request.get(new URL(symbol!, page.url()).href)).status()).toBe(200);
});

test('private Seiten sind für Suchmaschinen gesperrt, öffentliche haben eigene Titel', async ({ page }) => {
  await attrappeEinrichten(page, STANDARD_DATEN);
  await page.goto('konto/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.goto('suche/');
  await expect(page).toHaveTitle('Wohnungen und Häuser suchen – IMMOBIL');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
});

test('Sitemap nennt die öffentlichen Seiten', async ({ request }) => {
  const xml = await (await request.get('sitemap.xml')).text();
  expect(xml).toContain('/suche/</loc>');
  expect(xml).not.toContain('/konto/');
});
