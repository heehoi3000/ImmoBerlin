// Datenschutzerklärung nach Art. 13 DSGVO. Bei neuen Diensten oder Formularen hier ergänzen.
import Link from 'next/link';
import { BETREIBER } from '../../lib/betreiber';
import { Rechtstext } from '../Rechtstext';

export const metadata = { title: 'Datenschutz – IMMOBIL' };

export default function Datenschutz() {
  const b = BETREIBER;
  return (
    <Rechtstext titel="Datenschutzerklärung">
      <p className="text-sm text-zinc-500">Stand: {b.stand}</p>

      <section>
        <h2>1. Verantwortlicher</h2>
        <p>{b.name}, {b.strasse}, {b.ort}<br />E-Mail: <a href={`mailto:${b.email}`}>{b.email}</a></p>
        <p>Weitere Angaben findest du im <Link href="/impressum/">Impressum</Link>.</p>
      </section>

      <section>
        <h2>2. Das Wichtigste in Kürze</h2>
        <ul>
          <li>Wir setzen keine Cookies zu Werbe- oder Analysezwecken und nutzen kein Tracking.</li>
          <li>Suchen und Merken funktioniert ohne Konto. Die Merkliste bleibt in deinem Browser.</li>
          <li>Personenbezogene Daten speichern wir nur, wenn du ein Konto anlegst, ein Inserat aufgibst, einen Anbieter kontaktierst oder etwas meldest.</li>
          <li>Wir verkaufen keine Daten.</li>
        </ul>
      </section>

      <section>
        <h2>3. Bereitstellung der Website</h2>
        <p>
          Die Website wird über GitHub Pages bereitgestellt (GitHub B.V., Prins Bernhardplein 200, 1097 JB Amsterdam, Niederlande; Muttergesellschaft GitHub Inc., USA).
          Beim Aufruf verarbeitet GitHub technisch notwendige Daten wie deine IP-Adresse, Datum und Uhrzeit, die aufgerufene Seite und den Browsertyp, um die Seite auszuliefern und vor Angriffen zu schützen.
          Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren und stabilen Website (Art. 6 Abs. 1 lit. f DSGVO).
          Eine Übermittlung in die USA ist durch das EU-US Data Privacy Framework abgesichert, unter dem GitHub zertifiziert ist.
        </p>
        <p>Die Schriftart ist in die Website eingebunden und wird nicht von Google-Servern geladen.</p>
      </section>

      <section>
        <h2>4. Datenbank, Konto und Fotos</h2>
        <p>
          Inserate, Konten, Fotos, Kontaktanfragen und Meldungen speichern wir bei Supabase (Supabase Inc., USA) in einem Rechenzentrum in Irland (EU).
          Mit Supabase besteht ein Vertrag zur Auftragsverarbeitung mit Standardvertragsklauseln der EU-Kommission (Art. 28 und Art. 46 Abs. 2 lit. c DSGVO).
        </p>
        <h3>Konto</h3>
        <p>
          Für ein Konto speichern wir deine E-Mail-Adresse, dein Passwort (nur verschlüsselt als Hash) sowie Zeitpunkte von Registrierung und letzter Anmeldung.
          Wir senden dir E-Mails zur Bestätigung der Adresse und zum Zurücksetzen des Passworts.
          Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO). Die Daten bleiben gespeichert, bis du dein Konto löschen lässt.
        </p>
        <h3>Inserate</h3>
        <p>
          Was du in ein Inserat schreibst, einschließlich Adresse, Fotos und bei gewerblichen Anbietern des Firmennamens, ist für alle Besucher sichtbar.
          Deine E-Mail-Adresse zeigen wir im Inserat nicht an. Ein Inserat bleibt gespeichert, bis du es löschst. Beim Löschen entfernen wir auch die Fotos.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Lade bitte keine Fotos hoch, auf denen Personen erkennbar sind.
        </p>
      </section>

      <section>
        <h2>5. Kontaktanfragen an Anbieter</h2>
        <p>
          Wenn du über „Anbieter kontaktieren“ schreibst, speichern wir deinen Namen, deine E-Mail-Adresse, die Telefonnummer (falls angegeben), deine Nachricht und den Zeitpunkt.
          Diese Angaben sieht nur der Anbieter des Inserats, damit er dir antworten kann, und, wenn du angemeldet bist, du selbst unter „Gesendet“.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Anbahnung eines Miet- oder Kaufvertrags).
          Die Anfrage bleibt gespeichert, bis der Anbieter sie oder das Inserat löscht.
          Was der Anbieter danach mit deinen Angaben macht, liegt in seiner eigenen Verantwortung.
        </p>
      </section>

      <section>
        <h2>6. Meldungen und Feedback</h2>
        <p>
          Bei einer Meldung speichern wir deine Beschreibung, die Art der Meldung, die aufgerufene Seitenadresse, den Browsertyp und, falls angegeben, deine E-Mail-Adresse.
          Bist du angemeldet, ordnen wir die Meldung deinem Konto zu. Wir nutzen die Angaben, um Fehler zu beheben und Hinweise auf rechtswidrige Inserate nach Art. 16 DSA zu bearbeiten.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit Art. 16 DSA sowie unser berechtigtes Interesse an einer fehlerfreien Website (Art. 6 Abs. 1 lit. f DSGVO).
          Erledigte Meldungen löschen wir spätestens nach einem Jahr.
        </p>
      </section>

      <section>
        <h2>7. Karte und Ortssuche</h2>
        <p>
          Damit du die Karte siehst und Orte, Adressen und Bezirke suchen kannst, lädt dein Browser Daten direkt von diesen Diensten. Dabei erhalten sie deine IP-Adresse und den Suchbegriff:
        </p>
        <ul>
          <li>Kartenkacheln: OpenFreeMap (openfreemap.org)</li>
          <li>Orts- und Adresssuche: Photon der komoot GmbH, Potsdam (photon.komoot.io)</li>
          <li>Nur falls eine Gebietsgrenze nicht in unseren eigenen Dateien liegt: Nominatim der OpenStreetMap Foundation (nominatim.openstreetmap.org) und die Overpass API (overpass-api.de)</li>
        </ul>
        <p>Rechtsgrundlage ist unser berechtigtes Interesse an einer funktionierenden Kartensuche (Art. 6 Abs. 1 lit. f DSGVO). Die Dienste speichern nach eigenen Angaben keine Profile über Nutzer.</p>
      </section>

      <section>
        <h2>8. Speicherung in deinem Browser</h2>
        <p>Wir legen keine Cookies an. Im lokalen Speicher deines Browsers liegen nur Daten, die für die von dir genutzten Funktionen nötig sind:</p>
        <ul>
          <li>deine Merkliste (die Kennungen gemerkter Inserate)</li>
          <li>zwischengespeicherte Bezirkslisten und Ortsgrenzen für 7 Tage, damit die Suche schneller lädt</li>
          <li>deine Anmeldung, solange du angemeldet bist</li>
        </ul>
        <p>Das ist nach § 25 Abs. 2 Nr. 2 TDDDG ohne Einwilligung erlaubt. Du kannst die Daten jederzeit in den Einstellungen deines Browsers löschen.</p>
      </section>

      <section>
        <h2>9. Deine Rechte</h2>
        <p>Du hast das Recht auf</p>
        <ul>
          <li>Auskunft über deine gespeicherten Daten (Art. 15 DSGVO)</li>
          <li>Berichtigung (Art. 16 DSGVO) und Löschung (Art. 17 DSGVO)</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO)</li>
        </ul>
        <p>Schreib uns dafür an <a href={`mailto:${b.email}`}>{b.email}</a>.</p>
        <p>Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der für uns zuständigen: {b.aufsicht}.</p>
      </section>

      <section>
        <h2>10. Pflicht zur Angabe</h2>
        <p>Für Suche, Karte und Merkliste musst du keine Daten angeben. Ohne E-Mail-Adresse und Passwort kannst du kein Konto anlegen und ohne Konto keine Inserate aufgeben. Eine automatisierte Entscheidungsfindung oder ein Profiling findet nicht statt.</p>
      </section>
    </Rechtstext>
  );
}
