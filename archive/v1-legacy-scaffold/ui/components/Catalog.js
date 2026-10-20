/**
 * Componente Catalog — Catálogo Oficial Bento Grid (Tarjetas Dark Luxury)
 * Capa 4: UI Component
 */
export function renderCatalog(services, selectedServiceId, onSelectService) {
  const serviceCards = services
    .map((s) => {
      const isSelected = s.id === selectedServiceId;
      return `
        <div class="card-interactive glass-card p-6 flex flex-col justify-between ${
          isSelected ? 'border-[#d4af37] ring-1 ring-[#d4af37]' : ''
        }">
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <span class="text-[10px] tracking-widest font-semibold text-[#d4af37] uppercase px-2.5 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/20">
                ${s.category} · ${s.durationMinutes} MIN
              </span>
              <span class="text-lg font-bold text-[#f7f4ef] font-mono tracking-tight">
                $${s.priceCop.toLocaleString('es-CO')} <span class="text-[10px] text-[#a39f97] font-normal">COP</span>
              </span>
            </div>

            <h3 class="font-editorial text-xl font-bold text-[#f7f4ef] mb-2">${s.name}</h3>
            <p class="text-xs text-[#a39f97] leading-relaxed mb-6">${s.description}</p>
          </div>

          <button 
            data-service-id="${s.id}" 
            class="btn-select-service w-full py-2.5 text-xs font-semibold rounded-lg transition-all ${
              isSelected
                ? 'bg-[#d4af37] text-black font-bold'
                : 'border border-[#d4af37]/30 text-[#f7f4ef] hover:bg-[#d4af37]/15'
            }">
            ${isSelected ? 'Servicio Seleccionado' : 'Elegir para Agendar'}
          </button>
        </div>
      `;
    })
    .join('');

  return `
    <section id="servicios" class="py-20 px-4 max-w-7xl mx-auto">
      <div class="text-center max-w-2xl mx-auto mb-14">
        <span class="text-[11px] tracking-widest font-semibold text-[#d4af37] uppercase">CATÁLOGO EXCLUSIVO</span>
        <h2 class="font-editorial text-3xl sm:text-5xl font-bold text-[#f7f4ef] mt-2 mb-4">
          Servicios y <span class="italic text-[#d4af37] font-normal">Combos de Autor</span>
        </h2>
        <p class="text-xs sm:text-sm text-[#a39f97]">
          Tarifas oficiales sin sobrecostos. Selecciona el servicio que deseas para configurar tu turno en el calendario.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${serviceCards}
      </div>
    </section>
  `;
}
