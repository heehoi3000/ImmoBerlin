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

  test('Einkaufen und Alltag mit dem nächsten Ort je Art', async ({ page }) => {
    const auf = await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('anzeige/?id=a1');
    const bereich = page.getByRole('region', { name: 'Einkaufen und Alltag' });
    await expect(bereich.getByRole('definition')).toHaveCount(11);
    await expect(bereich).toContainText('SupermarktRewe, 180 m');
    await expect(bereich).toContainText('ApothekeLinden-Apotheke, 90 m');
    await expect(bereich).toContainText('Drogerienicht im Umkreis von 1,5 km');
    await expect(bereich.getByRole('heading', { name: 'Kinder und Freizeit' })).toBeVisible();
    await expect(bereich).toContainText('KitaKita Sonnenschein, 140 m');
    await expect(bereich).toContainText('Spielplatz60 m');
    await expect(bereich).toContainText('Parknicht im Umkreis von 1,5 km');
    const knopf = bereich.getByRole('button', { name: 'Auf der Karte zeigen' });
    await expect(knopf).toHaveAttribute('aria-pressed', 'false');
    await knopf.click();
    await expect(knopf).toHaveAttribute('aria-pressed', 'true');
    expect(auf.rpc.find(r => r.name === 'grundversorgung_in_der_naehe')?.body).toMatchObject({ p_lat: 52.53, p_lon: 13.40, p_radius_m: 1500 });
  });

  test('unbekanntes Inserat', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('anzeige/?id=gibt-es-nicht');
    await expect(page.getByRole('heading', { name: 'Inserat nicht gefunden' })).toBeVisible();
  });
});
