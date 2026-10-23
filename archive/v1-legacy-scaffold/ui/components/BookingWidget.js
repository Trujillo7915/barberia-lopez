/**
 * Componente BookingWidget — Flujo de Agendamiento y Sincronización Móvil
 * Capa 4: UI Component
 */
export function renderBookingWidget(state, publicBarbers) {
  const form = state.bookingForm;
  const services = state.services;

  const timeSlots = [
    '09:00', '09:45', '10:30', '11:15', '12:00',
    '14:00', '14:45', '15:30', '16:15', '17:00', '17:45', '18:30'
  ];

  return `
    <section id="reservar" class="py-20 px-4 max-w-4xl mx-auto">
      <div class="glass-card p-6 sm:p-10 border border-[#d4af37]/30 shadow-2xl relative">
        
        <div class="text-center mb-10">
          <span class="text-[10px] tracking-widest font-semibold text-[#d4af37] uppercase px-3 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/20">
            AGENDAMIENTO DIRECTO SIN REGISTRO
          </span>
          <h2 class="font-editorial text-2xl sm:text-4xl font-bold text-[#f7f4ef] mt-3">
            Reserva tu Cita & <span class="italic text-[#d4af37] font-normal">Sincroniza tu Calendario</span>
          </h2>
          <p class="text-xs sm:text-sm text-[#a39f97] mt-2">
            Selecciona a tu barbero, define tu fecha y método de pago. Al confirmar, tu turno se guardará en tu dispositivo móvil.
          </p>
        </div>

        <form id="form-booking" class="space-y-8">
          
          <!-- PASO 1: Seleccionar Barbero -->
          <div>
            <label class="block text-xs font-semibold tracking-wider uppercase text-[#d4af37] mb-3">
              1. Selecciona a tu Maestro de Barbería:
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" id="booking-barbers-container">
              ${publicBarbers.map((b) => {
                const isSelected = form.barberId === b.id;
                return `
                  <div 
                    data-barber-id="${b.id}"
                    class="barber-card-choice cursor-pointer p-4 rounded-xl border transition-all flex items-center gap-3.5 ${
                      isSelected
                        ? 'border-[#d4af37] bg-[#d4af37]/15 ring-1 ring-[#d4af37]'
                        : 'border-[#d4af37]/15 bg-[#141311] hover:border-[#d4af37]/40'
                    }">
                    <img src="${b.avatar || './logo_barberia_lopez_hd.jpg'}" alt="${b.name}" class="w-12 h-12 rounded-full object-cover border border-[#d4af37]/40">
                    <div class="flex-1">
                      <div class="flex items-center justify-between">
                        <h4 class="font-bold text-sm text-[#f7f4ef]">${b.name}</h4>
                        ${isSelected ? '<svg class="w-4 h-4 text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}
                      </div>
                      <p class="text-[11px] text-[#a39f97]">${b.specialty}</p>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- PASO 2: Seleccionar Servicio / Combo -->
          <div>
            <label class="block text-xs font-semibold tracking-wider uppercase text-[#d4af37] mb-2">
              2. Servicio o Combo:
            </label>
            <select id="booking-service-select" class="w-full bg-[#141311] border border-[#d4af37]/25 rounded-xl px-4 py-3 text-sm text-[#f7f4ef] focus:outline-none focus:border-[#d4af37]">
              <option value="" disabled ${!form.serviceId ? 'selected' : ''}>-- Elige un corte o combo oficial --</option>
              ${services.map((s) => `
                <option value="${s.id}" ${form.serviceId === s.id ? 'selected' : ''}>
                  ${s.name} — $${s.priceCop.toLocaleString('es-CO')} COP (${s.durationMinutes} min)
                </option>
              `).join('')}
            </select>
          </div>

          <!-- PASO 3: Fecha y Franjas Horarias -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold tracking-wider uppercase text-[#d4af37] mb-2">
                3. Fecha de Atención:
              </label>
              <input 
                type="date" 
                id="booking-date" 
                value="${form.date}" 
                min="${new Date().toISOString().split('T')[0]}"
                class="w-full bg-[#141311] border border-[#d4af37]/25 rounded-xl px-4 py-3 text-sm text-[#f7f4ef] focus:outline-none focus:border-[#d4af37]">
            </div>

            <div>
              <label class="block text-xs font-semibold tracking-wider uppercase text-[#d4af37] mb-2">
                Hora de Inicio:
              </label>
              <select id="booking-time-select" class="w-full bg-[#141311] border border-[#d4af37]/25 rounded-xl px-4 py-3 text-sm text-[#f7f4ef] focus:outline-none focus:border-[#d4af37]">
                ${timeSlots.map((time) => `
                  <option value="${time}" ${form.startTime === time ? 'selected' : ''}>
                    ${time} ${Number(time.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- PASO 4: Datos del Cliente y Método de Pago -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold tracking-wider uppercase text-[#d4af37] mb-2">
                Tu Nombre Completo:
              </label>
              <input 
                type="text" 
                id="booking-client-name" 
                placeholder="Ej: Camilo Pérez"
                value="${form.clientName || ''}" 
                required
                class="w-full bg-[#141311] border border-[#d4af37]/25 rounded-xl px-4 py-3 text-sm text-[#f7f4ef] placeholder-[#6e6a62] focus:outline-none focus:border-[#d4af37]">
            </div>

            <div>
              <label class="block text-xs font-semibold tracking-wider uppercase text-[#d4af37] mb-2">
                Teléfono Móvil (WhatsApp):
              </label>
              <input 
                type="tel" 
                id="booking-client-phone" 
                placeholder="Ej: 310 123 4567"
                value="${form.clientPhone || ''}" 
                required
                class="w-full bg-[#141311] border border-[#d4af37]/25 rounded-xl px-4 py-3 text-sm text-[#f7f4ef] placeholder-[#6e6a62] focus:outline-none focus:border-[#d4af37]">
            </div>
          </div>

          <!-- Preferencia de Pago -->
          <div>
            <label class="block text-xs font-semibold tracking-wider uppercase text-[#d4af37] mb-3">
              Método de Pago Preferido:
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="payment-choice-container">
              <label class="cursor-pointer p-3.5 rounded-xl border flex items-center gap-3 transition-colors ${
                form.paymentMethod === 'EFECTIVO'
                  ? 'border-[#d4af37] bg-[#d4af37]/10'
                  : 'border-[#d4af37]/15 bg-[#141311]'
              }">
                <input type="radio" name="paymentMethod" value="EFECTIVO" ${form.paymentMethod === 'EFECTIVO' ? 'checked' : ''} class="text-[#d4af37]">
                <div>
                  <span class="block text-xs font-bold text-[#f7f4ef]">Efectivo en Mostrador</span>
                  <span class="text-[11px] text-[#a39f97]">Pagas directamente al terminar tu corte</span>
                </div>
              </label>

              <label class="cursor-pointer p-3.5 rounded-xl border flex items-center gap-3 transition-colors ${
                form.paymentMethod === 'TRANSFERENCIA'
                  ? 'border-[#d4af37] bg-[#d4af37]/10'
                  : 'border-[#d4af37]/15 bg-[#141311]'
              }">
                <input type="radio" name="paymentMethod" value="TRANSFERENCIA" ${form.paymentMethod === 'TRANSFERENCIA' ? 'checked' : ''} class="text-[#d4af37]">
                <div>
                  <span class="block text-xs font-bold text-[#f7f4ef]">Transferencia / Nequi</span>
                  <span class="text-[11px] text-[#a39f97]">Transfiere al Nequi oficial (+57 321 989 7910)</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Botón de Envío -->
          <button type="submit" class="btn-gold w-full py-4 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2">
            <span>Confirmar Cita & Generar Calendario</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </button>

        </form>

      </div>
    </section>
  `;
}
