import { describe, expect, it } from 'vitest';
import { endpunkteKurz, haltestelleKurz, punktAusEwkb } from '../../lib/oepnv';

describe('haltestelleKurz', () => {
  it.each([
    ['U Pankstr. Bstggl.2', 'U Pankstr.'],
    ['S+U Alexanderplatz Bhf (Berlin) Gleis 3', 'S+U Alexanderplatz Bhf (Berlin)'],
    ['Lübbenau, Bahnhof, Mast 3', 'Lübbenau, Bahnhof'],
    ['Hauptbahnhof (Steig B)', 'Hauptbahnhof'],
    ['Rathaus Spandau [Bus]', 'Rathaus Spandau'],
    ['U Bernauer Str.', 'U Bernauer Str.'],
    ['Brunnenstr./Invalidenstr., M8+12 -> Land', 'Brunnenstr./Invalidenstr.'],
    ['Am Steinberg -> Stadt', 'Am Steinberg'],
  ])('%s → %s', (name, erwartet) => {
    expect(haltestelleKurz(name)).toBe(erwartet);
  });

  it('gibt den Namen zurück, wenn nach dem Kürzen nichts übrig bliebe', () => {
    expect(haltestelleKurz('Gleis 1')).toBe('Gleis 1');
  });
});

describe('endpunkteKurz', () => {
  it('kürzt Start und Ziel', () => {
    expect(endpunkteKurz('S+U Wittenau Bstg. 1 – S+U Hermannstr. Bstggl.2')).toBe('S+U Wittenau – S+U Hermannstr.');
  });
});

describe('punktAusEwkb', () => {
  it('liest einen Punkt mit SRID 4326', () => {
    // POINT(13.4 52.5) mit SRID 4326, Little Endian, wie PostgREST ihn liefert
    const hex = '0101000020E61000003333333333CB2A400000000000404A40';
    const p = punktAusEwkb(hex)!;
    expect(p.lon).toBeCloseTo(13.4);
    expect(p.lat).toBeCloseTo(52.5);
  });

  it('gibt null bei leerer oder zu kurzer Eingabe', () => {
    expect(punktAusEwkb(null)).toBeNull();
    expect(punktAusEwkb('0101')).toBeNull();
  });
});
