// Öffentlicher Schlüssel für Cloudflare Turnstile (Spamschutz), kommt beim Build aus der Umgebung.
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
