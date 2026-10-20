# ImmoBerlin – Wohnungssuche 

Dieses Projekt ist eine moderne Web-Anwendung zur interaktiven Wohnungssuche in Berlin. Der Fokus liegt auf der Verknüpfung von Immobilienstandorten mit der Berliner ÖPNV-Infrastruktur.

## Features
- **Interaktive Map:** Visualisierung von Immobilien und Bezirken in Echtzeit.
- **Dynamische ÖPNV-Filter:** Die verfügbaren Strecken (S-Bahn, U-Bahn, Bus, Tram) werden dynamisch aus einer Supabase-Datenbank geladen.
- **Modernes UI:** Ein fixierter Header, eine einklappbare Sidebar und ein "Floating Map"-Layout für maximale Übersicht.
- **Bezirks-Filter:** Schnelle Auswahlmöglichkeit Berliner Bezirke über ein optimiertes Grid-Layout.
- **Responsive Suche:** Automatische Schließung der Filtermenüs nach dem Suchvorgang für besseren Fokus auf die Karte.

## Tech-Stack
- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Sprache:** TypeScript
- **Styling:** Tailwind CSS
- **Datenbank:** [Supabase](https://supabase.com/) (PostgreSQL)
- **Komponenten:** React Hooks (useState, useEffect), Dynamic Imports für Maps.

## Live-Demo
Die Anwendung wird über eine CI/CD-Pipeline (GitHub Actions) automatisch bereitgestellt und ist live abrufbar unter:
**[https://heehoi3000.github.io/ImmoBerlin/](https://heehoi3000.github.io/ImmoBerlin/)**

---

## Installation & Setup

Um die Anwendung lokal auf Ihrem Rechner zu starten (z.B. für die Code-Bewertung), folgen Sie bitte diesen Schritten:

### 1. Abhängigkeiten installieren
Öffnen Sie das Terminal im Hauptverzeichnis des Projekts und führen Sie folgenden Befehl aus, um alle benötigten Bibliotheken herunterzuladen:
```bash
npm install

## Tests

Bei jedem Push startet der Ablauf `.github/workflows/tests.yml` alle Tests. Lokal:

```bash
npm test                 # Logik in lib/ (Vitest)
npm run test:python      # ÖPNV-Export und Ortsnamen (braucht shapely)
# Browser-Tests: erst einen Testbuild ohne echte Datenbank, dann Playwright
NEXT_PUBLIC_SUPABASE_URL=http://supabase.test NEXT_PUBLIC_SUPABASE_ANON_KEY=test-schluessel npm run build
npx playwright install chromium
npm run test:e2e
```

Die Browser-Tests ersetzen Supabase, Karte und Geocoder im Browser (`tests/e2e/attrappe.ts`), sie schreiben nie in die echte Datenbank.
