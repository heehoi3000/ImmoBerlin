import { describe, expect, it } from 'vitest';
import { fotoPfad, fotoUrl } from '../../lib/fotos';

describe('Fotos', () => {
  const alt = 'https://jugqpccbynyzzxvyettv.supabase.co/storage/v1/object/public/inserat-bilder/nutzer/1.webp';

  it('liest aus einer alten vollen Adresse den Pfad im Bucket', () => {
    expect(fotoPfad(alt)).toBe('nutzer/1.webp');
    expect(fotoPfad('nutzer/1.webp')).toBe('nutzer/1.webp');
    expect(fotoPfad('https://example.org/bild.jpg')).toBe('');
  });

  it('baut die Adresse immer zum aktuellen Supabase', () => {
    expect(fotoUrl('nutzer/1.webp')).toBe('http://supabase.test/storage/v1/object/public/inserat-bilder/nutzer/1.webp');
    expect(fotoUrl(alt)).toBe('http://supabase.test/storage/v1/object/public/inserat-bilder/nutzer/1.webp');
  });

  it('lässt fremde Adressen unverändert', () => {
    expect(fotoUrl('https://example.org/bild.jpg')).toBe('https://example.org/bild.jpg');
  });
});
