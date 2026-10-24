import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import { NUTZER, STANDARD_DATEN, anmelden, anzeige, attrappeEinrichten } from './attrappe';

// Eigenes Tauschinserat t1 (2 Zimmer) und zwei fremde: t2 passt gegenseitig, t3 nur zum eigenen Wunsch
const TAUSCH = {
  ...STANDARD_DATEN,
  anzeigen: [
    ...STANDARD_DATEN.anzeigen,
    anzeige('t1', { titel: 'Meine 2 Zimmer in Mitte', transaktions_typ: 'tauschen', inserent_id: NUTZER.id }),
    anzeige('t2', { titel: '3 Zimmer an der S41', transaktions_typ: 'tauschen', zimmer: 3, warmmiete: 1100 }),
    anzeige('t3', { titel: 'Großer Altbau zum Tausch', transaktions_typ: 'tauschen', zimmer: 4, warmmiete: 1150 }),
  ],
  tauschWuensche: [{ anzeige_id: 't1', linien: [{ typ: 'sbahn', nummer: 'S41', betreiber: 'S-Bahn Berlin' }], umkreis_m: 600,
    ort: 'Berlin', max_warmmiete: 1200, min_zimmer: 3, min_qm: null }],
  tauschPartner: [{ id: 't2', gegenseitig: true }, { id: 't3', gegenseitig: false }],
};

// Barrierefreiheit wie in barrierefreiheit.spec.ts (WCAG 2.1 AA, ohne Karte)
async function pruefen(page: Page) {
  const ergebnis = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.leaflet-container').analyze();
  expect(ergebnis.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test.describe('Tauschwohnungen', () => {
  test('Tauschinserat mit Wunsch aufgeben, ohne Energieausweis und Anbieter', async ({ page }) => {
    await anmelden(page);
    const auf = await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('inserieren/');
    await page.getByRole('button', { name: 'Tauschen' }).click();
    await expect(page.getByRole('heading', { name: 'Energieausweis' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Anbieter' })).toHaveCount(0);
    await expect(page.getByText('beide Vermieter zustimmen')).toBeVisible();
    await pruefen(page);

    await page.getByLabel(/^Titel/).fill('2 Zimmer gegen 3 Zimmer');
    await page.getByPlaceholder('Straße und Hausnummer, Ort').fill('Torstr 1');
    await page.getByRole('button', { name: 'Torstraße 1, 10119 Berlin' }).click();
    await page.getByLabel(/^Kaltmiete/).fill('600');
    await page.getByLabel(/^Nebenkosten/).fill('150');
    await page.getByLabel(/^Wohnfläche \(m²\)/).fill('55');
    await page.getByLabel(/^Zimmer \*/).fill('2');

    // Ohne Ort oder Linie im Wunsch nicht speichern
    await page.getByRole('button', { name: 'Inserat veröffentlichen' }).click();
    await expect(page.locator('p[role="alert"]')).toContainText('eine Linie oder einen Ort');

    await page.getByRole('combobox', { name: 'ÖPNV-Linie' }).fill('U8');
    await page.getByRole('option', { name: /U8/ }).first().click();
    await page.getByLabel('Maximale Entfernung zur Haltestelle').selectOption('1000');
    await page.getByLabel(/^Zimmer mindestens/).fill('3');
    await page.getByLabel(/^Warmmiete höchstens/).fill('1100');
    // Wunschort: beim Tippen kommen Vorschläge, Enter übernimmt den ersten, ohne das Formular abzuschicken
    const wunschOrt = page.getByPlaceholder('Ort, Bezirk oder PLZ');
    await wunschOrt.fill('be');
    await expect(page.getByRole('option', { name: 'Berlin' })).toBeVisible();
    await wunschOrt.press('Enter');
    await expect(wunschOrt).toHaveValue('Berlin');
    await expect(page.getByRole('heading', { name: 'Dein Inserat ist online' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Inserat veröffentlichen' }).click();

    await expect(page.getByRole('heading', { name: 'Dein Inserat ist online' })).toBeVisible();
    expect(auf.neueAnzeigen[0]).toMatchObject({ transaktions_typ: 'tauschen', energieausweis_art: null, anbieter_typ: 'privat', kaution: null, warmmiete: 750 });
    expect(auf.wuensche).toHaveLength(1);
    expect(auf.wuensche[0]).toMatchObject({
      anzeige_id: 'neu-1', umkreis_m: 1000, ort: 'Berlin', max_warmmiete: 1100, min_zimmer: 3, min_qm: null,
      linien: [{ typ: 'ubahn', nummer: 'U8', betreiber: 'BVG' }],
    });
  });

  test('eigenes Tauschinserat zeigt Wunsch und passende Tauschpartner', async ({ page }) => {
    await anmelden(page);
    const auf = await attrappeEinrichten(page, TAUSCH);
    await page.goto('anzeige/?id=t1');
    const wunsch = page.getByRole('region', { name: 'Dein Tauschwunsch' });
    await expect(wunsch).toContainText('An S41, höchstens 600 m bis zur Haltestelle');
    await expect(wunsch).toContainText('Mindestens 3 Zimmer');
    await expect(wunsch).toContainText('Höchstens 1.200 € warm');
    const partner = page.getByRole('region', { name: 'Passende Tauschpartner' });
    await expect(partner).toContainText('2 passend, davon 1 gegenseitig');
    const eintraege = partner.getByRole('listitem');
    await expect(eintraege.nth(0)).toContainText('Passt gegenseitig');
    await expect(eintraege.nth(0)).toContainText('3 Zimmer an der S41');
    await expect(eintraege.nth(1)).toContainText('Passt zu deinem Wunsch');
    expect(auf.rpc.find(r => r.name === 'tausch_partner')?.body).toEqual({ p_anzeige: 't1' });
    await pruefen(page);
  });

  test('fremdes Tauschinserat zeigt den Wunsch, aber keine Partner', async ({ page }) => {
    await attrappeEinrichten(page, { ...TAUSCH, tauschWuensche: [{ ...TAUSCH.tauschWuensche[0], anzeige_id: 't2' }] });
    await page.goto('anzeige/?id=t2');
    await expect(page.getByRole('region', { name: 'Gesucht im Tausch' })).toContainText('Mindestens 3 Zimmer');
    await expect(page.getByRole('region', { name: 'Passende Tauschpartner' })).toHaveCount(0);
  });

  test('Suche nach Tauschwohnungen zeigt nur Tauschinserate', async ({ page }) => {
    await attrappeEinrichten(page, TAUSCH);
    await page.goto('suche/');
    await expect(page.getByText('3 Wohnungen zur Miete')).toBeVisible();
    await page.getByRole('button', { name: 'Tauschen' }).first().click();
    await page.getByRole('button', { name: 'Suchen' }).click();
    await expect(page.getByText('3 Wohnungen zum Tausch')).toBeVisible();
    await expect(page.getByRole('link', { name: /Großer Altbau zum Tausch/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Altbau an der U8/ })).toHaveCount(0);
  });
});
