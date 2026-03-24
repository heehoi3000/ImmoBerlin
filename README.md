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