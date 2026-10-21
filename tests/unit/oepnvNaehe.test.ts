import { describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/supabase', () => ({ supabase: {} }));
import { NaherHalt, barrierefreiGesamt, stationenBilden, taktText } from '../../lib/oepnvNaehe';

const u8 = { linie_id: 8, typ: 'ubahn', nummer: 'U8', endpunkte: '', fahrten: 168 };
const m10 = { linie_id: 10, typ: 'tram', nummer: 'M10', endpunkte: '', fahrten: 167 };
const halt = (stop_id: string, name: string, lat: number, entfernung_m: number, teil: Partial<NaherHalt> = {}): NaherHalt =>
  ({ stop_id, name, lat, lon: 13.4, entfernung_m, barrierefrei: null, linien: [u8], ...teil });

describe('taktText', () => {
  it('rundet auf übliche Takte', () => {
    expect(taktText(168)).toBe('alle 5 min');
    expect(taktText(84)).toBe('alle 10 min');
    expect(taktText(55)).toBe('alle 15 min');
    expect(taktText(14)).toBe('alle 60 min');
  });
  it('seltene Linien als Anzahl, ohne Daten nichts', () => {
    expect(taktText(4)).toBe('4× tagsüber');
    expect(taktText(0)).toBeNull();
  });
});

describe('barrierefreiGesamt', () => {
  it('fasst die Bahnsteige zusammen', () => {
    expect(barrierefreiGesamt(['ja', 'ja', null])).toBe('ja');
    expect(barrierefreiGesamt(['nein', null])).toBe('nein');
    expect(barrierefreiGesamt(['ja', 'nein'])).toBe('eingeschraenkt');
    expect(barrierefreiGesamt([null, null])).toBeNull();
  });
});

describe('stationenBilden', () => {
  it('fasst Bahnsteige gleichen Namens zusammen und sortiert nach Entfernung', () => {
    const s = stationenBilden([
      halt('b', 'U Bernauer Str. Bstggl.2', 52.5375, 420, { barrierefrei: 'ja' }),
      halt('a', 'U Bernauer Str. Bstggl.1', 52.5376, 400, { barrierefrei: 'ja' }),
      halt('t', 'U Bernauer Str.', 52.5377, 380, { linien: [m10] }),
      halt('x', 'Wolliner Str.', 52.5400, 200, { linien: [{ ...m10, linie_id: 11, nummer: '247', typ: 'bus', fahrten: 28 }] }),
    ]);
    expect(s.map(x => x.name)).toEqual(['Wolliner Str.', 'U Bernauer Str.']);
    expect(s[1].entfernung_m).toBe(380);
    expect(s[1].linien.map(l => l.nummer)).toEqual(['U8', 'M10']);
    expect(s[1].barrierefrei).toBe('ja');
  });
  it('gleicher Name weit entfernt bleibt getrennt, Halte ohne Linien fallen weg', () => {
    const s = stationenBilden([
      halt('a', 'Bahnhof', 52.50, 100),
      halt('b', 'Bahnhof', 52.51, 900),
      halt('c', 'Ohne', 52.50, 50, { linien: [] }),
      halt('n', 'Nachtbus', 52.50, 60, { linien: [{ ...u8, linie_id: 99, nummer: 'N8', typ: 'bus', fahrten: 0 }] }),
    ]);
    expect(s.map(x => x.name)).toEqual(['Bahnhof', 'Bahnhof']);
  });
});

describe('stationenDerLinien', () => {
  it('nimmt je Linie die nächste Station und dort alle Bahnsteige und Linien', async () => {
    const { supabase } = await import('../../lib/supabase');
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === 'haltestellen_der_linien') {
        return { data: (args.linien_ids as number[])[0] === 8
          ? [{ stop_id: 'w', name: 'U Weit Bstggl.1', lat: 52.60, lon: 13.40 }, { stop_id: 'n', name: 'U Nah Bstggl.1', lat: 52.531, lon: 13.40 }]
          : [], error: null };
      }
      return { data: [
        halt('n', 'U Nah Bstggl.1', 52.531, 5, { barrierefrei: 'ja' }),
        halt('n2', 'U Nah Bstggl.2', 52.5312, 20, { barrierefrei: 'ja' }),
        halt('t', 'U Nah', 52.5311, 10, { linien: [m10] }),
        halt('x', 'Andere Str.', 52.5313, 30, { linien: [m10] }),
      ], error: null };
    });
    (supabase as unknown as { rpc: typeof rpc }).rpc = rpc;
    const { stationenDerLinien } = await import('../../lib/oepnvNaehe');
    const s = await stationenDerLinien(52.53, 13.40, [8]);
    expect(s).toHaveLength(1);
    expect(s[0].name).toBe('U Nah');
    expect(s[0].linien.map(l => l.nummer)).toEqual(['U8', 'M10']);
    expect(s[0].entfernung_m).toBe(111);   // 0,001 Grad Breite zum Inserat
  });
});
