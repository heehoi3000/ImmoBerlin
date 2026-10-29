import { describe, expect, it } from 'vitest';
import { flaecheVereinfachen } from '../../lib/linienSuche';

describe('flaecheVereinfachen', () => {
  it('dünnt lange Ringe aus und schließt sie wieder', () => {
    const ring = Array.from({ length: 1000 }, (_, i) => [13 + Math.cos(i / 159) / 10, 52 + Math.sin(i / 159) / 10]);
    ring.push(ring[0]);
    const f = flaecheVereinfachen({ type: 'Polygon', coordinates: [ring, [[13, 52], [13.01, 52], [13, 52.01], [13, 52]]] });
    expect(f.type).toBe('Polygon');
    const aussen = (f.coordinates as number[][][])[0];
    expect(aussen.length).toBeLessThanOrEqual(301);
    expect(aussen[aussen.length - 1]).toEqual(aussen[0]);
    expect(f.coordinates).toHaveLength(1);   // Loch weggelassen
  });

  it('behält bei vielen Teilflächen nur die größten', () => {
    const teil = (n: number) => [Array.from({ length: n }, (_, i) => [i, i % 2]).concat([[0, 0]])];
    const f = flaecheVereinfachen({ type: 'MultiPolygon', coordinates: Array.from({ length: 40 }, (_, i) => teil(4 + i)) });
    expect(f.type).toBe('MultiPolygon');
    expect(f.coordinates).toHaveLength(30);
    expect((f.coordinates as number[][][][])[0][0].length).toBe(44);
  });
});
