// Fotos vor dem Hochladen im Browser verkleinern und neu speichern.
// Das Neuzeichnen auf eine Canvas entfernt alle Metadaten (EXIF), insbesondere GPS-Standort und Kameradaten.

const MAX_KANTE = 1920;
const QUALITAET = 0.85;
export const MAX_EINGANG_MB = 25;

export interface FertigesBild { blob: Blob; endung: 'webp' | 'jpg' }

function alsBlob(canvas: HTMLCanvasElement, typ: string): Promise<Blob | null> {
  return new Promise(fertig => canvas.toBlob(fertig, typ, QUALITAET));
}

export async function bildVorbereiten(datei: File): Promise<FertigesBild> {
  // imageOrientation: Handyfotos stehen sonst nach dem Entfernen der EXIF-Drehung auf der Seite
  const bitmap = await createImageBitmap(datei, { imageOrientation: 'from-image' });
  const faktor = Math.min(1, MAX_KANTE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * faktor);
  canvas.height = Math.round(bitmap.height * faktor);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nicht verfügbar');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // WebP ist kleiner; ältere Safari-Versionen liefern dafür PNG zurück, dann JPEG
  const webp = await alsBlob(canvas, 'image/webp');
  if (webp?.type === 'image/webp') return { blob: webp, endung: 'webp' };
  const jpg = await alsBlob(canvas, 'image/jpeg');
  if (!jpg) throw new Error('Bild konnte nicht umgewandelt werden');
  return { blob: jpg, endung: 'jpg' };
}
