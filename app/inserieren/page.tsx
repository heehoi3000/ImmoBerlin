"use client";
// Inserat aufgeben oder bearbeiten (?id=...). Pflichtangaben nach § 87 GEG (Energieausweis),
// § 5a UWG (privat/gewerblich) und §§ 656c, 656d BGB (Provision bei Kauf) werden abgefragt.
// Tauschinserate (Mieter tauschen ihre Wohnungen) haben statt Energieausweis und Anbieter einen Tauschwunsch.
import { ReactNode, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useNutzer } from '../../lib/konto';
import { Adresse, adressenSuchen } from '../../lib/adresse';
import { AUSSTATTUNG, ENERGIEKLASSEN, OBJEKTARTEN } from '../../lib/filter';
import { MAX_EINGANG_MB, bildVorbereiten } from '../../lib/bilder';
import { FOTO_BUCKET, fotoFallback, fotoUrl, kleinPfad } from '../../lib/fotos';
import { Linie } from '../../lib/oepnv';
import { MAX_WUNSCH_LINIEN, wunschLaden, wunschLinie, wunschLinienAufloesen, wunschLoeschen, wunschSpeichern } from '../../lib/tausch';
import LinienFeld from '../LinienFeld';

const MAX_BILDER = 15;

interface Formular {
  transaktions_typ: 'mieten' | 'kaufen' | 'tauschen';
  immobilien_typ: 'wohnung' | 'haus';
  objektart: string;
  titel: string;
  beschreibung: string;
  preis: string; nebenkosten: string; warmmiete: string; kaution: string; provision: string;
  quadratmeter: string; zimmer: string; etage: string; baujahr: string; verfuegbar_ab: string;
  ausstattung: string[];
  wbs_erforderlich: boolean;
  energieausweis_art: '' | 'verbrauch' | 'bedarf' | 'nicht_erforderlich';
  energiekennwert: string; energietraeger: string; energieeffizienzklasse: string;
  anbieter_typ: 'privat' | 'gewerblich';
  anbieter_name: string;
  bilder: string[];
}

// Tauschwunsch als Eingabefelder
interface Wunsch { linien: Linie[]; umkreis: string; ort: string; maxWarm: string; minZimmer: string; minQm: string }
const LEERER_WUNSCH: Wunsch = { linien: [], umkreis: '600', ort: '', maxWarm: '', minZimmer: '', minQm: '' };

const LEER: Formular = {
  transaktions_typ: 'mieten', immobilien_typ: 'wohnung', objektart: '', titel: '', beschreibung: '',
  preis: '', nebenkosten: '', warmmiete: '', kaution: '', provision: '',
  quadratmeter: '', zimmer: '', etage: '', baujahr: '', verfuegbar_ab: '',
  ausstattung: [], wbs_erforderlich: false,
  energieausweis_art: '', energiekennwert: '', energietraeger: '', energieeffizienzklasse: '',
  anbieter_typ: 'privat', anbieter_name: '', bilder: [],
};

const ENERGIETRAEGER = ['Gas', 'Öl', 'Fernwärme', 'Wärmepumpe', 'Strom', 'Holz/Pellets', 'Solar', 'Blockheizkraftwerk', 'Sonstige'];

const feld = "w-full h-11 border border-zinc-200 rounded-lg px-3 text-sm bg-white focus:ring-2 focus:ring-black/10 focus:border-black outline-none";
const zahl = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : null; };
const text = (n: unknown) => (n === null || n === undefined ? '' : String(n));

function Karte({ titel, beschreibung, children }: { titel: string; beschreibung?: string; children: ReactNode }) {
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5 md:p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-bold">{titel}</h2>
        {beschreibung && <p className="text-xs text-zinc-500 mt-0.5">{beschreibung}</p>}
      </div>
      {children}
    </section>
  );
}

function Feld({ titel, pflicht, hinweis, children, breit }: { titel: string; pflicht?: boolean; hinweis?: string; children: ReactNode; breit?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 ${breit ? 'md:col-span-2' : ''}`}>
      <span className="text-xs font-bold text-zinc-700">{titel}{pflicht && <span className="text-red-600"> *</span>}</span>
      {children}
      {hinweis && <span className="text-[11px] text-zinc-500">{hinweis}</span>}
    </label>
  );
}

function Auswahl<T extends string>({ werte, wert, onChange }: { werte: { wert: T; name: string }[]; wert: T; onChange: (w: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {werte.map(w => (
        <button type="button" key={w.wert} onClick={() => onChange(w.wert)}
          className={`px-3.5 py-2 rounded-full border text-sm font-semibold transition ${wert === w.wert ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-600 hover:border-black'}`}>
          {w.name}
        </button>
      ))}
    </div>
  );
}

export default function Inserieren() {
  const nutzer = useNutzer();
  const [id, setId] = useState<string | null>(null);
  const [f, setF] = useState<Formular>(LEER);
  const [adresse, setAdresse] = useState<Adresse | null>(null);
  const [adressText, setAdressText] = useState('');
  const [vorschlaege, setVorschlaege] = useState<Adresse[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [hochladen, setHochladen] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState<string | null>(null);
  const adressAnfrage = useRef(0);
  const [wunsch, setWunsch] = useState<Wunsch>(LEERER_WUNSCH);
  const [warTausch, setWarTausch] = useState(false);

  const setze = (teil: Partial<Formular>) => setF(alt => ({ ...alt, ...teil }));
  const setzeWunsch = (teil: Partial<Wunsch>) => setWunsch(alt => ({ ...alt, ...teil }));
  const tausch = f.transaktions_typ === 'tauschen';
  const miete = f.transaktions_typ !== 'kaufen';

  // Bearbeiten: vorhandenes Inserat laden
  useEffect(() => {
    const vorhandeneId = new URLSearchParams(window.location.search).get('id');
    if (!vorhandeneId || !nutzer) return;
    setId(vorhandeneId); // eslint-disable-line react-hooks/set-state-in-effect
    supabase.from('anzeigen').select('*').eq('id', vorhandeneId).single().then(({ data, error }) => {
      if (error || !data) { setFehler('Das Inserat wurde nicht gefunden.'); return; }
      setF({
        ...LEER,
        ...Object.fromEntries(Object.keys(LEER).map(k => [k, typeof LEER[k as keyof Formular] === 'string' ? text(data[k]) : data[k] ?? LEER[k as keyof Formular]])),
        ausstattung: AUSSTATTUNG.filter(a => data[a.wert]).map(a => a.wert),
      } as Formular);
      if (data.transaktions_typ === 'tauschen') {
        setWarTausch(true);
        wunschLaden(vorhandeneId).then(async w => {
          if (!w) return;
          setWunsch({ linien: await wunschLinienAufloesen(w.linien), umkreis: String(w.umkreis_m), ort: w.ort ?? '',
            maxWarm: text(w.max_warmmiete), minZimmer: text(w.min_zimmer), minQm: text(w.min_qm) });
        }).catch(err => console.error('Tauschwunsch:', err));
      }
      setAdresse({ text: [data.adresse, [data.plz, data.ort].filter(Boolean).join(' ')].filter(Boolean).join(', '), strasse: data.adresse ?? '', plz: data.plz ?? '', ort: data.ort ?? '', bezirk: data.bezirk ?? '', lat: data.koordinate_lat, lon: data.koordinate_lon });
    });
  }, [nutzer]);

  // Adressvorschläge erst ab drei Zeichen
  useEffect(() => {
    const suchtext = adressText.trim();
    if (suchtext.length < 3 || suchtext === adresse?.text) return;
    const nr = ++adressAnfrage.current;
    const timer = setTimeout(() => {
      adressenSuchen(suchtext)
        .then(liste => { if (nr === adressAnfrage.current) setVorschlaege(liste); })
        .catch(err => console.error("Adresssuche fehlgeschlagen:", err));
    }, 300);
    return () => clearTimeout(timer);
  }, [adressText, adresse]);

  async function bilderHochladen(dateien: FileList | null) {
    if (!dateien || !nutzer) return;
    const auswahl = Array.from(dateien).slice(0, MAX_BILDER - f.bilder.length);
    setFehler(null);
    for (const datei of auswahl) {
      if (datei.size > MAX_EINGANG_MB * 1024 * 1024) { setFehler(`${datei.name} ist größer als ${MAX_EINGANG_MB} MB.`); continue; }
      setHochladen(n => n + 1);
      let bild;
      try { bild = await bildVorbereiten(datei); }
      catch (err) { console.error(err); setHochladen(n => n - 1); setFehler(`${datei.name} konnte nicht gelesen werden. Erlaubt sind JPG, PNG und WebP.`); continue; }
      const pfad = `${nutzer.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${bild.endung}`;
      const speicher = supabase.storage.from(FOTO_BUCKET);
      const [gross, klein] = await Promise.all([
        speicher.upload(pfad, bild.blob, { contentType: bild.blob.type }),
        speicher.upload(kleinPfad(pfad), bild.klein, { contentType: bild.klein.type }),
      ]);
      const error = gross.error ?? klein.error;
      setHochladen(n => n - 1);
      if (error) { console.error(error); setFehler(`${datei.name} konnte nicht hochgeladen werden. Bitte versuche es noch einmal.`); continue; }
      setF(alt => ({ ...alt, bilder: [...alt.bilder, pfad] }));
    }
  }

  function pruefen(): string | null {
    if (!adresse) return 'Bitte wähle die Adresse aus den Vorschlägen aus, damit wir die Lage auf der Karte kennen.';
    if (!zahl(f.preis)) return miete ? 'Bitte gib die Kaltmiete an.' : 'Bitte gib den Kaufpreis an.';
    if (!miete && !f.provision.trim()) return 'Bei Kaufobjekten ist die Angabe zur Provision Pflicht (auch „provisionsfrei“).';
    if (tausch) return wunsch.linien.length || wunsch.ort.trim() ? null : 'Bitte gib bei deinem Tauschwunsch an, wo du hinziehen möchtest: eine Linie oder einen Ort.';
    if (!f.energieausweis_art) return 'Bitte mache die Angaben zum Energieausweis.';
    if (f.energieausweis_art !== 'nicht_erforderlich' && (!zahl(f.energiekennwert) || !f.energietraeger || !f.energieeffizienzklasse || !zahl(f.baujahr)))
      return 'Für den Energieausweis brauchen wir Energiekennwert, Energieträger, Effizienzklasse und Baujahr.';
    if (f.anbieter_typ === 'gewerblich' && !f.anbieter_name.trim()) return 'Gewerbliche Anbieter müssen ihren Firmennamen angeben.';
    return null;
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    const problem = pruefen();
    if (problem) { setFehler(problem); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setLaedt(true); setFehler(null);
    const zeile = {
      transaktions_typ: f.transaktions_typ, immobilien_typ: f.immobilien_typ, objektart: f.objektart || null,
      titel: f.titel.trim(), beschreibung: f.beschreibung.trim() || null,
      adresse: adresse!.strasse, plz: adresse!.plz || null, ort: adresse!.ort || null, bezirk: adresse!.bezirk || null,
      koordinate_lat: adresse!.lat, koordinate_lon: adresse!.lon,
      preis: zahl(f.preis), nebenkosten: miete ? zahl(f.nebenkosten) : null,
      warmmiete: miete ? (zahl(f.warmmiete) ?? ((zahl(f.preis) ?? 0) + (zahl(f.nebenkosten) ?? 0) || null)) : null,
      kaution: miete && !tausch ? zahl(f.kaution) : null, provision: miete ? null : f.provision.trim(),
      quadratmeter: zahl(f.quadratmeter), zimmer: zahl(f.zimmer),
      etage: f.immobilien_typ === 'wohnung' ? zahl(f.etage) : null, baujahr: zahl(f.baujahr),
      verfuegbar_ab: f.verfuegbar_ab || null,
      ...Object.fromEntries(AUSSTATTUNG.map(a => [a.wert, f.ausstattung.includes(a.wert)])),
      wbs_erforderlich: miete && f.wbs_erforderlich,
      // Beim Tausch inseriert der Mieter: kein Energieausweis (Pflicht des Vermieters), immer privat
      energieausweis_art: tausch ? null : f.energieausweis_art,
      energiekennwert: tausch || f.energieausweis_art === 'nicht_erforderlich' ? null : zahl(f.energiekennwert),
      energietraeger: tausch || f.energieausweis_art === 'nicht_erforderlich' ? null : f.energietraeger,
      energieeffizienzklasse: tausch || f.energieausweis_art === 'nicht_erforderlich' ? null : f.energieeffizienzklasse,
      anbieter_typ: tausch ? 'privat' : f.anbieter_typ, anbieter_name: !tausch && f.anbieter_typ === 'gewerblich' ? f.anbieter_name.trim() : null,
      bilder: f.bilder,
    };
    const { data, error } = id
      ? await supabase.from('anzeigen').update(zeile).eq('id', id).select('id').single()
      : await supabase.from('anzeigen').insert({ ...zeile, status: 'aktiv' }).select('id').single();
    if (error) {
      setLaedt(false);
      console.error(error);
      setFehler(error.message.includes('Zu viele') ? 'Du hast heute schon 10 Inserate aufgegeben. Weitere sind ab morgen möglich.' : 'Das Inserat konnte nicht gespeichert werden. Bitte prüfe deine Angaben und versuche es noch einmal.');
      return;
    }
    try {
      if (tausch) {
        await wunschSpeichern(data.id, {
          linien: wunsch.linien.map(wunschLinie), umkreis_m: parseInt(wunsch.umkreis) || 600, ort: wunsch.ort.trim() || null,
          max_warmmiete: zahl(wunsch.maxWarm), min_zimmer: zahl(wunsch.minZimmer), min_qm: zahl(wunsch.minQm),
        });
      } else if (warTausch) await wunschLoeschen(data.id);
    } catch (err) {
      console.error(err);
      setLaedt(false);
      if (!id) setId(data.id);
      setFehler('Das Inserat ist gespeichert, der Tauschwunsch aber nicht. Bitte speichere noch einmal.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setLaedt(false);
    setGespeichert(data.id);
    window.scrollTo({ top: 0 });
  }

  if (nutzer === undefined) return <div className="p-10 text-center text-sm text-zinc-500">Wird geladen…</div>;
  if (nutzer === null) {
    return (
      <div className="flex-1 flex items-start justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-8 text-center flex flex-col gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Kostenlos inserieren</h1>
          <p className="text-sm text-zinc-600">Melde dich an oder erstelle ein Konto, um deine Wohnung oder dein Haus zu inserieren. Das dauert keine Minute.</p>
          <Link href="/konto/?weiter=/inserieren/" className="h-11 rounded-lg bg-black text-white text-sm font-bold flex items-center justify-center hover:bg-zinc-800">Anmelden oder registrieren</Link>
        </div>
      </div>
    );
  }
  if (gespeichert) {
    return (
      <div className="flex-1 flex items-start justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-8 text-center flex flex-col gap-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-2xl">✓</div>
          <h1 className="text-2xl font-bold tracking-tight">{id ? 'Änderungen gespeichert' : 'Dein Inserat ist online'}</h1>
          <div className="grid grid-cols-2 gap-3">
            <Link href={`/anzeige/?id=${gespeichert}`} className="h-11 rounded-lg border border-zinc-200 text-sm font-bold flex items-center justify-center hover:border-black">Ansehen</Link>
            <Link href="/meine-inserate/" className="h-11 rounded-lg bg-black text-white text-sm font-bold flex items-center justify-center hover:bg-zinc-800">Meine Inserate</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={speichern} className="w-full max-w-3xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{id ? 'Inserat bearbeiten' : 'Inserat aufgeben'}</h1>
        <p className="text-sm text-zinc-500 mt-1">Kostenlos. Felder mit <span className="text-red-600">*</span> sind Pflicht.</p>
      </div>
      {fehler && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{fehler}</p>}

      <Karte titel="Was bietest du an?">
        <div className="flex flex-wrap gap-6">
          <Auswahl werte={[{ wert: 'mieten', name: 'Vermieten' }, { wert: 'kaufen', name: 'Verkaufen' }, { wert: 'tauschen', name: 'Tauschen' }]} wert={f.transaktions_typ} onChange={(w) => setze({ transaktions_typ: w })} />
          <Auswahl werte={[{ wert: 'wohnung', name: 'Wohnung' }, { wert: 'haus', name: 'Haus' }]} wert={f.immobilien_typ} onChange={(w) => setze({ immobilien_typ: w, objektart: '' })} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Feld titel="Objektart">
            <select value={f.objektart} onChange={(e) => setze({ objektart: e.target.value })} className={feld}>
              <option value="">Bitte wählen</option>
              {OBJEKTARTEN[f.immobilien_typ].map(o => <option key={o.wert} value={o.wert}>{o.name}</option>)}
            </select>
          </Feld>
          <Feld titel="Verfügbar ab" hinweis="Leer lassen, wenn sofort frei">
            <input type="date" value={f.verfuegbar_ab} onChange={(e) => setze({ verfuegbar_ab: e.target.value })} className={feld} />
          </Feld>
          <Feld titel="Titel" pflicht breit>
            <input required maxLength={120} value={f.titel} onChange={(e) => setze({ titel: e.target.value })} placeholder="z.B. Helle 2-Zimmer-Wohnung mit Balkon nahe U2" className={feld} />
          </Feld>
          <Feld titel="Beschreibung" breit hinweis="Bitte keine Telefonnummern oder diskriminierenden Formulierungen (AGG).">
            <textarea rows={6} maxLength={5000} value={f.beschreibung} onChange={(e) => setze({ beschreibung: e.target.value })}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-black/10 focus:border-black outline-none resize-y" />
          </Feld>
        </div>
      </Karte>

      <Karte titel="Lage" beschreibung="Die Adresse bestimmt den Punkt auf der Karte und die Entfernung zu Bus und Bahn.">
        <Feld titel="Adresse" pflicht>
          <div className="relative">
            <input value={adressText || adresse?.text || ''} onChange={(e) => { setAdressText(e.target.value); setAdresse(null); }}
              placeholder="Straße und Hausnummer, Ort" autoComplete="off" className={feld} />
            {!adresse && adressText.trim().length >= 3 && vorschlaege.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg z-30 overflow-hidden">
                {vorschlaege.map((v, i) => (
                  <button type="button" key={`${v.text}-${i}`} onClick={() => { setAdresse(v); setAdressText(''); setVorschlaege([]); }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-100">{v.text}</button>
                ))}
              </div>
            )}
          </div>
        </Feld>
        {adresse && <p className="text-xs text-green-700">Lage gefunden: {adresse.text}{adresse.bezirk ? ` (${adresse.bezirk})` : ''}</p>}
      </Karte>

      {tausch && (
        <Karte titel="Dein Tauschwunsch" beschreibung="Danach suchen wir passende Tauschpartner. Leere Felder schränken nicht ein.">
          <div className="text-xs text-zinc-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex flex-col gap-1">
            <p>Ein Tausch klappt nur, wenn beide Vermieter zustimmen. Sprich vorher mit deinem Vermieter.</p>
            <p>Geld nur dafür zu verlangen, dass du ausziehst, ist unwirksam (§ 4a Wohnungsvermittlungsgesetz). Möbel oder Einbauten darfst du zu einem angemessenen Preis verkaufen.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-zinc-700">An welcher Linie möchtest du wohnen?</span>
            <div className="border border-zinc-200 rounded-lg px-3 focus-within:border-black">
              <LinienFeld bezug={adresse} ausgewaehlt={wunsch.linien} umkreis={wunsch.umkreis} onUmkreis={(u) => setzeWunsch({ umkreis: u })}
                onChange={(l) => setzeWunsch({ linien: l.slice(0, MAX_WUNSCH_LINIEN) })} />
            </div>
            <span className="text-[11px] text-zinc-500">Bis zu {MAX_WUNSCH_LINIEN} Linien. Die Auswahl rechts legt fest, wie weit die Haltestelle höchstens entfernt sein darf.</span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Feld titel="Ort" hinweis="z.B. Berlin; leer lassen, wenn nur die Linie zählt">
              <input maxLength={100} value={wunsch.ort} onChange={(e) => setzeWunsch({ ort: e.target.value })} className={feld} />
            </Feld>
            <Feld titel="Warmmiete höchstens (€)"><input inputMode="decimal" value={wunsch.maxWarm} onChange={(e) => setzeWunsch({ maxWarm: e.target.value })} className={feld} /></Feld>
            <Feld titel="Zimmer mindestens"><input inputMode="decimal" value={wunsch.minZimmer} onChange={(e) => setzeWunsch({ minZimmer: e.target.value })} className={feld} /></Feld>
            <Feld titel="Wohnfläche mindestens (m²)"><input inputMode="decimal" value={wunsch.minQm} onChange={(e) => setzeWunsch({ minQm: e.target.value })} className={feld} /></Feld>
          </div>
        </Karte>
      )}

      <Karte titel={tausch ? 'Deine Miete' : miete ? 'Miete' : 'Preis'}>
        <div className="grid md:grid-cols-2 gap-4">
          <Feld titel={miete ? 'Kaltmiete (€ pro Monat)' : 'Kaufpreis (€)'} pflicht>
            <input inputMode="decimal" required value={f.preis} onChange={(e) => setze({ preis: e.target.value })} className={feld} />
          </Feld>
          {miete ? (
            <>
              <Feld titel="Nebenkosten (€ pro Monat)"><input inputMode="decimal" value={f.nebenkosten} onChange={(e) => setze({ nebenkosten: e.target.value })} className={feld} /></Feld>
              <Feld titel="Warmmiete (€ pro Monat)" hinweis="Leer lassen, dann rechnen wir Kaltmiete plus Nebenkosten"><input inputMode="decimal" value={f.warmmiete} onChange={(e) => setze({ warmmiete: e.target.value })} className={feld} /></Feld>
              {!tausch && <Feld titel="Kaution (€)"><input inputMode="decimal" value={f.kaution} onChange={(e) => setze({ kaution: e.target.value })} className={feld} /></Feld>}
            </>
          ) : (
            <Feld titel="Käuferprovision" pflicht hinweis="In Prozent inkl. MwSt., z.B. „3,57 % inkl. MwSt.“, oder „provisionsfrei“">
              <input maxLength={200} value={f.provision} onChange={(e) => setze({ provision: e.target.value })} className={feld} />
            </Feld>
          )}
        </div>
        {miete && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.wbs_erforderlich} onChange={(e) => setze({ wbs_erforderlich: e.target.checked })} className="w-4 h-4 accent-black" />
            Wohnberechtigungsschein (WBS) erforderlich
          </label>
        )}
      </Karte>

      <Karte titel="Eckdaten">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Feld titel="Wohnfläche (m²)" pflicht><input inputMode="decimal" required value={f.quadratmeter} onChange={(e) => setze({ quadratmeter: e.target.value })} className={feld} /></Feld>
          <Feld titel="Zimmer" pflicht><input inputMode="decimal" required value={f.zimmer} onChange={(e) => setze({ zimmer: e.target.value })} className={feld} /></Feld>
          {f.immobilien_typ === 'wohnung' && <Feld titel="Etage" hinweis="0 = Erdgeschoss"><input inputMode="numeric" value={f.etage} onChange={(e) => setze({ etage: e.target.value })} className={feld} /></Feld>}
          <Feld titel="Baujahr" pflicht={!tausch && f.energieausweis_art !== 'nicht_erforderlich'}><input inputMode="numeric" value={f.baujahr} onChange={(e) => setze({ baujahr: e.target.value })} className={feld} /></Feld>
        </div>
        <div>
          <span className="text-xs font-bold text-zinc-700">Ausstattung</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {AUSSTATTUNG.map(a => {
              const an = f.ausstattung.includes(a.wert);
              return (
                <button type="button" key={a.wert} onClick={() => setze({ ausstattung: an ? f.ausstattung.filter(x => x !== a.wert) : [...f.ausstattung, a.wert] })}
                  className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${an ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-600 hover:border-black'}`}>
                  {a.name}
                </button>
              );
            })}
          </div>
        </div>
      </Karte>

      {!tausch && <Karte titel="Energieausweis" beschreibung="Pflichtangaben nach § 87 Gebäudeenergiegesetz.">
        <Auswahl werte={[{ wert: 'verbrauch', name: 'Verbrauchsausweis' }, { wert: 'bedarf', name: 'Bedarfsausweis' }, { wert: 'nicht_erforderlich', name: 'Nicht erforderlich (z.B. Denkmal)' }]}
          wert={f.energieausweis_art as 'verbrauch'} onChange={(w) => setze({ energieausweis_art: w })} />
        {f.energieausweis_art && f.energieausweis_art !== 'nicht_erforderlich' && (
          <div className="grid md:grid-cols-3 gap-4">
            <Feld titel="Energiekennwert (kWh/m²·a)" pflicht><input inputMode="decimal" value={f.energiekennwert} onChange={(e) => setze({ energiekennwert: e.target.value })} className={feld} /></Feld>
            <Feld titel="Wesentlicher Energieträger" pflicht>
              <select value={f.energietraeger} onChange={(e) => setze({ energietraeger: e.target.value })} className={feld}>
                <option value="">Bitte wählen</option>
                {ENERGIETRAEGER.map(t => <option key={t}>{t}</option>)}
              </select>
            </Feld>
            <Feld titel="Effizienzklasse" pflicht>
              <select value={f.energieeffizienzklasse} onChange={(e) => setze({ energieeffizienzklasse: e.target.value })} className={feld}>
                <option value="">Bitte wählen</option>
                {ENERGIEKLASSEN.map(k => <option key={k}>{k}</option>)}
              </select>
            </Feld>
          </div>
        )}
      </Karte>}

      <Karte titel="Fotos" beschreibung={`Bis zu ${MAX_BILDER} Bilder, je höchstens ${MAX_EINGANG_MB} MB (JPG, PNG, WebP). Wir verkleinern sie und entfernen versteckte Angaben wie den Aufnahmeort. Das erste Bild ist das Titelbild.`}>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {f.bilder.map((url, i) => (
            <div key={url} className="relative aspect-[4/3] rounded-lg overflow-hidden bg-zinc-100 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotoUrl(url, 'klein')} onError={fotoFallback(url)} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">Titelbild</span>}
              <button type="button" onClick={() => setze({ bilder: f.bilder.filter(b => b !== url) })} aria-label="Foto entfernen"
                className="absolute right-1 top-1 w-6 h-6 rounded-full bg-white/90 text-black text-sm font-bold shadow">×</button>
              {i > 0 && (
                <button type="button" onClick={() => setze({ bilder: [url, ...f.bilder.filter(b => b !== url)] })}
                  className="absolute left-1 bottom-1 bg-white/90 text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100">Als Titelbild</button>
              )}
            </div>
          ))}
          {f.bilder.length < MAX_BILDER && (
            <label className="aspect-[4/3] rounded-lg border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center text-xs font-semibold text-zinc-500 cursor-pointer hover:border-black hover:text-black transition">
              <span className="text-2xl leading-none">+</span>
              {hochladen > 0 ? 'Lädt hoch…' : 'Fotos hinzufügen'}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { bilderHochladen(e.target.files); e.target.value = ''; }} />
            </label>
          )}
        </div>
        <p className="text-[11px] text-zinc-500">Lade nur Fotos hoch, an denen du die Rechte hast.</p>
      </Karte>

      {!tausch && <Karte titel="Anbieter" beschreibung="Gewerbliche Anbieter wie Makler oder Hausverwaltungen werden im Inserat gekennzeichnet.">
        <Auswahl werte={[{ wert: 'privat', name: 'Privat' }, { wert: 'gewerblich', name: 'Gewerblich' }]} wert={f.anbieter_typ} onChange={(w) => setze({ anbieter_typ: w })} />
        {f.anbieter_typ === 'gewerblich' && (
          <Feld titel="Firmenname" pflicht><input maxLength={200} value={f.anbieter_name} onChange={(e) => setze({ anbieter_name: e.target.value })} className={feld} /></Feld>
        )}
      </Karte>}

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-zinc-50/90 backdrop-blur border-t border-zinc-200 flex items-center justify-end gap-3">
        <Link href="/meine-inserate/" className="h-11 px-4 rounded-lg text-sm font-semibold text-zinc-600 hover:bg-zinc-100 flex items-center">Abbrechen</Link>
        <p className="text-[11px] text-zinc-500">Mit dem Veröffentlichen bestätigst du, dass dein Inserat unseren <Link href="/nutzungsbedingungen/" target="_blank" className="underline underline-offset-2">Nutzungsbedingungen</Link> entspricht.</p>
        <button type="submit" disabled={laedt || hochladen > 0} className="h-11 px-6 rounded-lg bg-black text-white text-sm font-bold hover:bg-zinc-800 disabled:opacity-50">
          {laedt ? 'Wird gespeichert…' : id ? 'Änderungen speichern' : 'Inserat veröffentlichen'}
        </button>
      </div>
    </form>
  );
}
