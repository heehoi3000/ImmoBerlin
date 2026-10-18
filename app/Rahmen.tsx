"use client";
// Kopfzeile, Menü und Fußzeile auf allen Seiten.
import { ReactNode, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useNutzer } from '../lib/konto';
import { useMerkliste } from '../lib/merkliste';
import { useUngelesen } from '../lib/nachrichten';
import { MeldenAnbieter, useMelden } from './Meldedialog';

function Logo() {
  return (
    <Link href="/" className="flex flex-col justify-end leading-none w-max" aria-label="IMMOBIL Startseite">
      <span className="text-[24px] uppercase flex items-baseline tracking-tighter">
        <span className="font-extrabold text-black">IM</span>
        <span className="font-extrabold text-black italic">MO</span>
        <span className="font-light italic text-zinc-400 tracking-normal ml-[1px]">BIL</span>
      </span>
      <span className="flex w-full justify-between text-[8.5px] leading-none font-bold text-zinc-400 uppercase mt-0.5">
        {"Wohnungssuche".split("").map((z, i) => <span key={i}>{z}</span>)}
      </span>
    </Link>
  );
}

const Symbol = {
  menue: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
  herz: (voll: boolean) => <svg width="22" height="22" viewBox="0 0 24 24" fill={voll ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.4 5 7 5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 5.8 3.6 4.5 6.8C19.5 16.4 12 21 12 21z" strokeLinejoin="round" /></svg>,
  person: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
};

function Kopfzeile() {
  const nutzer = useNutzer();
  const { ids } = useMerkliste();
  const ungelesen = useUngelesen(nutzer?.id);
  const melden = useMelden();
  const router = useRouter();
  const pfad = usePathname();
  const [menueOffen, setMenueOffen] = useState(false);
  const [kontoOffen, setKontoOffen] = useState(false);
  const kontoRef = useRef<HTMLDivElement>(null);

  // Menüs beim Seitenwechsel schließen
  useEffect(() => { setMenueOffen(false); setKontoOffen(false); }, [pfad]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => {
    const klick = (e: MouseEvent) => { if (kontoRef.current && !kontoRef.current.contains(e.target as Node)) setKontoOffen(false); };
    document.addEventListener('mousedown', klick);
    return () => document.removeEventListener('mousedown', klick);
  }, []);

  async function abmelden() {
    await supabase.auth.signOut();
    router.push('/');
  }

  const abzeichen = (n: number) => n > 0 && <span className="ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-700 text-white text-[10px] font-bold inline-flex items-center justify-center">{n}</span>;
  const navLink = (href: string, text: string, zahl = 0) => {
    const aktiv = href === '/' ? pfad === '/' : pfad.startsWith(href);
    return <Link href={href} className={`flex items-center px-3 py-2 rounded-lg text-sm font-semibold transition ${aktiv ? 'text-black bg-zinc-100' : 'text-zinc-500 hover:text-black hover:bg-zinc-50'}`}>{text}{abzeichen(zahl)}</Link>;
  };
  const menueEintraege: { href?: string; text: string; aktion?: () => void }[] = [
    { href: '/suche/', text: 'Wohnungen suchen' },
    { href: '/inserieren/', text: 'Inserat aufgeben' },
    { href: '/meine-inserate/', text: 'Meine Inserate' },
    { href: '/nachrichten/', text: `Nachrichten${ungelesen ? ` (${ungelesen} neu)` : ''}` },
    { href: '/merkliste/', text: `Merkliste${ids.length ? ` (${ids.length})` : ''}` },
    { href: '/konto/', text: nutzer ? 'Mein Konto' : 'Anmelden oder registrieren' },
    { text: 'Fehler melden', aktion: () => { setMenueOffen(false); melden({ art: 'fehler' }); } },
  ];

  return (
    <>
    <header className="sticky top-0 z-[1000] bg-white/85 backdrop-blur-md border-b border-zinc-200/70">
      <div className="h-16 px-4 lg:px-6 flex items-center gap-4">
        <button onClick={() => setMenueOffen(true)} aria-label="Menü öffnen" className="md:hidden -ml-1 p-2 rounded-lg text-zinc-700 hover:bg-zinc-100">{Symbol.menue}</button>
        <Logo />
        <nav className="hidden md:flex items-center gap-1 ml-6">
          {navLink('/suche/', 'Suchen')}
          {navLink('/meine-inserate/', 'Meine Inserate')}
          {nutzer && navLink('/nachrichten/', 'Nachrichten', ungelesen)}
          <button onClick={() => melden({ art: 'fehler' })} className="px-3 py-2 rounded-lg text-sm font-semibold text-zinc-500 hover:text-black hover:bg-zinc-50 transition">Fehler melden</button>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link href="/merkliste/" aria-label="Merkliste" className="relative p-2 rounded-full text-zinc-600 hover:text-red-700 hover:bg-zinc-100 transition">
            {Symbol.herz(ids.length > 0)}
            {ids.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-700 text-white text-[10px] font-bold flex items-center justify-center">{ids.length}</span>}
          </Link>

          {nutzer ? (
            <div ref={kontoRef} className="relative">
              <button onClick={() => setKontoOffen(!kontoOffen)} aria-label="Konto" aria-expanded={kontoOffen}
                className="relative w-9 h-9 rounded-full bg-zinc-900 text-white text-sm font-bold flex items-center justify-center hover:ring-4 hover:ring-zinc-200 transition">
                {(nutzer.email ?? '?')[0].toUpperCase()}
                {ungelesen > 0 && <span className="md:hidden absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-700 ring-2 ring-white" />}
              </button>
              {kontoOffen && (
                <div className="absolute right-0 mt-2 w-60 bg-white border border-zinc-200 rounded-xl shadow-xl py-2 text-sm">
                  <p className="px-4 py-2 text-xs text-zinc-500 truncate border-b border-zinc-100 mb-1">{nutzer.email}</p>
                  <Link href="/meine-inserate/" className="block px-4 py-2 hover:bg-zinc-50">Meine Inserate</Link>
                  <Link href="/nachrichten/" className="flex items-center px-4 py-2 hover:bg-zinc-50">Nachrichten{abzeichen(ungelesen)}</Link>
                  <Link href="/konto/" className="block px-4 py-2 hover:bg-zinc-50">Konto</Link>
                  <button onClick={abmelden} className="w-full text-left px-4 py-2 hover:bg-zinc-50 text-red-700">Abmelden</button>
                </div>
              )}
            </div>
          ) : nutzer === null ? (
            <Link href="/konto/" className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-zinc-700 hover:bg-zinc-100 transition">
              {Symbol.person}<span>Anmelden</span>
            </Link>
          ) : null}

          <Link href="/inserieren/" className="flex items-center gap-1.5 h-10 px-4 rounded-full bg-black text-white text-sm font-bold hover:bg-zinc-800 transition shadow-sm">
            {Symbol.plus}<span className="hidden sm:inline">Inserieren</span>
          </Link>
        </div>
      </div>
    </header>

      {/* Menü für schmale Bildschirme, außerhalb der Kopfzeile, weil deren Unschärfe-Effekt "fixed" sonst einsperrt */}
      {menueOffen && (
        <div className="fixed inset-0 z-[1001] md:hidden" onClick={() => setMenueOffen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <nav onClick={(e) => e.stopPropagation()} className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-5 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-4">
              <Logo />
              <button onClick={() => setMenueOffen(false)} aria-label="Menü schließen" className="text-2xl text-zinc-400 hover:text-black">×</button>
            </div>
            {menueEintraege.map(e => e.href
              ? <Link key={e.text} href={e.href} className="px-3 py-3 rounded-lg text-[15px] font-semibold text-zinc-800 hover:bg-zinc-100">{e.text}</Link>
              : <button key={e.text} onClick={e.aktion} className="text-left px-3 py-3 rounded-lg text-[15px] font-semibold text-zinc-800 hover:bg-zinc-100">{e.text}</button>)}
            {nutzer && <button onClick={abmelden} className="text-left px-3 py-3 rounded-lg text-[15px] font-semibold text-red-700 hover:bg-zinc-100 mt-auto">Abmelden</button>}
          </nav>
        </div>
      )}
    </>
  );
}

function Fusszeile() {
  const melden = useMelden();
  return (
    <footer className="border-t border-zinc-200 bg-white mt-12">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row gap-6 md:items-start justify-between text-sm">
        <div className="flex flex-col gap-2 max-w-sm">
          <Logo />
          <p className="text-xs text-zinc-500 mt-2">Wohnungen und Häuser finden, die nah an deiner Bahn, deinem Bus oder deiner Tram liegen. Kostenlos und deutschlandweit.</p>
        </div>
        <div className="flex flex-wrap gap-x-12 gap-y-6">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Angebot</span>
            <Link href="/suche/" className="text-zinc-600 hover:text-black">Suchen</Link>
            <Link href="/inserieren/" className="text-zinc-600 hover:text-black">Inserat aufgeben</Link>
            <Link href="/merkliste/" className="text-zinc-600 hover:text-black">Merkliste</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Hilfe</span>
            <button onClick={() => melden({ art: 'fehler' })} className="text-left text-zinc-600 hover:text-black">Fehler melden</button>
            <button onClick={() => melden({ art: 'sonstiges' })} className="text-left text-zinc-600 hover:text-black">Feedback geben</button>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Rechtliches</span>
            <Link href="/impressum/" className="text-zinc-600 hover:text-black">Impressum</Link>
            <Link href="/datenschutz/" className="text-zinc-600 hover:text-black">Datenschutz</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-zinc-100 py-4 px-4 text-center text-[11px] text-zinc-400">
        Karten © OpenStreetMap-Mitwirkende · Fahrplandaten DELFI e.V., CC BY 4.0
      </div>
    </footer>
  );
}

export default function Rahmen({ children }: { children: ReactNode }) {
  return (
    <MeldenAnbieter>
      <Kopfzeile />
      <main className="flex-grow flex flex-col relative">{children}</main>
      <Fusszeile />
    </MeldenAnbieter>
  );
}
