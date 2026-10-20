import { defineConfig } from 'vitest/config';

// Schnelle Tests ohne Browser für die Logik in lib/ (npm test).
// Die Supabase-Adresse ist ein Platzhalter: Die Tests fangen alle Anfragen selbst ab.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://supabase.test',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-schluessel',
    },
  },
});
