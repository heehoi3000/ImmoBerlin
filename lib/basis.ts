// Pfad, unter dem die Seite liegt (basePath aus next.config.ts), z. B. '/ImmoBerlin' oder '' auf der eigenen Domain.
// Für Adressen, die Next.js nicht selbst ergänzt: Dateien aus public/, Links in Mails.
export const BASIS = process.env.NEXT_PUBLIC_BASIS_PFAD ?? '/ImmoBerlin';
