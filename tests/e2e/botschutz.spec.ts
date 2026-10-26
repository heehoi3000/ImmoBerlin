// Bot-Schutz mit ALTCHA: Das echte Widget löst im Browser eine leichte Aufgabe aus der Attrappe; die Lösung
// muss mit jedem Eintrag mitgehen. Die Prüfung selbst testet tests/schema/altcha.sql in der Datenbank.
import { expect, test } from '@playwright/test';
import { STANDARD_DATEN, attrappeEinrichten } from './attrappe';

function entschluesseln(loesung: string | null | undefined) {
  return JSON.parse(Buffer.from(loesung ?? '', 'base64').toString());
}

test.describe('Bot-Schutz', () => {
  test('Registrierung schickt die Lösung in den Nutzerdaten mit', async ({ page }) => {
    const auf = await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('konto/');
    await page.getByRole('button', { name: 'Registrieren' }).click();
    await page.getByLabel('E-Mail').fill('neu@example.org');
    await page.getByLabel('Passwort').fill('geheim123');
    await page.getByLabel(/Nutzungsbedingungen/).check();
    await page.getByRole('button', { name: 'Konto erstellen' }).click();
    await expect(page.getByText('Fast geschafft')).toBeVisible();
    expect(auf.registrierungen).toHaveLength(1);
    const loesung = entschluesseln((auf.registrierungen[0].data as { altcha?: string }).altcha);
    expect(Number.isInteger(loesung.solution.counter)).toBe(true);
  });

  test('Anmelden zeigt keinen Bot-Schutz', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('konto/');
    await expect(page.getByRole('button', { name: 'Anmelden', exact: true }).last()).toBeVisible();
    await expect(page.locator('altcha-widget')).toHaveCount(0);
  });

  test('Meldung geht mit Lösung im Header raus, jede Lösung nur einmal', async ({ page }) => {
    const auf = await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('impressum/');
    for (const text of ['Erste Meldung zum Test', 'Zweite Meldung zum Test']) {
      await page.getByRole('button', { name: 'Fehler melden' }).first().click();
      await page.getByLabel('Beschreibung').fill(text);
      await page.getByRole('button', { name: 'Meldung senden' }).click();
      await expect(page.getByRole('heading', { name: 'Danke für deine Meldung' })).toBeVisible();
      await page.getByRole('button', { name: 'Schließen' }).last().click();
    }
    const meldungen = auf.botschutz.filter(b => b.pfad === '/rest/v1/meldungen');
    expect(meldungen).toHaveLength(2);
    expect(meldungen[0].loesung).toBeTruthy();
    expect(meldungen[1].loesung).toBeTruthy();
  });
});
