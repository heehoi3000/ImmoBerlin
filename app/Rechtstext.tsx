// Gemeinsamer Rahmen für Impressum, Datenschutzerklärung und Nutzungsbedingungen.
import { ReactNode } from 'react';
import { hatPlatzhalter } from '../lib/betreiber';

export function Rechtstext({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <article className="w-full max-w-3xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-6 text-[15px] leading-relaxed text-zinc-700
      [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-zinc-900 [&_h2]:mt-4 [&_h3]:font-bold [&_h3]:text-zinc-900
      [&_a]:text-black [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_section]:flex [&_section]:flex-col [&_section]:gap-2">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{titel}</h1>
      {hatPlatzhalter() && (
        <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3">
          Diese Seite enthält noch Platzhalter. Die Angaben in eckigen Klammern werden vor dem offiziellen Start ersetzt.
        </p>
      )}
      {children}
    </article>
  );
}
