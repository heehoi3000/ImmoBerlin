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

// Gebäudekacheln wie bei OpenFreeMap: Ebene "building" mit Kennung und Höhe, erzeugt aus GeoJSON
async function gebaeudeKacheln(page: Page, haeuser: GeoJSON.Feature[]) {
  const { GeoJSONVT } = await import('@maplibre/geojson-vt');
  const { fromGeojsonVt } = await import('@maplibre/vt-pbf');
  const index = new GeoJSONVT({ type: 'FeatureCollection', features: haeuser }, { maxZoom: 14, indexMaxZoom: 14, buffer: 64 });
  await page.route(/tiles\.openfreemap\.org\/test\/(\d+)\/(\d+)\/(\d+)\.pbf/, r => {
    const [, z, x, y] = r.request().url().match(/test\/(\d+)\/(\d+)\/(\d+)\.pbf/)!.map(Number);
    const kachel = index.getTile(z, x, y);
    if (!kachel) return r.fulfill({ status: 204, body: '' });
    return r.fulfill({ contentType: 'application/x-protobuf', body: Buffer.from(fromGeojsonVt({ building: kachel }, { version: 2, extent: 4096 })) });
  });
}
const haus = (id: number, lon: number, lat: number, hoehe: number): GeoJSON.Feature => ({
  type: 'Feature', id, properties: { render_height: hoehe, render_min_height: 0 },
  geometry: { type: 'Polygon', coordinates: [[[lon - 0.0002, lat - 0.0001], [lon + 0.0002, lat - 0.0001], [lon + 0.0002, lat + 0.0001], [lon - 0.0002, lat + 0.0001], [lon - 0.0002, lat - 0.0001]]] },
});

test('Inseratsseite hebt das Gebäude des Inserats in 3D hervor', async ({ page }) => {
  await attrappeEinrichten(page, STANDARD_DATEN);
  await vektorstil(page);
  // a1 liegt bei (52.53, 13.40); daneben zwei weitere Häuser
  await gebaeudeKacheln(page, [haus(11, 13.40, 52.53, 22), haus(12, 13.4006, 52.53, 15), haus(13, 13.40, 52.5304, 18)]);
  await page.goto('anzeige/?id=a1');
  await expect(page.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-gebaeude]')).toHaveAttribute('data-gebaeude', /^[1-9]/);
});

test('Suchseite hebt kein Gebäude hervor', async ({ page }) => {
  await attrappeEinrichten(page, STANDARD_DATEN);
  await vektorstil(page);
  await page.goto('suche/');
  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.locator('[data-gebaeude]')).toHaveCount(0);
});
