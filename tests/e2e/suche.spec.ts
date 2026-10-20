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

  test('Ortssuche findet Berlin in den eigenen Ortsdaten, Bezirke werden angeboten', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('suche/');
    await page.getByPlaceholder(/Ort oder PLZ/).fill('Berl');
    await page.getByRole('button', { name: 'Berlin', exact: true }).click();
    await page.getByRole('button', { name: 'Suchen', exact: true }).click();
    await expect(page.getByText('in Berlin', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Bezirke' }).click();
    await page.getByPlaceholder(/Bezirk oder Ortsteil/).fill('Pa');
    await page.getByRole('button', { name: /Pankow/ }).click();
    await page.getByRole('button', { name: 'Ergebnisse anzeigen' }).click();
    await expect(page.getByRole('heading', { name: /^1 Wohnung(en)? zur Miete/ })).toBeVisible();
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
