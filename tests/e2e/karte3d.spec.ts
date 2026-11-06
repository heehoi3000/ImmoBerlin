import { expect, test, type Page } from '@playwright/test';
import { STANDARD_DATEN, attrappeEinrichten } from './attrappe';

// Kartenstil mit Vektorquelle wie bei OpenFreeMap (Kacheln selbst gibt es im Test nicht)
async function vektorstil(page: Page) {
  await page.route('https://tiles.openfreemap.org/styles/positron', r => r.fulfill({ json: {
    version: 8,
    sources: { openmaptiles: { type: 'vector', tiles: ['https://tiles.openfreemap.org/test/{z}/{x}/{y}.pbf'], maxzoom: 14 } },
    layers: [{ id: 'hintergrund', type: 'background', paint: { 'background-color': '#f2f2ef' } }],
  } }));
}

test.describe('3D-Ansicht', () => {
  test('Suche startet flach, Knopf schaltet 3D ein und aus', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await vektorstil(page);
    await page.goto('suche/');
    const knopf = page.getByRole('button', { name: '3D' });
    await expect(knopf).toHaveAttribute('aria-pressed', 'false');
    await knopf.click();
    await expect(knopf).toHaveAttribute('aria-pressed', 'true');
    await knopf.click();
    await expect(knopf).toHaveAttribute('aria-pressed', 'false');
  });

  test('Inseratsseite startet in 3D, außer bei reduzierter Bewegung', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await vektorstil(page);
    await page.goto('anzeige/?id=a1');
    await expect(page.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await expect(page.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('ohne erreichbaren Kartenstil gibt es keinen 3D-Knopf', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('anzeige/?id=a1');
    await expect(page.locator('.station-symbol')).toHaveCount(3);
    await expect(page.getByRole('button', { name: '3D' })).toHaveCount(0);
  });
});
