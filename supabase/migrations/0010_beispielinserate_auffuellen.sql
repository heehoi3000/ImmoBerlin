-- Füllt leere Angaben der Beispielinserate (inserent_id is null) mit stimmigen Zufallswerten, damit die
-- Inseratsseite alle Felder zeigt (Leeroys Wahl, 24.10.2026). Echte Inserate bleiben unberührt. Mehrfach
-- ausführbar: es wird nur gefüllt, was noch leer ist. Auf einer neuen Datenbank ohne Beispielinserate passiert nichts.

-- Miete: Nebenkosten = Warmmiete − Kaltmiete, Kaution 2–3 Kaltmieten (höchstens 3 nach § 551 BGB)
update public.anzeigen
set nebenkosten = coalesce(nebenkosten, case when warmmiete > preis then warmmiete - preis end),
    kaution = coalesce(kaution, preis * (2 + floor(random() * 2)))
where inserent_id is null and transaktions_typ = 'mieten';

-- Kauf: Käuferprovision (üblich 3,57 % inkl. MwSt., teils provisionsfrei)
update public.anzeigen
set provision = (array['3,57 % inkl. MwSt.', '3,57 % inkl. MwSt.', '2,98 % inkl. MwSt.', 'provisionsfrei'])[1 + floor(random() * 4)::int]
where inserent_id is null and transaktions_typ = 'kaufen' and provision is null;

-- Energieausweis: Kennwert passend zur Effizienzklasse (Grenzen nach GEG, kWh/(m²·a))
update public.anzeigen
set energieausweis_art = coalesce(energieausweis_art, case when random() < 0.6 then 'verbrauch' else 'bedarf' end),
    energiekennwert = coalesce(energiekennwert, round((case energieeffizienzklasse
      when 'A+' then 15 + random() * 14  when 'A' then 30 + random() * 19  when 'B' then 50 + random() * 24
      when 'C' then 75 + random() * 24   when 'D' then 100 + random() * 29 when 'E' then 130 + random() * 29
      when 'F' then 160 + random() * 39  when 'G' then 200 + random() * 49 else 251 + random() * 80 end)::numeric)),
    energietraeger = coalesce(energietraeger, case
      when energieeffizienzklasse in ('A+', 'A') then (array['Wärmepumpe', 'Fernwärme', 'Solar'])[1 + floor(random() * 3)::int]
      when energieeffizienzklasse in ('B', 'C', 'D') then (array['Fernwärme', 'Gas', 'Blockheizkraftwerk', 'Holz/Pellets'])[1 + floor(random() * 4)::int]
      else (array['Gas', 'Öl', 'Gas', 'Strom'])[1 + floor(random() * 4)::int] end)
where inserent_id is null and energieeffizienzklasse is not null
  and (energieausweis_art is null or energiekennwert is null or energietraeger is null);

-- Anbieter: etwa 60 % privat, sonst gewerblich mit erkennbar erfundenem Namen
update public.anzeigen
set anbieter_typ = case when random() < 0.6 then 'privat' else 'gewerblich' end
where inserent_id is null and anbieter_typ is null;

update public.anzeigen
set anbieter_name = (array['Beispiel Immobilien GmbH', 'Muster Hausverwaltung', 'Testmakler & Partner', 'Beispiel Wohnbau eG'])[1 + floor(random() * 4)::int]
where inserent_id is null and anbieter_typ = 'gewerblich' and anbieter_name is null;

-- WBS-Art bei Inseraten mit WBS
update public.anzeigen
set wbs_art = (array['wbs', 'wbs_100', 'wbs_140', 'wbs_160', 'wbs_180', 'wbs_220'])[1 + floor(random() * 6)::int]
where inserent_id is null and wbs_erforderlich and wbs_art is null;

-- Beschreibung aus den vorhandenen Angaben
update public.anzeigen
set beschreibung = concat_ws(E'\n\n',
  concat(
    case objektart
      when 'etagenwohnung' then 'Helle Etagenwohnung' when 'dachgeschoss' then 'Gemütliche Dachgeschosswohnung'
      when 'maisonette' then 'Großzügige Maisonette' when 'penthouse' then 'Exklusives Penthouse'
      when 'erdgeschoss' then 'Ruhige Erdgeschosswohnung' when 'souterrain' then 'Souterrainwohnung'
      when 'loft' then 'Offenes Loft' when 'einfamilienhaus' then 'Freistehendes Einfamilienhaus'
      when 'mehrfamilienhaus' then 'Mehrfamilienhaus' when 'reihenhaus' then 'Familienfreundliches Reihenhaus'
      when 'doppelhaushaelfte' then 'Doppelhaushälfte' when 'bungalow' then 'Ebenerdiger Bungalow'
      when 'villa' then 'Elegante Villa' else 'Schönes Zuhause' end,
    ' mit ', replace(rtrim(to_char(zimmer, 'FM990.9'), '.'), '.', ','), ' Zimmern und ', round(quadratmeter), ' m² Wohnfläche',
    case when coalesce(bezirk, ort) is not null then concat(' in ', coalesce(bezirk, ort)) end,
    case when baujahr is not null then concat(', Baujahr ', baujahr) end, '.'),
  'Ausstattung: ' || nullif(concat_ws(', ',
    case when balkon_terrasse then 'Balkon oder Terrasse' end, case when einbaukueche then 'Einbauküche' end,
    case when aufzug then 'Aufzug' end, case when keller then 'Kellerabteil' end, case when garten then 'Garten' end,
    case when stellplatz then 'Stellplatz' end, case when barrierefrei then 'barrierefreier Zugang' end,
    case when moebliert then 'möbliert' end), '') || '.',
  case when haustiere_erlaubt then 'Haustiere sind nach Absprache willkommen.' end,
  'Gute Anbindung an Bus und Bahn, Einkaufsmöglichkeiten in der Nähe. Besichtigung gern nach Vereinbarung.',
  'Hinweis: Dies ist ein Beispielinserat mit erfundenen Angaben.')
where inserent_id is null and beschreibung is null;
