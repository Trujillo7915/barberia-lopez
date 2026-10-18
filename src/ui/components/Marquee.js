/**
 * Componente Marquee — Cinta Continua de Servicios
 * Capa 4: UI Component
 */
export function renderMarquee() {
  const items = [
    'CORTE TRADICIONAL',
    'PERFILADO DE BARBA & VAPOR',
    'PIGMENTACIÓN CON AERÓGRAFO',
    'MASCARILLA FACIAL ENERGIZANTE',
    'EXPERIENCIA COMPLETA VIP',
    'TOALLA CALIENTE & AFTERSHAVE',
    'SOMBRERO & CEJAS'
  ];

  const htmlItems = items
    .map(
      (item) => `
      <span class="inline-flex items-center gap-3 text-xs tracking-[0.2em] font-semibold uppercase text-[#a39f97] px-6">
        <span>${item}</span>
        <span class="text-[#d4af37]">✦</span>
      </span>
    `
    )
    .join('');

  return `
    <div class="border-y border-[#d4af37]/15 bg-[#141311]/50 py-3.5 overflow-hidden">
      <div class="marquee-track flex">
        ${htmlItems}
        ${htmlItems}
      </div>
    </div>
  `;
}
