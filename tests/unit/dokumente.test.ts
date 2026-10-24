import { describe, expect, it } from 'vitest';
import { dokumenteVon, istPdf, linkPruefen, linksVon } from '../../lib/dokumente';

describe('linkPruefen', () => {
  it('nimmt https-Adressen und ergänzt https://', () => {
    expect(linkPruefen('https://example.org/tour')).toBe('https://example.org/tour');
    expect(linkPruefen(' example.org ')).toBe('https://example.org/');
  });
  it('lehnt andere Protokolle und Unsinn ab', () => {
    for (const s of ['http://example.org', 'javascript:alert(1)', 'data:text/html,x', 'ftp://x.de', 'localhost', '', 'https://']) {
      expect(linkPruefen(s)).toBeNull();
    }
  });
});

describe('Werte aus der Datenbank', () => {
  it('lässt kaputte Einträge weg', () => {
    expect(dokumenteVon(null)).toEqual([]);
    expect(dokumenteVon([{ art: 'grundriss', titel: 'G', pfad: 'a/1-b.pdf' }, { titel: 'ohne Pfad' }])).toHaveLength(1);
    expect(linksVon([{ titel: 'a', url: 'https://example.org/' }, { titel: 'b', url: 'javascript:alert(1)' }])).toEqual([{ titel: 'a', url: 'https://example.org/' }]);
  });
});

describe('istPdf', () => {
  it('erkennt PDFs am Dateianfang', async () => {
    expect(await istPdf(new Blob(['%PDF-1.7 ...']))).toBe(true);
    expect(await istPdf(new Blob(['<html>']))).toBe(false);
  });
});
