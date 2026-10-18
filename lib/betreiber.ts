// Angaben zum Betreiber für Impressum und Datenschutzerklärung.
// PLATZHALTER: vor dem Start durch die echten Angaben ersetzen.
export const BETREIBER = {
  name: '[Vorname Nachname]',
  strasse: '[Straße Hausnummer]',
  ort: '[PLZ Ort]',
  email: 'kontakt@example.com',
  telefon: '', // freiwillig, leer lassen blendet die Zeile aus
  // Datenschutz-Aufsichtsbehörde des Bundeslands, in dem der Betreiber wohnt
  aufsicht: '[Landesdatenschutzbehörde, z. B. Berliner Beauftragte für Datenschutz und Informationsfreiheit]',
  stand: '18. Oktober 2026',
};

export const hatPlatzhalter = () => Object.values(BETREIBER).some(w => w.includes('[') || w.includes('example.com'));
