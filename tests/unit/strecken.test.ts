import { describe, expect, it } from 'vitest';
import { Eintrag, anteilNah, dekodieren, farbeGueltig, gruppenFuer, kandidaten, passtZuHaltestellen, schluessel } from '../../lib/strecken';

describe('schluessel', () => {
  it.each([['S 41', 's41'], ['U8', 'u8'], ['Bus 100', 'bus100'], ['Fähre', 'faehre']])('%s -> %s', (ein, aus) => {
    expect(schluessel(ein)).toBe(aus);
  });
});

describe('gruppenFuer', () => {
  it('U-Bahn sucht auch bei Tram (Stadtbahnen)', () => expect(gruppenFuer('ubahn')).toEqual(['u', 't']));
  it('unbekannter Typ hat keine Gruppe', () => expect(gruppenFuer('seilbahn')).toEqual([]));
});

describe('dekodieren', () => {
  it('liest die Polyline aus strecken_bauen.py', () => {
    const p = dekodieren('_|l_I_expA_|B_|B');
    expect(p).toHaveLength(2);
    expect(p[0][0]).toBeCloseTo(13.4); expect(p[0][1]).toBeCloseTo(52.5);
    expect(p[1][0]).toBeCloseTo(13.42); expect(p[1][1]).toBeCloseTo(52.52);
  });
});

// Ausschnitt aus dem echten Verzeichnis i/u/u8.json: U8 in Frankfurt, Berlin und München
const U8: Eintrag[] = [
  [939116, 'VGF', [8.621, 50.099, 8.687, 50.18]],
  [2679013, 'Berliner Verkehrsbetriebe', [13.325, 52.468, 13.431, 52.596]],
  [2679014, 'Berliner Verkehrsbetriebe', [13.325, 52.467, 13.431, 52.596]],
  [3502707, 'Münchner Verkehrsgesellschaft', [11.556, 48.101, 11.647, 48.179]],
];
const BERLIN_U8 = [
  { lat: 52.5966, lon: 13.3255 }, { lat: 52.5317, lon: 13.4015 }, { lat: 52.5219, lon: 13.4115 }, { lat: 52.4689, lon: 13.4312 },
];

describe('kandidaten', () => {
  it('findet die Berliner U8 an ihren Haltestellen', () => {
    expect(kandidaten(U8, BERLIN_U8, 'BVG').sort()).toEqual([2679013, 2679014]);
  });
  it('nichts, wenn die Haltestellen woanders liegen', () => {
    expect(kandidaten(U8, [{ lat: 53.55, lon: 10.0 }, { lat: 53.56, lon: 10.02 }])).toEqual([]);
  });
  it('ein viel zu großes Rechteck passt nicht', () => {
    const gross: Eintrag[] = [[1, '', [5, 47, 15, 55]]];
    expect(kandidaten(gross, BERLIN_U8)).toEqual([]);
  });
  it('passender Betreiber geht vor', () => {
    const zwei: Eintrag[] = [[1, 'DB Regio', [13.3, 52.4, 13.5, 52.6]], [2, 'S-Bahn Berlin GmbH', [13.3, 52.4, 13.5, 52.6]]];
    expect(kandidaten(zwei, BERLIN_U8, 'S-Bahn Berlin')).toEqual([2]);
  });
});

describe('passtZuHaltestellen', () => {
  const verlauf: [number, number][][] = [[[13.40, 52.50], [13.42, 52.50]]];
  it('Haltestellen am Verlauf', () => {
    expect(passtZuHaltestellen(verlauf, [{ lat: 52.501, lon: 13.405 }, { lat: 52.499, lon: 13.418 }])).toBe(true);
  });
  it('Haltestellen weit weg', () => {
    expect(passtZuHaltestellen(verlauf, [{ lat: 52.52, lon: 13.405 }, { lat: 52.53, lon: 13.418 }])).toBe(false);
  });
});

describe('farbeGueltig', () => {
  it('nimmt echte Linienfarben', () => expect(farbeGueltig('#224F86')).toBe('#224f86'));
  it('verwirft Weiß und Unsinn', () => {
    expect(farbeGueltig('#ffffff')).toBeNull();
    expect(farbeGueltig('')).toBeNull();
    expect(farbeGueltig('rot')).toBeNull();
  });
});

describe('anteilNah', () => {
  it('zählt die Haltestellen am Verlauf', () => {
    const verlauf: [number, number][][] = [[[13.40, 52.50], [13.42, 52.50]]];
    expect(anteilNah(verlauf, [{ lat: 52.501, lon: 13.405 }, { lat: 52.53, lon: 13.418 }])).toBe(0.5);
  });
});
