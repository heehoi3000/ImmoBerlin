-- Aufräumen (Code-Prüfung 24.10.2026). Mehrfach ausführbar.

-- anzeigen.geom ist eine berechnete Spalte (generated always). Der alte Trigger, der sie zusätzlich setzen
-- sollte, hat keine Wirkung: PostgreSQL berechnet die Spalte nach den BEFORE-Triggern neu.
drop trigger if exists anzeigen_geom on public.anzeigen;
drop function if exists public.anzeigen_geom_setzen();

-- Nächster Ort je Art: von der Seite nicht mehr genutzt, seit „Einkaufen und Alltag“ alle Orte im Umkreis
-- zeigt (grundversorgung_im_umkreis, Migration 0008)
drop function if exists public.grundversorgung_in_der_naehe(double precision, double precision, integer);
