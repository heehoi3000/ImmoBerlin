import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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

test('Handy: Menü ist per Tastatur bedienbar und barrierefrei', async ({ page }) => {
  await attrappeEinrichten(page, STANDARD_DATEN);
  await page.goto('impressum/');
  const oeffnen = page.getByRole('button', { name: 'Menü öffnen' });
  await oeffnen.click();
  const menue = page.getByRole('dialog', { name: 'Menü' });
  await expect(menue).toBeVisible();
  await expect(menue.locator(':focus')).toHaveCount(1);
  const ergebnis = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(ergebnis.violations.map(v => v.id)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(menue).toBeHidden();
  await expect(oeffnen).toBeFocused();
});
