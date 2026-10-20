// Erklärung zur Barrierefreiheit (Informationen nach § 14 und Anlage 3 BFSG, Aufbau angelehnt an die BITV-Mustererklärung).
// Bei neuen Funktionen oder bekannten Einschränkungen anpassen; Prüfung: tests/e2e/barrierefreiheit.spec.ts.
import Link from 'next/link';
import { BETREIBER } from '../../lib/betreiber';
import { Rechtstext } from '../Rechtstext';

export const metadata = { title: 'Barrierefreiheit – IMMOBIL' };

const STAND = '20. Oktober 2026';

export default function Barrierefreiheit() {
  const b = BETREIBER;
  return (
    <Rechtstext titel="Erklärung zur Barrierefreiheit">
      <section>
        <p>
          IMMOBIL soll für alle Menschen gut nutzbar sein, auch mit Bildschirmleser, nur mit der Tastatur, mit Vergrößerung oder auf dem Handy.
          Maßstab sind die Web Content Accessibility Guidelines (WCAG) 2.1 auf Stufe AA, die auch der europäischen Norm EN 301 549 zugrunde liegen.
        </p>
      </section>

      <section>
        <h2>Was IMMOBIL ist</h2>
        <p>
          Auf IMMOBIL suchst du Wohnungen und Häuser zur Miete oder zum Kauf. Du wählst einen Ort, auf Wunsch Bezirke und Bahn-, Tram- oder Buslinien
          und legst fest, wie weit die nächste Haltestelle höchstens entfernt sein darf. Die passenden Angebote erscheinen als Liste und auf einer Karte.
          Mit einem Konto kannst du selbst inserieren und Anfragen von Interessenten lesen.
        </p>
      </section>

      <section>
        <h2>Wie wir Barrierefreiheit umsetzen</h2>
        <ul>
          <li>Alle Funktionen lassen sich mit der Tastatur bedienen. Der erste Tab führt zu „Zum Inhalt springen“, Menüs und Dialoge schließen mit Escape.</li>
          <li>Eingabefelder, Knöpfe und Umschalter haben Namen, die Bildschirmleser vorlesen. Ortsvorschläge wählst du mit den Pfeiltasten.</li>
          <li>Texte haben ausreichenden Kontrast, die Seite lässt sich vergrößern und passt sich schmalen Bildschirmen an.</li>
          <li>Die Zahl der Treffer wird nach jeder Suche angesagt, Fehlermeldungen werden sofort vorgelesen.</li>
          <li>Jede Änderung an der Seite wird automatisch mit dem Prüfwerkzeug axe gegen WCAG 2.1 AA getestet, dazu kommen Tests der Tastaturbedienung.</li>
        </ul>
      </section>

      <section>
        <h2>Stand der Vereinbarkeit</h2>
        <p>Die Website ist weitgehend, aber noch nicht vollständig barrierefrei. Diese Teile sind eingeschränkt:</p>
        <ul>
          <li>
            <strong>Karte:</strong> Die Karte lässt sich nur eingeschränkt mit Tastatur und Bildschirmleser nutzen. Alle Angebote der Karte stehen aber auch in der
            Ergebnisliste daneben, mit Preis, Lage und Entfernung zur nächsten Haltestelle.
          </li>
          <li>
            <strong>Fotos in Inseraten:</strong> Die Fotos laden die Anbieter selbst hoch. Sie haben bisher keine Bildbeschreibung, nur eine Nummerierung.
          </li>
          <li>
            <strong>Inhalte der Inserate:</strong> Texte der Inserate schreiben die Anbieter. Wir können nicht sicherstellen, dass sie verständlich und vollständig sind.
          </li>
          <li>Es gibt noch keine Inhalte in Leichter Sprache oder Gebärdensprache.</li>
        </ul>
      </section>

      <section>
        <h2>Erstellung dieser Erklärung</h2>
        <p>Die Erklärung beruht auf einer Selbstbewertung mit automatischen Tests (axe-core) und einer Prüfung von Hand. Stand: {STAND}.</p>
      </section>

      <section>
        <h2>Barrieren melden</h2>
        <p>
          Wenn dir eine Barriere auffällt oder du Inhalte in einer anderen Form brauchst, schreib uns an <a href={`mailto:${b.email}`}>{b.email}</a> oder
          nutze „Feedback geben“ unten auf jeder Seite. Wir antworten so schnell wie möglich und beheben gemeldete Barrieren vorrangig.
        </p>
      </section>

      <section>
        <h2>Durchsetzung</h2>
        <p>
          Wenn du mit unserer Antwort nicht zufrieden bist, kannst du dich an die Marktüberwachungsstelle der Länder für die Barrierefreiheit von Produkten
          und Dienstleistungen (MLBF) wenden. Weitere Angaben zu uns stehen im <Link href="/impressum/">Impressum</Link>.
        </p>
      </section>
    </Rechtstext>
  );
}
