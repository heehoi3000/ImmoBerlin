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

  test('unbekanntes Inserat', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('anzeige/?id=gibt-es-nicht');
    await expect(page.getByRole('heading', { name: 'Inserat nicht gefunden' })).toBeVisible();
  });
});
