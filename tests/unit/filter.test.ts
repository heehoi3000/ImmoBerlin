import { describe, expect, it } from 'vitest';
import { STANDARD_FILTER, entfernungM, weitereFilterAnzahl } from '../../lib/filter';
import { bezirkeAusdehnung, inBezirken } from '../../lib/bezirke';
import { Bezirk } from '../../lib/filter';

describe('entfernungM', () => {
  it('Alexanderplatz bis Brandenburger Tor sind gut 2 km Luftlinie', () => {
    const m = entfernungM(52.5219, 13.4132, 52.5163, 13.3777);
    expect(m).toBeGreaterThan(2400);
    expect(m).toBeLessThan(2600);
  });

  it('gleicher Punkt ist 0 m', () => {
    expect(entfernungM(52.5, 13.4, 52.5, 13.4)).toBe(0);
  });
});

describe('weitereFilterAnzahl', () => {
  it('zählt nichts bei Standardfiltern', () => {
    expect(weitereFilterAnzahl(STANDARD_FILTER)).toBe(0);
  });

  it('zählt jede Objektart und Ausstattung einzeln, Bereiche einmal', () => {
    expect(weitereFilterAnzahl({
      ...STANDARD_FILTER,
      objektarten: ['loft', 'penthouse'], ausstattung: ['aufzug'],
      baujahrMin: '1990', baujahrMax: '2020', wbs: 'ohne',
    })).toBe(5);
  });
});

// Quadrat 13.0–14.0 / 52.0–53.0 mit Loch 13.4–13.6 / 52.4–52.6
const quadratMitLoch: Bezirk = {
  id: 1, name: 'Test',
  grenze: {
    type: 'Polygon',
    coordinates: [
      [[13, 52], [14, 52], [14, 53], [13, 53], [13, 52]],
      [[13.4, 52.4], [13.6, 52.4], [13.6, 52.6], [13.4, 52.6], [13.4, 52.4]],
    ],
  },
};
const zweitesGebiet: Bezirk = {
  id: 2, name: 'Insel',
  grenze: { type: 'MultiPolygon', coordinates: [[[[15, 54], [15.5, 54], [15.5, 54.5], [15, 54]]]] },
};

describe('inBezirken', () => {
  it('Punkt im Gebiet', () => expect(inBezirken(52.2, 13.2, [quadratMitLoch])).toBe(true));
  it('Punkt außerhalb', () => expect(inBezirken(51.5, 13.2, [quadratMitLoch])).toBe(false));
  it('Punkt im Loch zählt nicht', () => expect(inBezirken(52.5, 13.5, [quadratMitLoch])).toBe(false));
  it('Punkt in einem MultiPolygon', () => expect(inBezirken(54.1, 15.3, [quadratMitLoch, zweitesGebiet])).toBe(true));
  it('Bezirk ohne geladene Grenze zählt nicht', () => expect(inBezirken(52.2, 13.2, [{ id: 3, name: 'leer' }])).toBe(false));
});

describe('bezirkeAusdehnung', () => {
  it('umschließt alle Bezirke', () => {
    expect(bezirkeAusdehnung([quadratMitLoch, zweitesGebiet])).toEqual([13, 52, 15.5, 54.5]);
  });
  it('null ohne Grenzen', () => expect(bezirkeAusdehnung([])).toBeNull());
});
