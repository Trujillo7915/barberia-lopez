/**
 * Componente Hero — Estética Editorial Dark Luxury (Inspirado en la referencia)
 * Capa 4: UI Component
 */
export function renderHero() {
  return `
    <section id="hero" class="relative pt-12 pb-20 lg:pt-20 lg:pb-28 px-4 overflow-hidden">
      
      <!-- Ambient Studio Spotlight Background -->
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.12),transparent_70%)] pointer-events-none"></div>

      <div class="max-w-5xl mx-auto text-center relative z-10">
        
        <!-- Category & Location Badge -->
        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#d4af37]/25 bg-[#141311]/80 text-[#d4af37] text-[11px] font-semibold tracking-widest uppercase mb-6 shadow-sm">
          <span class="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse"></span>
          <span>ESTUDIO PROFESIONAL · NEIVA, HUILA</span>
        </div>

        <!-- Editorial Main Title -->
        <h1 class="font-editorial text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#f7f4ef] leading-[1.1] mb-6">
          El arte del corte & la <br class="hidden sm:inline" />
          <span class="italic text-[#d4af37] font-normal">precisión de tu imagen</span>
        </h1>

        <!-- Subtitle -->
        <p class="max-w-2xl mx-auto text-sm sm:text-base text-[#a39f97] leading-relaxed mb-9">
          Disfruta de una experiencia tradicional de lujo con atención personalizada, puntualidad estricta y agendamiento sincronizado directo a tu calendario.
        </p>

        <!-- CTA Buttons -->
        <div class="flex flex-wrap items-center justify-center gap-4">
          <a href="#reservar" class="btn-gold text-sm px-8 py-3.5 inline-flex items-center gap-2">
            <span>Agendar Cita en Calendario</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
            </svg>
          </a>
          <a href="#servicios" class="btn-pill-subtle text-sm px-7 py-3.5 inline-flex items-center gap-2">
            <span>Ver Catálogo & Precios</span>
          </a>
        </div>

      </div>
    </section>
  `;
}
