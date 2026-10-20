// Nutzungsbedingungen mit den Angaben zur Moderation nach Art. 14 DSA.
// Werden bei der Registrierung akzeptiert; bei Änderungen STAND anpassen und Nutzer informieren.
import Link from 'next/link';
import { BETREIBER } from '../../lib/betreiber';
import { Rechtstext } from '../Rechtstext';

export const metadata = { title: 'Nutzungsbedingungen', alternates: { canonical: './' } };

const STAND = '19. Oktober 2026';

export default function Nutzungsbedingungen() {
  const b = BETREIBER;
  return (
    <Rechtstext titel="Nutzungsbedingungen">
      <p className="text-sm text-zinc-500">Stand: {STAND}</p>

      <section>
        <h2>1. Worum es geht</h2>
        <p>
          IMMOBIL ist eine kostenlose Plattform, auf der man Wohnungen und Häuser zur Miete oder zum Kauf inserieren und finden kann, auch nach der Nähe zu Bus- und Bahnlinien.
          Betreiber ist {b.name}, {b.strasse}, {b.ort} (weitere Angaben im <Link href="/impressum/">Impressum</Link>).
          Diese Bedingungen gelten für alle, die ein Konto anlegen, inserieren oder Anbieter kontaktieren. Suchen und Merken ist ohne Konto möglich.
        </p>
      </section>

      <section>
        <h2>2. Unsere Rolle</h2>
        <ul>
          <li>Wir stellen nur die Plattform bereit. Wir sind kein Makler, vermitteln keine Verträge und werden nicht Partei eines Miet- oder Kaufvertrags.</li>
          <li>Für Inhalt und Richtigkeit eines Inserats ist allein der Anbieter verantwortlich. Wir prüfen Inserate nicht vorab.</li>
          <li>Entfernungen zu Haltestellen berechnen wir als Luftlinie aus öffentlichen Fahrplandaten (DELFI e.V.). Fußwege können länger sein, Linien und Fahrpläne können sich ändern. Für diese Angaben übernehmen wir keine Gewähr.</li>
          <li>Wir bemühen uns um eine ständige Erreichbarkeit, können sie aber nicht garantieren, etwa bei Wartung oder Störungen.</li>
        </ul>
      </section>

      <section>
        <h2>3. Dein Konto</h2>
        <ul>
          <li>Ein Konto darf anlegen, wer mindestens 18 Jahre alt ist. Unternehmen handeln durch eine dazu berechtigte Person.</li>
          <li>Deine Angaben müssen stimmen. Halte dein Passwort geheim und sag uns Bescheid, wenn du einen Missbrauch deines Kontos vermutest.</li>
          <li>Du kannst dein Konto jederzeit unter „Mein Konto“ löschen. Damit endet der Nutzungsvertrag, und wir löschen deine Inserate mit Fotos und die Anfragen, die du bekommen hast.</li>
        </ul>
      </section>

      <section>
        <h2>4. Regeln für Inserate</h2>
        <p>Du darfst nur Objekte inserieren, die du selbst vermieten oder verkaufen darfst oder für die du beauftragt bist. Jedes Inserat muss</p>
        <ul>
          <li>ein tatsächlich verfügbares Objekt beschreiben, mit wahren Angaben zu Lage, Größe, Preis und Ausstattung,</li>
          <li>die gesetzlichen Pflichtangaben enthalten, insbesondere zum Energieausweis (§ 87 GEG), ob du privat oder gewerblich anbietest und bei Kaufobjekten eine Maklerprovision,</li>
          <li>bei Mietwohnungen das Bestellerprinzip beachten: Mieter dürfen nicht zu einer Provision verpflichtet werden, wenn der Vermieter den Makler beauftragt hat (§ 2 Abs. 1a WoVermittG),</li>
          <li>nur Fotos enthalten, an denen du die Rechte hast und auf denen keine Personen erkennbar sind.</li>
        </ul>
        <p>Nicht erlaubt sind insbesondere</p>
        <ul>
          <li>Inhalte, die Menschen wegen ethnischer Herkunft, Geschlecht, Religion, Behinderung, Alter oder sexueller Identität ausschließen oder benachteiligen (Allgemeines Gleichbehandlungsgesetz),</li>
          <li>Fake-Inserate, Lockangebote und Betrugsversuche, zum Beispiel die Forderung nach Vorkasse, Kaution oder Ausweiskopien vor einer Besichtigung,</li>
          <li>mehrfache Inserate für dasselbe Objekt, Werbung für andere Dinge als das Objekt und Inhalte, die gegen Gesetze oder Rechte Dritter verstoßen.</li>
        </ul>
        <p>Um Missbrauch zu verhindern, kann ein Konto höchstens 10 neue Inserate pro Tag aufgeben.</p>
        <p>
          Damit wir dein Inserat zeigen können, räumst du uns ein einfaches, unentgeltliches Recht ein, Texte und Fotos auf IMMOBIL öffentlich zugänglich zu machen und dafür technisch anzupassen, etwa zu verkleinern.
          Das Recht endet, wenn du das Inserat oder dein Konto löschst.
        </p>
      </section>

      <section>
        <h2>5. Anfragen an Anbieter</h2>
        <ul>
          <li>Das Kontaktformular ist nur für Anfragen zum jeweiligen Inserat da. Werbung, Massenanfragen und Belästigung sind nicht erlaubt. Von einem Anschluss aus sind höchstens 10 Anfragen pro Stunde möglich.</li>
          <li>Anbieter dürfen die Kontaktdaten aus einer Anfrage nur nutzen, um auf diese Anfrage zu antworten.</li>
          <li>Tipp zur Sicherheit: Überweise kein Geld, bevor du die Wohnung besichtigt und einen Vertrag gesehen hast. Melde uns verdächtige Inserate.</li>
        </ul>
      </section>

      <section>
        <h2>6. Meldungen und Moderation</h2>
        <p>
          Jeder kann ein Inserat über „Inserat melden“ auf der Inseratsseite melden, auch ohne Konto (Art. 16 DSA).
          Gemeldete Inserate prüft ein Mensch aus unserem Team. Automatisierte Entscheidungen über Inhalte treffen wir nicht.
          Wir verwenden automatische Obergrenzen gegen Spam, wie in Abschnitt 4 und 5 beschrieben.
        </p>
        <p>Verstößt ein Inserat gegen das Gesetz oder diese Bedingungen, können wir</p>
        <ul>
          <li>das Inserat sperren, sodass es nicht mehr öffentlich sichtbar ist,</li>
          <li>bei schweren oder wiederholten Verstößen, etwa Betrug, das Konto sperren oder löschen.</li>
        </ul>
        <p>
          Bei jeder Sperre nennen wir dir den Grund, die Tatsachen, auf die wir uns stützen, und ob es um einen Gesetzesverstoß oder einen Verstoß gegen diese Bedingungen geht (Art. 17 DSA).
          Du siehst die Begründung unter „Meine Inserate“. Dabei achten wir auf die Rechte aller Beteiligten und gehen verhältnismäßig vor.
        </p>
        <p>
          <strong>Einspruch:</strong> Gegen die Sperre eines Inserats kannst du unter „Meine Inserate“ Einspruch einlegen. Wir prüfen ihn erneut durch einen Menschen und schalten das Inserat wieder frei, wenn er berechtigt ist, oder begründen, warum es gesperrt bleibt.
          Gegen andere Entscheidungen schreib uns an <a href={`mailto:${b.email}`}>{b.email}</a>. Der Weg zu den Gerichten bleibt dir in jedem Fall offen.
        </p>
      </section>

      <section>
        <h2>7. Haftung</h2>
        <ul>
          <li>Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit und nach dem Produkthaftungsgesetz.</li>
          <li>Bei leichter Fahrlässigkeit haften wir nur, wenn wir eine wesentliche Pflicht verletzen, auf deren Erfüllung du vertrauen darfst, und dann nur für den typischen, vorhersehbaren Schaden.</li>
          <li>Für Inhalte von Inseraten und für Verträge zwischen Nutzern haften wir nicht. Stellt jemand wegen deines Inserats berechtigte Ansprüche gegen uns, stellst du uns davon frei, wenn du den Verstoß zu vertreten hast.</li>
        </ul>
      </section>

      <section>
        <h2>8. Änderungen</h2>
        <p>
          Wir können diese Bedingungen ändern, etwa bei neuen Funktionen oder neuer Rechtslage. Über Änderungen informieren wir dich mindestens vier Wochen vorher per E-Mail oder beim Anmelden.
          Bist du nicht einverstanden, kannst du dein Konto jederzeit löschen. Nutzt du IMMOBIL nach dem Inkrafttreten weiter, gelten die neuen Bedingungen; darauf weisen wir in der Mitteilung hin.
        </p>
      </section>

      <section>
        <h2>9. Schluss</h2>
        <p>
          Es gilt deutsches Recht. Wenn du Verbraucher bist, behältst du den Schutz der zwingenden Vorschriften des Staates, in dem du lebst.
          Sollte eine Regelung unwirksam sein, bleiben die übrigen wirksam. Wie wir mit deinen Daten umgehen, steht in der <Link href="/datenschutz/">Datenschutzerklärung</Link>.
        </p>
      </section>
    </Rechtstext>
  );
}
