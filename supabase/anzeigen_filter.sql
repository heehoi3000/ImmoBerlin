-- Zusätzliche Felder für das vollständige Filtersystem (wie ImmoScout/Immowelt).
-- Einmal im Supabase SQL-Editor ausführen. Bestehende Spalten bleiben unverändert:
-- preis ist weiterhin die Kaltmiete (Miete) bzw. der Kaufpreis (Kauf).

alter table anzeigen
  add column if not exists warmmiete            numeric,      -- nur bei Miete
  add column if not exists objektart            text,         -- Unterart, siehe Check unten
  add column if not exists ort                  text,         -- z. B. Berlin, Potsdam
  add column if not exists plz                  text,
  add column if not exists etage                smallint,     -- 0 = Erdgeschoss, -1 = Souterrain
  add column if not exists baujahr              smallint,
  add column if not exists verfuegbar_ab        date,         -- null = sofort
  add column if not exists energieeffizienzklasse text,       -- A+ bis H
  add column if not exists balkon_terrasse      boolean not null default false,
  add column if not exists aufzug               boolean not null default false,
  add column if not exists einbaukueche         boolean not null default false,
  add column if not exists keller               boolean not null default false,
  add column if not exists garten               boolean not null default false,
  add column if not exists stellplatz           boolean not null default false,
  add column if not exists barrierefrei         boolean not null default false,
  add column if not exists haustiere_erlaubt    boolean not null default false,
  add column if not exists moebliert            boolean not null default false,
  add column if not exists wbs_erforderlich     boolean not null default false,
  add column if not exists erstellt_am          timestamptz not null default now();

alter table anzeigen drop constraint if exists anzeigen_objektart_check;
alter table anzeigen add constraint anzeigen_objektart_check check (objektart is null or objektart in (
  -- Wohnungen
  'etagenwohnung', 'dachgeschoss', 'maisonette', 'penthouse', 'erdgeschoss', 'souterrain', 'loft',
  -- Häuser
  'einfamilienhaus', 'mehrfamilienhaus', 'reihenhaus', 'doppelhaushaelfte', 'bungalow', 'villa'
));

alter table anzeigen drop constraint if exists anzeigen_energieeffizienzklasse_check;
alter table anzeigen add constraint anzeigen_energieeffizienzklasse_check check (
  energieeffizienzklasse is null or energieeffizienzklasse in ('A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'));

-- Indizes für die häufigsten Filter und Sortierungen
create index if not exists anzeigen_typ_idx on anzeigen (transaktions_typ, immobilien_typ);
create index if not exists anzeigen_preis_idx on anzeigen (preis);
create index if not exists anzeigen_erstellt_idx on anzeigen (erstellt_am desc);

-- PostgREST (die Supabase-API) muss das neue Schema neu einlesen
notify pgrst, 'reload schema';
