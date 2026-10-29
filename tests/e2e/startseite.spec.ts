import { expect, test } from '@playwright/test';
import { STANDARD_DATEN, attrappeEinrichten } from './attrappe';

test.describe('Startseite', () => {
  test('unter der Suchleiste steht direkt So funktioniert\'s', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('');
    await expect(page.getByRole('heading', { name: "So funktioniert's" })).toBeVisible();
    await expect(page.getByText('Beliebt:')).toHaveCount(0);
    await expect(page.getByText('Haltestellen', { exact: true })).toHaveCount(0);
  });

  test('Linie in der Suchleiste wählen und mit Umkreis suchen', async ({ page }) => {
    const auf = await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('');
    const linie = page.getByRole('combobox', { name: 'ÖPNV-Linie' });
    await linie.fill('U8');
    await expect(page.getByRole('option', { name: /^U8/ }).first()).toBeVisible();
    await linie.press('Enter');
    await expect(page.getByRole('button', { name: 'U8 entfernen' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Maximale Entfernung zur Haltestelle' }).selectOption('1000');
    await page.getByRole('button', { name: 'Suchen', exact: true }).click();

    await expect(page).toHaveURL(/\/suche\/$/);
    await expect(page.getByRole('heading', { name: '2 Wohnungen zur Miete' })).toBeVisible();
    expect(auf.rpc.find(r => r.name === 'anzeigen_nahe_linien')?.body).toEqual({ linien_ids: [8], radius_m: 1000 });
    await expect(page.getByRole('button', { name: 'ÖPNV-Linien: U8 · 1000 m' })).toBeVisible();
  });

  test('ohne Ort alle U8 deutschlandweit, mit Ort nur die U8 dort', async ({ page }) => {
    const auf = await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('');
    const linie = page.getByRole('combobox', { name: 'ÖPNV-Linie' });
    await linie.fill('U8');
    await expect(page.getByRole('option', { name: /Nordstadt/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /Wittenau/ })).toBeVisible();
    await linie.fill('');

    await page.getByPlaceholder(/Ort oder PLZ/).fill('Berl');
    await page.getByRole('option', { name: 'Berlin', exact: true }).click();
    await linie.fill('U8');
    await expect(page.getByText('Linien in Berlin')).toBeVisible();
    await expect(page.getByRole('option', { name: /Wittenau/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /Nordstadt/ })).toHaveCount(0);
    const anfrage = auf.rpc.find(r => r.name === 'linien_im_gebiet')?.body;
    expect(anfrage?.p_begriff).toBe('U8');
    expect((anfrage?.p_gebiet as { type: string }).type).toBe('Polygon');
  });

  test('Rücktaste entfernt die zuletzt gewählte Linie', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('');
    const linie = page.getByRole('combobox', { name: 'ÖPNV-Linie' });
    await linie.fill('U8');
    await page.getByRole('option', { name: /^U8/ }).first().click();
    await expect(page.getByRole('button', { name: 'U8 entfernen' })).toBeVisible();
    await linie.press('Backspace');
    await expect(page.getByRole('button', { name: 'U8 entfernen' })).toHaveCount(0);
  });
});
