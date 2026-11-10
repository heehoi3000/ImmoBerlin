import { describe, expect, it } from 'vitest';
import { abstandM, gebaeudeAmPunkt, kennungen, punktInPolygon } from '../../lib/gebaeude';

// Quadrat um (lon, lat) mit halber Kantenlänge d Grad
const quadrat = (lon: number, lat: number, d: number) =>
  [[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]];
const haus = (id: number | undefined, lon: number, lat: number, d = 0.0001, props = {}): GeoJSON.Feature => ({
  type: 'Feature', id, properties: props, geometry: { type: 'Polygon', coordinates: [quadrat(lon, lat, d)] },
});

describe('punktInPolygon', () => {
  it('erkennt innen, außen und Löcher', () => {
    const hof = [quadrat(13.4, 52.5, 0.001), quadrat(13.4, 52.5, 0.0003)];
    expect(punktInPolygon(13.4008, 52.5, hof)).toBe(true);
    expect(punktInPolygon(13.4, 52.5, hof)).toBe(false);      // im Innenhof
    expect(punktInPolygon(13.41, 52.5, hof)).toBe(false);
  });
});

describe('abstandM', () => {
  it('misst den Abstand zum Rand in Metern', () => {
    // Rand bei lon 13.4001, Punkt 0.0001 Grad östlich davon: gut 6,8 m in Berlin
    expect(abstandM(13.4002, 52.5, haus(1, 13.4, 52.5))).toBeCloseTo(6.78, 1);
  });
});

describe('gebaeudeAmPunkt', () => {
  it('findet das Gebäude, in dem der Punkt liegt', () => {
    const fs = [haus(1, 13.4, 52.5), haus(2, 13.401, 52.5)];
    expect(gebaeudeAmPunkt(fs, 13.401, 52.5).map(f => f.id)).toEqual([2]);
  });

  it('nimmt das nächste Gebäude, wenn der Punkt knapp davor auf dem Gehweg liegt', () => {
    const fs = [haus(1, 13.4, 52.5), haus(2, 13.401, 52.5)];
    expect(gebaeudeAmPunkt(fs, 13.4002, 52.5).map(f => f.id)).toEqual([1]);
  });

  it('gibt nichts zurück, wenn kein Gebäude nah genug ist', () => {
    expect(gebaeudeAmPunkt([haus(1, 13.4, 52.5)], 13.401, 52.5)).toEqual([]);
    expect(gebaeudeAmPunkt([], 13.4, 52.5)).toEqual([]);
  });

  it('sammelt Stücke desselben Gebäudes aus Nachbarkacheln und alle Gebäudeteile am Punkt', () => {
    const fs = [
      haus(7, 13.4, 52.5), haus(7, 13.4002, 52.5), haus(8, 13.4, 52.5, 0.00005, { render_min_height: 10 }),
      haus(9, 13.403, 52.5),
    ];
    const stuecke = gebaeudeAmPunkt(fs, 13.4, 52.5);
    expect(stuecke.map(f => f.id)).toEqual([7, 8, 7]);
    expect(kennungen(stuecke)).toEqual([7, 8]);
  });

  it('kommt ohne Kennung aus und übergeht Punkte und Linien', () => {
    const linie: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[13.4, 52.5], [13.5, 52.5]] } };
    const stuecke = gebaeudeAmPunkt([linie, haus(undefined, 13.4, 52.5)], 13.4, 52.5);
    expect(stuecke).toHaveLength(1);
    expect(kennungen(stuecke)).toEqual([]);
  });
});
