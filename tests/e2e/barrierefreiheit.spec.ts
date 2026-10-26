// Barrierefreiheit (WCAG 2.1 AA, Grundlage von BITV 2.0 und BFSG): automatische Prüfung mit axe-core auf jeder
// Seite und in geöffneten Menüs und Dialogen, dazu Tastaturbedienung. Die Karte selbst ist ausgenommen,
// die Liste daneben zeigt dieselben Angebote.
import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import { STANDARD_DATEN, anmelden, attrappeEinrichten } from './attrappe';

async function pruefen(page: Page) {
  // Übergänge (transition-all an Filterknöpfen) abschalten, sonst misst axe Farben mitten im Wechsel
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
  const ergebnis = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('.leaflet-container')
    .analyze();
  const funde = ergebnis.violations.map(v =>
    `${v.id} (${v.impact}): ${v.help}\n` + v.nodes.slice(0, 5).map(n => `    ${n.target.join(' ')}: ${n.failureSummary?.split('\n')[1] ?? ''}`).join('\n'));
  expect(funde, funde.join('\n')).toEqual([]);
}

const SEITEN: { pfad: string; name: string; login?: boolean }[] = [
  { pfad: '', name: 'Startseite' },
  { pfad: 'suche/', name: 'Suche' },
  { pfad: 'anzeige/?id=a1', name: 'Inserat' },
  { pfad: 'konto/', name: 'Anmelden' },
  { pfad: 'merkliste/', name: 'Merkliste' },
  { pfad: 'impressum/', name: 'Impressum' },
  { pfad: 'datenschutz/', name: 'Datenschutz' },
  { pfad: 'nutzungsbedingungen/', name: 'Nutzungsbedingungen' },
  { pfad: 'barrierefreiheit/', name: 'Erklärung zur Barrierefreiheit' },
  { pfad: 'inserieren/', name: 'Inserieren', login: true },
  { pfad: 'meine-inserate/', name: 'Meine Inserate', login: true },
  { pfad: 'nachrichten/', name: 'Nachrichten', login: true },
];

test.describe('Barrierefreiheit', () => {
  for (const s of SEITEN) {
    test(`Seite: ${s.name}`, async ({ page }) => {
      await attrappeEinrichten(page, STANDARD_DATEN);
      if (s.login) await anmelden(page);
      await page.goto(s.pfad);
      await page.locator('main').first().waitFor();
      await page.waitForTimeout(800);   // Daten aus der Attrappe nachladen lassen
      await pruefen(page);
    });
  }

  test('Suche mit geöffneten Filtern und Vorschlägen', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('suche/');
    await page.getByRole('combobox', { name: 'Ort oder Postleitzahl' }).fill('Berl');
    await expect(page.getByRole('option', { name: 'Berlin', exact: true })).toBeVisible();
    await pruefen(page);
    await page.getByRole('option', { name: 'Berlin', exact: true }).click();

    for (const knopf of ['Bezirke', 'Kaltmiete', 'Zimmer', 'Fläche', 'Weitere Filter']) {
      await page.getByRole('button', { name: knopf }).click();
      await expect(page.locator('#filter-bereich')).toBeVisible();
      await pruefen(page);
    }
    await page.getByRole('button', { name: 'ÖPNV-Linien' }).click();
    await page.getByRole('textbox', { name: 'Linie suchen' }).fill('U8');
    await page.getByRole('button', { name: /^U8/ }).first().click();
    await pruefen(page);
  });

  test('Melden-Dialog', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('impressum/');
    await page.getByRole('button', { name: 'Fehler melden' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await pruefen(page);
  });

  test('Registrieren mit Bot-Schutz, auch nach dem Lösen', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('konto/');
    await page.getByRole('button', { name: 'Registrieren' }).click();
    await expect(page.getByRole('checkbox', { name: 'Ich bin kein Roboter' })).toBeVisible();
    await pruefen(page);
    // per Tastatur lösen
    await page.getByRole('checkbox', { name: 'Ich bin kein Roboter' }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('checkbox', { name: 'Überprüft' })).toBeChecked();
    await pruefen(page);
  });
});

test.describe('Tastatur', () => {
  test('erster Tab führt zu „Zum Inhalt springen“', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('impressum/');
    await page.keyboard.press('Tab');
    const link = page.getByRole('link', { name: 'Zum Inhalt springen' });
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#inhalt')).toBeFocused();
  });

  test('Ort mit Pfeiltasten wählen', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('suche/');
    const feld = page.getByRole('combobox', { name: 'Ort oder Postleitzahl' });
    await feld.fill('Berl');
    await expect(page.getByRole('option', { name: 'Berlin', exact: true })).toBeVisible();
    await feld.press('ArrowDown');
    await expect(page.getByRole('option', { name: 'Berlin', exact: true })).toHaveAttribute('aria-selected', 'true');
    await feld.press('Enter');
    await expect(feld).toHaveValue('Berlin');
  });

  test('Escape schließt Filter und Dialog, der Fokus kehrt zurück', async ({ page }) => {
    await attrappeEinrichten(page, STANDARD_DATEN);
    await page.goto('suche/');
    const zimmer = page.getByRole('button', { name: 'Zimmer' });
    await zimmer.click();
    await page.getByRole('spinbutton', { name: 'Zimmer von' }).focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#filter-bereich')).toBeHidden();
    await expect(zimmer).toBeFocused();

    const melden = page.getByRole('button', { name: 'Fehler melden' }).first();
    await melden.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Fokus steht im Dialog und bleibt dort
    await expect(dialog.locator(':focus')).toHaveCount(1);
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
    await expect(dialog.locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(melden).toBeFocused();
  });
});

test('Barrierefreiheit: Inserat mit eingeschalteten Kategorien der Grundversorgung', async ({ page }) => {
  await attrappeEinrichten(page, STANDARD_DATEN);
  await page.goto('anzeige/?id=a1');
  const bereich = page.getByRole('region', { name: 'Einkaufen und Alltag' });
  await bereich.getByRole('button', { name: /^Supermarkt/ }).click();
  await bereich.getByRole('button', { name: /^Kita/ }).click();
  await expect(page.locator('.ort-symbol')).toHaveCount(3);
  await pruefen(page);
});
