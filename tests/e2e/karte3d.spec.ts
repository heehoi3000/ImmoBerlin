import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { STANDARD_DATEN, anzeige, attrappeEinrichten } from './attrappe';

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

// Echte Gebäudekachel von OpenFreeMap (Marzahn, Mehrower Allee; © OpenMapTiles © OpenStreetMap-Mitwirkende, ODbL).
// Darin sind gleich hohe Häuser eines Viertels zu einem MultiPolygon zusammengefasst; hervorgehoben werden
// darf trotzdem nur das eine Haus am Inseratspunkt.
async function echteKachel(page: Page) {
  await page.route(/tiles\.openfreemap\.org\/test\/(\d+)\/(\d+)\/(\d+)\.pbf/, r => {
    const [, z, x, y] = r.request().url().match(/test\/(\d+)\/(\d+)\/(\d+)\.pbf/)!;
    const datei = `tests/e2e/kacheln/${z}-${x}-${y}.pbf`;
    if (!existsSync(datei)) return r.fulfill({ status: 204, body: '' });
    return r.fulfill({ contentType: 'application/x-protobuf', body: readFileSync(datei) });
  });
}

test('Inseratsseite hebt genau das Haus des Inserats in 3D hervor', async ({ page }) => {
  // Inserat und Haltestellen von Mitte nach Marzahn verschoben, damit die Karte auf die Kachel passt
  const dLat = 52.5569 - 52.53, dLon = 13.5592 - 13.40;
  await attrappeEinrichten(page, {
    ...STANDARD_DATEN,
    anzeigen: [anzeige('a1', { koordinate_lat: 52.5569, koordinate_lon: 13.5592 })],
    naheHalte: STANDARD_DATEN.naheHalte!.map(h => ({ ...h, lat: Number(h.lat) + dLat, lon: Number(h.lon) + dLon })),
    grundversorgung: [],
  });
  await vektorstil(page);
  await echteKachel(page);
  await page.goto('anzeige/?id=a1');
  await expect(page.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-gebaeude]')).toHaveAttribute('data-gebaeude', '1');
});

test('Suchseite hebt kein Gebäude hervor', async ({ page }) => {
  await attrappeEinrichten(page, STANDARD_DATEN);
  await vektorstil(page);
  await page.goto('suche/');
  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.locator('[data-gebaeude]')).toHaveCount(0);
});
