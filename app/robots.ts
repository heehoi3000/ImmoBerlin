// robots.txt: private Bereiche nicht durchsuchen. Wirkt erst auf der eigenen Domain, weil Suchmaschinen
// robots.txt nur im Hauptverzeichnis der Domain lesen (auf GitHub Pages also nicht unter /ImmoBerlin).
import type { MetadataRoute } from 'next';
import { BASIS } from '../lib/basis';
import { SEITEN_URL } from '../lib/seite';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['konto/', 'meine-inserate/', 'merkliste/', 'nachrichten/', 'moderation/'].map(p => `${BASIS}/${p}`) },
    sitemap: `${SEITEN_URL}/sitemap.xml`,
  };
}
