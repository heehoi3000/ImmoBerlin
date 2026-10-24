// Fotos vor dem Hochladen im Browser verkleinern und neu speichern.
// Das Neuzeichnen auf eine Canvas entfernt alle Metadaten (EXIF), insbesondere GPS-Standort und Kameradaten.

const MAX_KANTE = 1920;
const QUALITAET = 0.85;
export const MAX_EINGANG_MB = 25;

// Kleine Fassung für Ergebnislisten und Vorschaubilder (Kacheln sind höchstens etwa 400 px breit, doppelt für scharfe Bildschirme)
const KLEIN_KANTE = 800;

interface FertigesBild { blob: Blob; klein: Blob; endung: 'webp' | 'jpg' }

function alsBlob(canvas: HTMLCanvasElement, typ: string): Promise<Blob | null> {
  return new Promise(fertig => canvas.toBlob(fertig, typ, QUALITAET));
}

function zeichnen(bitmap: ImageBitmap, maxKante: number): HTMLCanvasElement {
  const faktor = Math.min(1, maxKante / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * faktor);
  canvas.height = Math.round(bitmap.height * faktor);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nicht verfügbar');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function bildVorbereiten(datei: File): Promise<FertigesBild> {
  // imageOrientation: Handyfotos stehen sonst nach dem Entfernen der EXIF-Drehung auf der Seite
  const bitmap = await createImageBitmap(datei, { imageOrientation: 'from-image' });
  const gross = zeichnen(bitmap, MAX_KANTE);
  const kleinCanvas = zeichnen(bitmap, KLEIN_KANTE);
  bitmap.close();

  // WebP ist kleiner; ältere Safari-Versionen liefern dafür PNG zurück, dann JPEG
  const webp = await alsBlob(gross, 'image/webp');
  if (webp?.type === 'image/webp') {
    const klein = await alsBlob(kleinCanvas, 'image/webp');
    if (klein) return { blob: webp, klein, endung: 'webp' };
  }
  const jpg = await alsBlob(gross, 'image/jpeg');
  const klein = await alsBlob(kleinCanvas, 'image/jpeg');
  if (!jpg || !klein) throw new Error('Bild konnte nicht umgewandelt werden');
  return { blob: jpg, klein, endung: 'jpg' };
}
