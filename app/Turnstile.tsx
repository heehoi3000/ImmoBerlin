"use client";
// Spamschutz von Cloudflare Turnstile (prüft meist unsichtbar, ohne Bilderrätsel).
// Ohne NEXT_PUBLIC_TURNSTILE_SITE_KEY wird nichts geladen; Supabase verlangt das Token erst,
// wenn im Dashboard unter Authentication > Attack Protection der CAPTCHA-Schutz an ist.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { TURNSTILE_SITE_KEY } from '../lib/turnstile';

const SKRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render: (el: HTMLElement, opt: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global { interface Window { turnstile?: TurnstileApi } }

let laden: Promise<void> | null = null;
function skriptLaden() {
  laden ??= new Promise((ok, fehler) => {
    const s = document.createElement('script');
    s.src = SKRIPT; s.async = true;
    s.onload = () => ok(); s.onerror = () => { laden = null; fehler(new Error('Turnstile nicht erreichbar')); };
    document.head.appendChild(s);
  });
  return laden;
}

export interface TurnstileGriff { zuruecksetzen: () => void }

// onToken bekommt das Token oder null, wenn es abgelaufen ist
const Turnstile = forwardRef<TurnstileGriff, { onToken: (t: string | null) => void }>(function Turnstile({ onToken }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const rueckruf = useRef(onToken);
  useEffect(() => { rueckruf.current = onToken; }, [onToken]);

  useImperativeHandle(ref, () => ({
    zuruecksetzen: () => { if (widget.current && window.turnstile) { window.turnstile.reset(widget.current); rueckruf.current(null); } },
  }), []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let aktiv = true;
    skriptLaden().then(() => {
      if (!aktiv || !box.current || !window.turnstile) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY, language: 'de', appearance: 'interaction-only',
        callback: (t: string) => rueckruf.current(t),
        'expired-callback': () => rueckruf.current(null),
        'error-callback': () => rueckruf.current(null),
      });
    }).catch(err => console.error(err));
    return () => { aktiv = false; if (widget.current && window.turnstile) window.turnstile.remove(widget.current); widget.current = null; };
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} className="min-h-0" />;
});
export default Turnstile;
