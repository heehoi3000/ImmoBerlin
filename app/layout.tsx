import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ImmoBerlin - Wohnungssuche",
  description: "Finde deine Traumwohnung in Berlin basierend auf ÖPNV-Anbindung und Bezirksfiltern.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${openSans.className} antialiased min-h-screen flex flex-col bg-zinc-50`}>
        
        {/* --- KOPFZEILE START --- */}
        <header className="sticky top-0 flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200 z-50 shadow-sm">
          
          {/* Linker Teil: Menü & Logo */}
          <div className="flex items-center gap-5">
            
            {/* Menü-Button (Am unteren Rand ausgerichtet) */}
            <button className="flex flex-col items-center justify-end pb-1.5 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded-lg transition cursor-pointer h-12 w-12">
              <svg className="mb-1" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
              <span className="text-[9px] leading-none font-bold uppercase tracking-widest text-zinc-900">Menü</span>
            </button>
            
            {/* Logo (Ebenfalls am unteren Rand ausgerichtet) */}
            <div className="flex flex-col justify-end pb-1.5 h-12 leading-none">
              <h1 className="text-[26px] font-extrabold text-black tracking-tighter uppercase mb-1">
                Immo<span className="font-light text-zinc-400">Berlin</span>
              </h1>
              <span className="text-[9px] leading-none font-bold text-zinc-400 uppercase tracking-[0.3em] ml-0.5">
                Wohnungssuche
              </span>
            </div>
            
          </div>

          {/* Rechter Teil: Aktionen */}
          <div className="flex items-center gap-3">
            <button className="hover:bg-zinc-100 p-2.5 rounded-full transition mr-4 flex items-center justify-center cursor-pointer">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#990000">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>
            
            <button className="px-5 py-2.5 font-semibold text-zinc-600 hover:text-black hover:bg-zinc-100 rounded-lg transition cursor-pointer">
              Login
            </button>
            
            <button className="px-5 py-2.5 font-bold text-zinc-800 bg-white border-2 border-zinc-200 rounded-lg shadow-sm hover:border-black hover:bg-black hover:text-white transition-all duration-300 cursor-pointer">
              Wohnung Inserieren
            </button>
          </div>
          
        </header>
        {/* --- KOPFZEILE ENDE --- */}

        <main className="flex-grow flex flex-col relative z-10">
          {children}
        </main>
        
      </body>
    </html>
  );
}