// Banner oben auf der Startseite mit dem symbolischen Streckennetz.
export default function Banner() {
  return (
    <div className="relative w-full h-56 md:h-72 bg-gradient-to-b from-white to-zinc-50 flex items-center overflow-hidden border-b border-zinc-200/70">

      {/* TEXT */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-8">
        <div className="max-w-xl bg-white/80 backdrop-blur-md rounded-2xl px-6 py-5 md:px-8 md:py-7 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-black leading-[1.05]">
            Dein Zuhause.<br /><span className="text-zinc-400 font-medium">Nur einen Bahnhof entfernt.</span>
          </h1>
          <p className="mt-3 text-sm md:text-base text-zinc-600">Wohnungen und Häuser in ganz Deutschland, gefiltert nach deiner Bahn, deinem Bus oder deiner Tram.</p>
        </div>
      </div>

      {/* SYMBOLISCHES STRECKENNETZ */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
        
          {/* 1. Rote Strecke - Verläuft nach dem Umsteigebahnhof (750, 350) nun waagerecht auf Höhe 350 weiter */}
          <path d="M -50 250 L 300 250 L 500 250 L 750 350 L 1050 350" stroke="#E53935" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        
          {/* 2. Blaue Strecke */}
          <path d="M 300 50 L 300 550" stroke="#1E88E5" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {/* 3. Grüne Strecke */}
          <path d="M 750 -50 L 750 350 L 900 500 L 1050 500" stroke="#43A047" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {/* 4. Lila Strecke */}
          <path d="M -50 300 L 100 300 L 200 400 L 500 400 L 600 500 L 750 500" stroke="#8E24AA" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {/* --- Haltestellen --- */}
        
          {/* Rote Linie - Die rechte Station wurde von cy="250" auf cy="350" verschoben */}
          <circle cx="100" cy="250" r="8" fill="white" stroke="#333" strokeWidth="3" />
          <circle cx="475" cy="250" r="8" fill="white" stroke="#333" strokeWidth="3" />
          <circle cx="900" cy="350" r="8" fill="white" stroke="#333" strokeWidth="3" />

          {/* Blaue Linie */}
          <circle cx="300" cy="150" r="8" fill="white" stroke="#333" strokeWidth="3" />

          {/* Grüne Linie */}
          <circle cx="750" cy="210" r="8" fill="white" stroke="#333" strokeWidth="3" />
          <circle cx="825" cy="425" r="8" fill="white" stroke="#333" strokeWidth="3" />
          <circle cx="900" cy="500" r="8" fill="white" stroke="#333" strokeWidth="3" />

          {/* Lila Linie */}
          <circle cx="50" cy="300" r="8" fill="white" stroke="#333" strokeWidth="3" />
          <circle cx="250" cy="400" r="8" fill="white" stroke="#333" strokeWidth="3" />
          <circle cx="450" cy="400" r="8" fill="white" stroke="#333" strokeWidth="3" />
          <circle cx="550" cy="450" r="8" fill="white" stroke="#333" strokeWidth="3" />
          <circle cx="650" cy="500" r="8" fill="white" stroke="#333" strokeWidth="3" />
          <circle cx="750" cy="500" r="8" fill="white" stroke="#333" strokeWidth="3" />

          {/* --- Umsteigebahnhöfe --- */}
          <circle cx="300" cy="250" r="14" fill="white" stroke="#333" strokeWidth="4" />
          <circle cx="750" cy="350" r="14" fill="white" stroke="#333" strokeWidth="4" />
          <circle cx="300" cy="400" r="14" fill="white" stroke="#333" strokeWidth="4" />

          {/* --- Bufferzonen & Häuser --- */}
        
          {/* LINKE SEITE */}
          <circle cx="300" cy="250" r="110" fill="none" stroke="#333" strokeWidth="2" strokeDasharray="8 8" opacity="0.3" />
          <g transform="translate(230, 190) scale(1.5)">
            <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 0 0 .707-1.707l-9-9a1.002 1.002 0 0 0-1.414 0l-9 9A1 1 0 0 0 3 13zm7 7v-5h4v5h-4zm2-15.586 7 7V20h-1v-6H10v6H9V9.414l7-7z" fill="#333" />
          </g>
          <g transform="translate(230, 280) scale(1.5)">
            <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 0 0 .707-1.707l-9-9a1.002 1.002 0 0 0-1.414 0l-9 9A1 1 0 0 0 3 13zm7 7v-5h4v5h-4zm2-15.586 7 7V20h-1v-6H10v6H9V9.414l7-7z" fill="#333" />
          </g>

          {/* RECHTE SEITE */}
          <circle cx="750" cy="350" r="110" fill="none" stroke="#333" strokeWidth="2" strokeDasharray="8 8" opacity="0.3" />
          <g transform="translate(830, 310) scale(1.5)">
            <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 0 0 .707-1.707l-9-9a1.002 1.002 0 0 0-1.414 0l-9 9A1 1 0 0 0 3 13zm7 7v-5h4v5h-4zm2-15.586 7 7V20h-1v-6H10v6H9V9.414l7-7z" fill="#333" />
          </g>
          <g transform="translate(710, 390) scale(1.5)">
            <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 0 0 .707-1.707l-9-9a1.002 1.002 0 0 0-1.414 0l-9 9A1 1 0 0 0 3 13zm7 7v-5h4v5h-4zm2-15.586 7 7V20h-1v-6H10v6H9V9.414l7-7z" fill="#333" />
          </g>
        </svg>
      </div>
    </div>
  );
}
