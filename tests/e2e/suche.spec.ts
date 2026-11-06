import { expect, test } from '@playwright/test';
import { STANDARD_DATEN, attrappeEinrichten } from './attrappe';

test.describe('Suche', () => {
  test('zeigt alle Angebote und filtert nach Kaltmiete', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('suche/');
    await expect(page.getByText('3 Wohnungen zur Miete')).toBeVisible();
    await expect(page.getByText('Altbau an der U8')).toBeVisible();

    await page.getByRole('button', { name: /^Kaltmiete/ }).click();
    await page.getByPlaceholder('bis').first().fill('800');
    await page.getByRole('button', { name: 'Ergebnisse anzeigen' }).click();

    await expect(page.getByText('2 Wohnungen zur Miete')).toBeVisible();
    await expect(page.getByText('Neubau mit Balkon')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Kaltmiete: bis 800 €' })).toBeVisible();
  });

  test('Linienfilter sucht im Umkreis der Haltestellen', async ({ page }) => {
    const auf = await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('suche/');
    await expect(page.getByText('3 Wohnungen zur Miete')).toBeVisible();

    await page.getByRole('button', { name: 'ÖPNV-Linien' }).click();
    await page.getByPlaceholder('z.B. U2, BVG, Ruhleben').fill('U8');
    // Liste zeigt Nummer und gekürzte Endpunkte; die genau passende Nummer steht oben
    const vorschlag = page.getByRole('button', { name: /U8\s*S\+U Wittenau – S\+U Hermannstr\./ });
    await expect(vorschlag).toBeVisible();
    await vorschlag.click();
    await page.getByRole('button', { name: '1000 m' }).click();
    await page.getByRole('button', { name: 'Ergebnisse anzeigen' }).click();

    await expect(page.getByText('2 Wohnungen zur Miete')).toBeVisible();
    const suche = auf.rpc.find(r => r.name === 'anzeigen_nahe_linien');
    expect(suche?.body).toEqual({ linien_ids: [8], radius_m: 1000 });
    await expect(page.getByRole('button', { name: 'ÖPNV-Linien: U8 · 1000 m' })).toBeVisible();
  });

  test('Linienfilter zeigt den echten Streckenverlauf, wenn es einen passenden gibt', async ({ page }) => {
    const halte = [
      { stop_id: 's1', name: 'U Bernauer Str.', lat: 52.5375, lon: 13.3963 },
      { stop_id: 's2', name: 'U Rosenthaler Platz', lat: 52.5297, lon: 13.4015 },
      { stop_id: 's3', name: 'U Weinmeisterstr.', lat: 52.5254, lon: 13.4053 },
    ];
    await attrappeEinrichten(page, { ...STANDARD_DATEN, haltestellen: { 8: halte } });
    const geladen: string[] = [];
    // U8 gibt es auch in Frankfurt; nur die Berliner Relation passt zu den Haltestellen
    await page.route('**/strecken/**', route => {
      const teil = new URL(route.request().url()).pathname.replace(/^.*\/strecken\//, '');
      geladen.push(teil);
      if (teil === 'i/u/u8.json') {
        return route.fulfill({ json: [[939116, 'VGF', [8.621, 50.099, 8.687, 50.18]], [2679013, 'BVG', [13.39, 52.52, 13.41, 52.54]]] });
      }
      if (teil === 'r/2679013.json') {
        // Polyline durch die drei Haltestellen (wie scripts/strecken/strecken_bauen.py sie schreibt)
        return route.fulfill({ json: { p: ['kft_I{mwpAvo@o_@zYwV'] } });
      }
      return route.fulfill({ status: 404, body: '' });
    });
    await page.goto('suche/');
    await page.getByRole('button', { name: 'ÖPNV-Linien' }).click();
    await page.getByPlaceholder('z.B. U2, BVG, Ruhleben').fill('U8');
    await page.getByRole('button', { name: /U8\s*S\+U Wittenau/ }).click();
    await page.getByRole('button', { name: 'Ergebnisse anzeigen' }).click();
    await expect(page.getByText('2 Wohnungen zur Miete')).toBeVisible();
    await expect.poll(() => geladen).toContain('r/2679013.json');
    expect(geladen).not.toContain('r/939116.json');
  });

  test('Karte: nahe Angebote als Gruppe, Klick zoomt hinein, Pin wählt das Angebot', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('suche/');
    const karte = page.locator('.maplibregl-map');
    const gruppe = karte.locator('.preis-gruppe');
    await expect(gruppe.first()).toBeVisible();
    // Gruppen per Tastatur oder Klick öffnen, bis alle Pins einzeln stehen
    for (let i = 0; i < 4 && await gruppe.count() > 0; i++) {
      await gruppe.first().click();
      await page.waitForTimeout(700);
    }
    const pin = karte.getByRole('button', { name: 'Neubau mit Balkon, 1.000 €' });
    await expect(pin).toBeVisible();
    await pin.click();
    await expect(pin).toHaveClass(/aktiv/);
    await expect(page.getByRole('button', { name: 'Schließen' })).toBeVisible();
  });

  test('Ortssuche findet Berlin in den eigenen Ortsdaten, Bezirke werden angeboten', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('suche/');
    await page.getByPlaceholder(/Ort oder PLZ/).fill('Berl');
    await page.getByRole('option', { name: 'Berlin', exact: true }).click();
    await page.getByRole('button', { name: 'Suchen', exact: true }).click();
    await expect(page.getByText('in Berlin', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Bezirke' }).click();
    await page.getByPlaceholder(/Bezirk oder Ortsteil/).fill('Pa');
    await page.getByRole('button', { name: /Pankow/ }).click();
    await page.getByRole('button', { name: 'Ergebnisse anzeigen' }).click();
    await expect(page.getByRole('heading', { name: '1 Wohnung zur Miete' })).toBeVisible();
    await expect(page.getByText('Neubau mit Balkon')).toBeVisible();
  });

  test('Fehler der Datenbank wird angezeigt statt einer leeren Liste', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.route('http://supabase.test/rest/v1/anzeigen**', route =>
      route.fulfill({ status: 500, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"message":"kaputt"}' }));
    await page.goto('suche/');
    await expect(page.getByText('Suche fehlgeschlagen')).toBeVisible();
  });
});
