import { expect, test } from '@playwright/test';
import { STANDARD_DATEN, attrappeEinrichten } from './attrappe';

test('Handy: Umschalter zwischen Liste und Karte', async ({ page }) => {
  await attrappeEinrichten(page, STANDARD_DATEN);
  await page.goto('suche/');
  await expect(page.getByText('Altbau an der U8')).toBeVisible();
  await page.getByRole('button', { name: /Karte/ }).last().click();
  await expect(page.getByText('Altbau an der U8')).toBeHidden();
  await page.getByRole('button', { name: /Liste/ }).last().click();
  await expect(page.getByText('Altbau an der U8')).toBeVisible();
});

test('Handy: Seite ist nicht breiter als der Bildschirm', async ({ page }) => {
  await attrappeEinrichten(page, STANDARD_DATEN);
  for (const pfad of ['', 'suche/', 'inserieren/', 'impressum/']) {
    await page.goto(pfad);
    const breite = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(breite, `${pfad || 'Startseite'} scrollt seitlich`).toBeLessThanOrEqual(0);
  }
});
