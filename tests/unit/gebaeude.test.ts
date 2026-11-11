import { describe, expect, it } from 'vitest';
import { abstandM, gebaeudeAmPunkt, nachAussen, punktInPolygon } from '../../lib/gebaeude';

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
    expect(gebaeudeAmPunkt(fs, 13.401, 52.5).map(f => f.geometry.coordinates[0][0][0])).toEqual([13.4009]);
  });

  it('nimmt das nächste Gebäude, wenn der Punkt knapp davor auf dem Gehweg liegt', () => {
    const fs = [haus(1, 13.4, 52.5), haus(2, 13.401, 52.5)];
    expect(gebaeudeAmPunkt(fs, 13.4002, 52.5).map(f => f.geometry.coordinates[0][0][0])).toEqual([13.3999]);
  });

  it('gibt nichts zurück, wenn kein Gebäude nah genug ist', () => {
    expect(gebaeudeAmPunkt([haus(1, 13.4, 52.5)], 13.401, 52.5)).toEqual([]);
    expect(gebaeudeAmPunkt([], 13.4, 52.5)).toEqual([]);
  });

  it('nimmt alle Teile am Punkt, aber nie Nachbarn mit derselben Kennung', () => {
    // OpenFreeMap: viele Gebäude teilen sich eine Kennung; nur die Lage zählt
    const fs = [
      haus(7, 13.4, 52.5), haus(7, 13.4, 52.5), haus(7, 13.4003, 52.5), haus(8, 13.4, 52.5, 0.00005, { render_min_height: 10 }),
    ];
    const stuecke = gebaeudeAmPunkt(fs, 13.4, 52.5);
    expect(stuecke).toHaveLength(2);
    expect(stuecke.map(f => f.properties)).toEqual([{}, { render_min_height: 10 }]);
  });

  it('nimmt aus einem zusammengefassten MultiPolygon nur das Haus am Punkt', () => {
    const viertel: GeoJSON.Feature = { type: 'Feature', id: 3, properties: { render_height: 30 }, geometry: {
      type: 'MultiPolygon', coordinates: [[quadrat(13.4, 52.5, 0.0001)], [quadrat(13.401, 52.5, 0.0001)], [quadrat(13.402, 52.5, 0.0001)]],
    } };
    const stuecke = gebaeudeAmPunkt([viertel], 13.401, 52.5);
    expect(stuecke).toHaveLength(1);
    expect(stuecke[0].geometry).toEqual({ type: 'Polygon', coordinates: [quadrat(13.401, 52.5, 0.0001)] });
    expect(stuecke[0].properties).toEqual({ render_height: 30 });
  });

  it('übergeht Punkte und Linien', () => {
    const linie: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[13.4, 52.5], [13.5, 52.5]] } };
    expect(gebaeudeAmPunkt([linie, haus(undefined, 13.4, 52.5)], 13.4, 52.5)).toHaveLength(1);
  });
});

describe('nachAussen', () => {
  const kx = 111320 * Math.cos(52.5 * Math.PI / 180);
  it('schiebt die Wände eines Rechtecks in beiden Umlaufrichtungen um m Meter nach außen', () => {
    const ring = quadrat(13.4, 52.5, 0.0001);
    for (const r of [ring, [...ring].reverse()]) {
      const [neu] = nachAussen([r], 0.5);
      const xs = neu.map(p => p[0]);
      expect((Math.max(...xs) - 13.4001) * kx).toBeCloseTo(0.5, 2);
      expect((13.3999 - Math.min(...xs)) * kx).toBeCloseTo(0.5, 2);
      expect(neu[0]).toEqual(neu[neu.length - 1]);
    }
  });

  it('macht Innenhöfe kleiner und hält L-Formen ohne Spitzen', () => {
    const [, hof] = nachAussen([quadrat(13.4, 52.5, 0.001), quadrat(13.4, 52.5, 0.0003)], 0.5);
    expect((13.4003 - Math.max(...hof.map(p => p[0]))) * kx).toBeCloseTo(0.5, 2);
    const l = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2], [0, 0]].map(([x, y]) => [13.4 + x * 0.0001, 52.5 + y * 0.0001]);
    const [neu] = nachAussen([l], 0.5);
    // Innenecke (1,1) wandert schräg in die Kerbe, jede Ecke höchstens gut 0,7 m
    neu.forEach((p, i) => expect(Math.hypot((p[0] - l[i][0]) * kx, (p[1] - l[i][1]) * 110540)).toBeLessThan(0.75));
    expect(neu[3][0]).toBeGreaterThan(l[3][0]);
    expect(neu[3][1]).toBeGreaterThan(l[3][1]);
  });
});
