# Datenbank

- `migrations/` – der Aufbau der Datenbank zum Einspielen in ein neues Supabase (z. B. selbst gehostet auf Hetzner),
  in der Reihenfolge der Nummern:
  - `0001_ausgangsstand.sql` erzeugt der Workflow **Datenbank-Aufbau sichern** (`.github/workflows/schema.yml`)
    aus der laufenden Datenbank: Tabellen, Funktionen, Rechte, Regeln (RLS), Trigger, Foto-Bucket, Rollen-Einstellungen.
    Keine Daten. Nicht von Hand ändern, sondern den Workflow neu starten.
  - `0002_fotos_als_pfad.sql` wandelt alte volle Foto-Adressen in Pfade um (am Umzugstag nach dem Daten-Import).
  - Neue Änderungen kommen als `0003_….sql` usw. dazu.
- `oepnv_laden.sql` – lädt die ÖPNV-Daten (Workflow `oepnv.yml`).
- `functions/` – Edge Functions (`konto-loeschen`).
- `verlauf/` – die SQL-Dateien, mit denen die Datenbank Schritt für Schritt entstanden ist. Nur zum Nachlesen;
  ihr Stand steckt vollständig in `migrations/0001_ausgangsstand.sql`.

Einspielen in ein leeres Supabase (als Rolle `postgres`):

```sh
for f in supabase/migrations/*.sql; do psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
psql "$DB_URL" -v ON_ERROR_STOP=1 -f tests/schema/pruefen.sql   # prüft Vollständigkeit und Rechte
```

Der Test-Workflow (`tests.yml`, Job „Datenbank-Aufbau“) macht genau das bei jedem Push mit dem Docker-Image
`supabase/postgres`; `tests/schema/dienste_attrappe.sql` ersetzt dort die Tabellen der Dienste Auth und Storage.
