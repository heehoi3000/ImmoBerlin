import { describe, expect, it } from 'vitest';
import faelle from '../faelle/normalisieren.json';
import { normalisieren } from '../../lib/orte';

// Dieselben Fälle prüft tests/python/test_normalisieren.py für den Index (gebiete_bauen.py)
describe('normalisieren', () => {
  it.each(faelle as [string, string][])('%s → %s', (eingabe, erwartet) => {
    expect(normalisieren(eingabe)).toBe(erwartet);
  });
});
