// Impressum nach § 5 DDG und Kontaktstelle nach Art. 11 und 12 DSA.
import Link from 'next/link';
import { BETREIBER } from '../../lib/betreiber';
import { Rechtstext } from '../Rechtstext';

export const metadata = { title: 'Impressum', alternates: { canonical: './' } };

export default function Impressum() {
  const b = BETREIBER;
  return (
    <Rechtstext titel="Impressum">
      <section>
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>{b.name}<br />{b.strasse}<br />{b.ort}<br />Deutschland</p>
      </section>
      <section>
        <h2>Kontakt</h2>
        <p>E-Mail: <a href={`mailto:${b.email}`}>{b.email}</a>{b.telefon && <><br />Telefon: {b.telefon}</>}</p>
      </section>
      <section>
        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>{b.name}, Anschrift wie oben</p>
      </section>
      <section>
        <h2>Kontaktstelle nach dem Digital Services Act</h2>
        <p>
          Behörden, die EU-Kommission und Nutzer erreichen uns nach Art. 11 und 12 der Verordnung (EU) 2022/2065 unter <a href={`mailto:${b.email}`}>{b.email}</a>.
          Wir kommunizieren auf Deutsch und Englisch. Rechtswidrige Inserate kannst du außerdem direkt auf der Inseratsseite über „Inserat melden“ anzeigen.
        </p>
      </section>
      <section>
        <h2>Inserate</h2>
        <p>
          IMMOBIL ist eine Plattform, auf der Nutzer selbst Inserate veröffentlichen. Für Inhalt und Richtigkeit eines Inserats ist der jeweilige Anbieter verantwortlich.
          Wir prüfen Inserate nicht vorab, nehmen sie aber nach einer begründeten Meldung offline, wenn sie rechtswidrig sind oder gegen unsere <Link href="/nutzungsbedingungen/">Nutzungsbedingungen</Link> verstoßen.
        </p>
      </section>
      <section>
        <h2>Verbraucherstreitbeilegung</h2>
        <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      </section>
      <section id="quellen" className="scroll-mt-24">
        <h2>Datenquellen</h2>
        <ul>
          <li>
            Karten: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-Mitwirkende</a>,
            Kacheln und Kartenstil von <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> auf Grundlage von <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a>.
          </li>
          <li>
            Haltestellen, Linien und Takt: <a href="https://www.delfi.de" target="_blank" rel="noopener">DELFI e.V.</a>,
            Lizenz <a href="https://creativecommons.org/licenses/by/4.0/deed.de" target="_blank" rel="noopener">CC BY 4.0</a>; von uns aufbereitet (Umleitungen und seltene Fahrten herausgefiltert, Bahnsteige zu Stationen zusammengefasst).
          </li>
          <li>
            Barrierefreiheit der Haltestellen, „Einkaufen und Alltag“, „Kinder und Freizeit“, Streckenverlauf der Linien, Orte und Gebietsgrenzen:
            © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-Mitwirkende</a>, Lizenz <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener">ODbL</a>.
          </li>
        </ul>
        <p>
          Diese Daten sind nicht überall vollständig. Barrierefreiheit ist nur angegeben, wo sie in OpenStreetMap eingetragen ist.
          Hausärzte: nur Praxen mit Angabe Allgemeinmedizin, ohne Namen. Schulen: alle Arten, ohne Angabe zu Schulform oder Einzugsgebiet.
        </p>
      </section>
      <p className="text-sm"><Link href="/datenschutz/">Zur Datenschutzerklärung</Link></p>
    </Rechtstext>
  );
}
