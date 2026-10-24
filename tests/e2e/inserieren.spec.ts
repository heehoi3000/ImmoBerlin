import { expect, test } from '@playwright/test';
import { NUTZER, STANDARD_DATEN, anmelden, attrappeEinrichten } from './attrappe';

test.describe('Inserieren', () => {
  test('ohne Anmeldung kommt der Hinweis zum Konto', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('inserieren/');
    await expect(page.getByRole('link', { name: 'Anmelden oder registrieren' })).toBeVisible();
  });

  test('Pflichtangaben werden geprüft, dann wird das Inserat gespeichert', async ({ page }) => {
    await anmelden(page);
    const auf = await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('inserieren/');
    await expect(page.getByRole('heading', { name: 'Inserat aufgeben' })).toBeVisible();

    await page.getByLabel(/^Titel/).fill('Helle Wohnung am Park');
    await page.getByPlaceholder('Straße und Hausnummer, Ort').fill('Torstr 1');
    await page.getByRole('button', { name: 'Torstraße 1, 10119 Berlin' }).click();
    await expect(page.getByText('Lage gefunden: Torstraße 1, 10119 Berlin (Mitte)')).toBeVisible();
    await page.getByLabel(/^Kaltmiete/).fill('900');
    await page.getByLabel(/^Nebenkosten/).fill('150');
    await page.getByLabel(/^Wohnfläche/).fill('62,5');
    await page.getByLabel(/^Zimmer/).fill('2');

    // Ohne Energieausweis darf nicht gespeichert werden
    await page.getByRole('button', { name: 'Inserat veröffentlichen' }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText('Bitte mache die Angaben zum Energieausweis.');
    expect(auf.neueAnzeigen).toHaveLength(0);

    await page.getByRole('button', { name: 'Verbrauchsausweis' }).click();
    await page.getByLabel(/^Energiekennwert/).fill('95');
    await page.getByLabel(/^Wesentlicher Energieträger/).selectOption('Fernwärme');
    await page.getByLabel(/^Effizienzklasse/).selectOption('C');
    await page.getByLabel(/^Baujahr/).fill('1910');
    await page.getByRole('button', { name: 'Balkon/Terrasse' }).click();
    await expect(page.getByLabel('Art des WBS')).toHaveCount(0);
    await page.getByLabel('Wohnberechtigungsschein (WBS) erforderlich').check();
    await page.getByLabel('Art des WBS').selectOption('WBS 140');
    await page.getByRole('button', { name: 'Inserat veröffentlichen' }).click();

    await expect(page.getByRole('heading', { name: 'Dein Inserat ist online' })).toBeVisible();
    expect(auf.neueAnzeigen).toHaveLength(1);
    expect(auf.neueAnzeigen[0]).toMatchObject({
      titel: 'Helle Wohnung am Park', status: 'aktiv', transaktions_typ: 'mieten',
      adresse: 'Torstraße 1', plz: '10119', ort: 'Berlin', bezirk: 'Mitte',
      preis: 900, nebenkosten: 150, warmmiete: 1050, quadratmeter: 62.5, zimmer: 2,
      energieausweis_art: 'verbrauch', energiekennwert: 95, energieeffizienzklasse: 'C', baujahr: 1910,
      balkon_terrasse: true, aufzug: false, anbieter_typ: 'privat', provision: null,
      wbs_erforderlich: true, wbs_art: 'wbs_140',
    });
    expect(auf.neueAnzeigen[0]).not.toHaveProperty('inserent_id');   // setzt die Datenbank selbst
    expect(NUTZER.id).toBeTruthy();
  });

  test('PDF-Dokumente und Links werden mit dem Inserat gespeichert', async ({ page }) => {
    await anmelden(page);
    const auf = await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('inserieren/');
    await page.getByLabel(/^Titel/).fill('Wohnung mit Grundriss');
    await page.getByPlaceholder('Straße und Hausnummer, Ort').fill('Torstr 1');
    await page.getByRole('button', { name: 'Torstraße 1, 10119 Berlin' }).click();
    await page.getByLabel(/^Kaltmiete/).fill('900');
    await page.getByLabel(/^Wohnfläche/).fill('60');
    await page.getByLabel(/^Zimmer/).fill('2');
    await page.getByRole('button', { name: 'Nicht erforderlich (z.B. Denkmal)' }).click();

    // Keine echte PDF: wird abgelehnt
    await page.getByLabel('Grundriss als PDF hochladen').setInputFiles({ name: 'grundriss.pdf', mimeType: 'application/pdf', buffer: Buffer.from('kein pdf') });
    await expect(page.locator('p[role="alert"]')).toHaveText('grundriss.pdf ist keine PDF-Datei.');
    expect(auf.hochgeladen).toHaveLength(0);

    await page.getByLabel('Grundriss als PDF hochladen').setInputFiles({ name: 'Grundriss EG.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
    await expect(page.getByLabel('Titel von Dokument 1')).toHaveValue('Grundriss EG');
    expect(auf.hochgeladen).toHaveLength(1);
    expect(auf.hochgeladen[0]).toMatch(/^00000000-0000-4000-8000-000000000001\/\d+-[a-z0-9]+\.pdf$/);

    await page.getByRole('button', { name: 'Link hinzufügen' }).click();
    await page.getByLabel('Titel von Link 1').fill('Rundgang');
    await page.getByLabel('Adresse von Link 1').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Inserat veröffentlichen' }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText('Der Link „javascript:alert(1)“ ist keine gültige https-Adresse.');
    expect(auf.neueAnzeigen).toHaveLength(0);

    await page.getByLabel('Adresse von Link 1').fill('example.org/tour');
    await page.getByRole('button', { name: 'Inserat veröffentlichen' }).click();
    await expect(page.getByRole('heading', { name: 'Dein Inserat ist online' })).toBeVisible();
    expect(auf.neueAnzeigen[0]).toMatchObject({
      dokumente: [{ art: 'grundriss', titel: 'Grundriss EG', pfad: auf.hochgeladen[0] }],
      links: [{ titel: 'Rundgang', url: 'https://example.org/tour' }],
    });
  });

  test('beim Verkauf ist die Provision Pflicht', async ({ page }) => {
    await anmelden(page);
    const auf = await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('inserieren/');
    await page.getByRole('button', { name: 'Verkaufen' }).click();
    await page.getByLabel(/^Titel/).fill('Haus zu verkaufen');
    await page.getByPlaceholder('Straße und Hausnummer, Ort').fill('Torstr 1');
    await page.getByRole('button', { name: 'Torstraße 1, 10119 Berlin' }).click();
    await page.getByLabel(/^Kaufpreis/).fill('450000');
    await page.getByLabel(/^Wohnfläche/).fill('120');
    await page.getByLabel(/^Zimmer/).fill('5');
    await page.getByRole('button', { name: 'Inserat veröffentlichen' }).click();
    await expect(page.locator('p[role="alert"]')).toContainText('Provision Pflicht');
    expect(auf.neueAnzeigen).toHaveLength(0);
  });
});
