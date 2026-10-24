import { expect, test } from '@playwright/test';
import { STANDARD_DATEN, anzeige, attrappeEinrichten } from './attrappe';

test.describe('Inserat ansehen und Anbieter kontaktieren', () => {
  test('Anfrage landet mit allen Angaben in den Nachrichten', async ({ page }) => {
    const auf = await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('anzeige/?id=a1');
    await expect(page.getByRole('heading', { name: 'Altbau an der U8' })).toBeVisible();
    await expect(page).toHaveTitle('Altbau an der U8 – IMMOBIL');

    await page.getByLabel('Name').fill('Erika Muster');
    await page.getByLabel('E-Mail').fill('erika@example.org');
    await page.getByRole('button', { name: 'Anfrage senden' }).click();

    await expect(page.getByText('Anfrage gesendet')).toBeVisible();
    expect(auf.nachrichten).toHaveLength(1);
    expect(auf.nachrichten[0]).toMatchObject({ anzeige_id: 'a1', name: 'Erika Muster', email: 'erika@example.org', telefon: null });
    expect(String(auf.nachrichten[0].nachricht)).toContain('Altbau an der U8');
  });

  test('ausgefülltes Spam-Feld sendet nichts', async ({ page }) => {
    const auf = await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('anzeige/?id=a1');
    await page.getByLabel('Name').fill('Bot');
    await page.getByLabel('E-Mail').fill('bot@example.org');
    await page.locator('input[name="website"]').fill('http://spam.example');
    await page.getByRole('button', { name: 'Anfrage senden' }).click();
    await expect(page.getByText('Anfrage gesendet')).toBeVisible();
    expect(auf.nachrichten).toHaveLength(0);
  });

  test('Beispielinserate ohne Inserent sind nicht kontaktierbar', async ({ page }) => {
    await attrappeEinrichten(page, { ...STANDARD_DATEN, anzeigen: [anzeige('b1', { titel: 'Beispiel', inserent_id: null })] });
    await page.goto('anzeige/?id=b1');
    await expect(page.getByText('Das ist ein Beispielinserat.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anfrage senden' })).toHaveCount(0);
  });

  test('ÖPNV in der Nähe mit Takt und Barrierefreiheit', async ({ page }) => {
    const auf = await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('anzeige/?id=a1');
    const bereich = page.getByRole('region', { name: 'ÖPNV in der Nähe' });
    const stationen = bereich.getByRole('listitem');
    await expect(stationen).toHaveCount(3);
    // nächste zuerst und vorausgewählt; Nachtbus N8 fehlt
    await expect(stationen.nth(0)).toContainText('Wolliner Str.');
    await expect(stationen.nth(0)).toContainText('alle 30 min');
    await expect(stationen.nth(0)).not.toContainText('N8');
    await expect(stationen.nth(0)).toContainText('Nicht barrierefrei');
    await expect(stationen.nth(0).getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    await expect(stationen.nth(1)).toContainText('Barrierefreiheit: keine Angabe');
    // beide U8-Bahnsteige sind eine Station
    await expect(stationen.nth(2)).toContainText('U Bernauer Str.');
    await expect(stationen.nth(2)).toContainText('alle 5 min');
    await expect(stationen.nth(2)).toContainText('Barrierefrei');
    await stationen.nth(2).getByRole('button').click();
    await expect(stationen.nth(2).getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    expect(auf.rpc.find(r => r.name === 'haltestellen_in_der_naehe')?.body).toMatchObject({ p_lat: 52.53, p_lon: 13.40 });
  });

  test('nach dem Linienfilter nur die nächste Haltestelle dieser Linie', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('suche/');
    await page.getByRole('button', { name: 'ÖPNV-Linien' }).click();
    await page.getByRole('textbox', { name: 'Linie suchen' }).fill('U8');
    await page.getByRole('button', { name: /^U8/ }).first().click();
    await page.getByRole('button', { name: 'Ergebnisse anzeigen' }).click();
    await expect(page.getByText('2 Wohnungen zur Miete')).toBeVisible();
    await page.getByRole('link', { name: /Altbau an der U8/ }).click();
    await expect(page).toHaveURL(/anzeige\/\?id=a1&linien=8$/);

    const bereich = page.getByRole('region', { name: 'ÖPNV in der Nähe' });
    const stationen = bereich.getByRole('listitem');
    await expect(stationen).toHaveCount(1);
    await expect(stationen.first()).toContainText('U Bernauer Str.');
    await expect(stationen.first()).toContainText('(deine gewählte Linie)');
    await expect(bereich).toContainText('Nächste Haltestelle deiner gewählten Linie');
  });

  test('Einkaufen und Alltag: Knopf je Kategorie blendet alle Orte auf der Karte ein', async ({ page }) => {
    const auf = await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('anzeige/?id=a1');
    const bereich = page.getByRole('region', { name: 'Einkaufen und Alltag' });
    await expect(bereich.getByRole('listitem')).toHaveCount(10);
    await expect(bereich.getByRole('heading', { name: 'Kinder und Freizeit' })).toBeVisible();
    const supermarkt = bereich.getByRole('button', { name: /^Supermarkt/ });
    // Knöpfe zeigen nur die Kategorie, keinen nächsten Ort
    await expect(supermarkt).toHaveText('Supermarkt');
    await expect(bereich).not.toContainText('Rewe');
    // ohne Ort im Umkreis kein Umschalten
    await expect(bereich.getByRole('button', { name: /^Drogerie/ })).toBeDisabled();
    await expect(bereich.getByRole('button', { name: /^Drogerie\s*, nicht im Umkreis von 500 m$/ })).toBeVisible();

    const karte = page.getByRole('region', { name: /^Karte/ });
    await expect(karte.locator('.ort-symbol')).toHaveCount(0);
    await expect(supermarkt).toHaveAttribute('aria-pressed', 'false');
    await supermarkt.click();
    await expect(supermarkt).toHaveAttribute('aria-pressed', 'true');
    // alle Supermärkte im Umkreis, mit Namen (Tooltip öffnet beim Überfahren und per Tastatur; focus statt hover,
    // weil die Karte beim Einpassen noch springt und die Maus dann auf den Knöpfen darüber landen kann)
    await expect(karte.locator('.ort-symbol')).toHaveCount(2);
    await karte.getByRole('button', { name: 'Supermarkt: Lidl · 420 m' }).focus();
    await expect(karte.locator('.leaflet-tooltip', { hasText: 'Lidl · 420 m' })).toBeVisible();
    await bereich.getByRole('button', { name: /^Park/ }).click();
    await expect(karte.locator('.ort-symbol')).toHaveCount(3);
    // Beschriftung bleibt beim richtigen Symbol, auch wenn sich die Reihenfolge ändert
    await expect(karte.getByRole('button', { name: 'Supermarkt: Rewe · 180 m' })).toHaveCount(1);
    await expect(karte.getByRole('button', { name: 'Park: Weinbergspark · 60 m' })).toHaveCount(1);
    await supermarkt.click();
    await expect(karte.locator('.ort-symbol')).toHaveCount(1);
    expect(auf.rpc.find(r => r.name === 'grundversorgung_im_umkreis')?.body).toMatchObject({ p_lat: 52.53, p_lon: 13.40, p_radius_m: 500 });
  });

  test('ÖPNV lässt sich ein- und ausklappen, Einkaufen und Alltag ist immer offen', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('anzeige/?id=a1');
    const oepnv = page.getByRole('region', { name: 'ÖPNV in der Nähe' });
    const oepnvKnopf = oepnv.getByRole('button', { name: 'ÖPNV in der Nähe' });
    await expect(oepnvKnopf).toHaveAttribute('aria-expanded', 'true');
    await expect(oepnv.getByRole('list')).toBeVisible();
    await oepnvKnopf.click();
    await expect(oepnvKnopf).toHaveAttribute('aria-expanded', 'false');
    await expect(oepnv.getByRole('list')).toHaveCount(0);
    // nichts wird gemerkt: jedes Inserat startet wieder ausgeklappt
    await page.reload();
    await expect(oepnvKnopf).toHaveAttribute('aria-expanded', 'true');

    const alltag = page.getByRole('region', { name: 'Einkaufen und Alltag' });
    await expect(alltag.getByRole('button', { name: 'Einkaufen und Alltag' })).toHaveCount(0);
    await expect(alltag.getByRole('button', { name: /^Supermarkt/ })).toBeVisible();
  });

  test('Route planen öffnet Google Maps ab der Wohnung mit ÖPNV, Auto oder zu Fuß', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('anzeige/?id=a1');
    const bereich = page.getByRole('region', { name: 'Route planen' });
    await bereich.getByRole('textbox', { name: 'Ziel' }).fill('Alexanderplatz, Berlin');
    for (const [name, modus] of [['ÖPNV', 'transit'], ['Auto', 'driving'], ['Zu Fuß', 'walking']]) {
      const link = bereich.getByRole('link', { name: new RegExp(`^${name}`) });
      const url = new URL(await link.getAttribute('href') ?? '');
      expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
      expect(Object.fromEntries(url.searchParams)).toEqual({ api: '1', origin: '52.53,13.4', travelmode: modus, destination: 'Alexanderplatz, Berlin' });
      await expect(link).toHaveAttribute('target', '_blank');
    }
  });

  test('unbekanntes Inserat', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('anzeige/?id=gibt-es-nicht');
    await expect(page.getByRole('heading', { name: 'Inserat nicht gefunden' })).toBeVisible();
  });
});
