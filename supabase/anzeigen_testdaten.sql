-- Füllt die neuen Felder der vorhandenen Beispielanzeigen mit zufälligen,
-- plausiblen Werten, damit man die Filter ausprobieren kann.
-- Nur für Testdaten gedacht, NICHT auf echte Inserate anwenden.

update anzeigen set
  ort = 'Berlin',
  plz = substring(adresse from '(\d{5})'),
  objektart = case immobilien_typ
    when 'wohnung' then (array['etagenwohnung','etagenwohnung','etagenwohnung','dachgeschoss','maisonette','penthouse','erdgeschoss','loft'])[1 + floor(random() * 8)::int]
    else (array['einfamilienhaus','reihenhaus','doppelhaushaelfte','mehrfamilienhaus','bungalow','villa'])[1 + floor(random() * 6)::int]
  end,
  warmmiete = case when transaktions_typ = 'mieten'
    then round(preis + quadratmeter * (2.5 + random() * 1.5)) end,
  etage = case when immobilien_typ = 'wohnung' then floor(random() * 7)::smallint end,
  baujahr = (array[1890, 1905, 1910, 1928, 1955, 1962, 1975, 1988, 1996, 2005, 2014, 2021, 2024])[1 + floor(random() * 13)::int],
  verfuegbar_ab = case when random() < 0.4 then null else current_date + floor(random() * 120)::int end,
  energieeffizienzklasse = (array['A+','A','B','C','C','D','D','E','F','G','H'])[1 + floor(random() * 11)::int],
  balkon_terrasse   = random() < 0.6,
  aufzug            = immobilien_typ = 'wohnung' and random() < 0.45,
  einbaukueche      = random() < 0.55,
  keller            = random() < 0.6,
  garten            = immobilien_typ = 'haus' or random() < 0.15,
  stellplatz        = random() < 0.35,
  barrierefrei      = random() < 0.15,
  haustiere_erlaubt = random() < 0.4,
  moebliert         = random() < 0.1,
  wbs_erforderlich  = transaktions_typ = 'mieten' and random() < 0.1,
  erstellt_am       = now() - (random() * interval '60 days');
