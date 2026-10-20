/**
 * Componente BarberDashboard — Panel Operativo con RBAC Estricto
 * Capa 4: UI Component
 */
export function renderBarberDashboard(state, { cashData, historyData, appointmentsData, barbersMap }) {
  const user = state.currentUser;
  const isJefe = user.role === 'JEFE' || user.role === 'ADMIN';

  // Filtrar citas según rol: Si es practicante, SOLO las de su barberId
  const visibleAppointments = isJefe
    ? appointmentsData
    : appointmentsData.filter((a) => a.barberId === user.barberId);

  return `
    <section class="py-10 px-4 max-w-7xl mx-auto">
      
      <!-- Dashboard Header -->
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 pb-6 border-b border-[#d4af37]/20">
        <div>
          <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/25 text-[#d4af37] text-[10px] font-mono uppercase tracking-wider mb-2">
            ${isJefe ? 'ESTACIÓN PRINCIPAL DE CONTROL' : 'ESTACIÓN DE BARBERO PROFESIONAL'}
          </div>
          <h2 class="font-editorial text-2xl sm:text-4xl font-bold text-[#f7f4ef]">
            Bienvenido, <span class="italic text-[#d4af37]">${isJefe ? 'David (Barbero Jefe)' : 'Maicol Matta (Barbero)'}</span>
          </h2>
          <p class="text-xs text-[#a39f97] mt-1">
            ${isJefe 
              ? 'Supervisión integral de ambas estaciones, arqueo de caja acumulada y control de turnos.' 
              : 'Acceso exclusivo a tus citas asignadas y registro de cortes realizados.'}
          </p>
        </div>

        <button id="btn-dashboard-back-home" class="btn-pill-subtle text-xs px-4 py-2 font-medium">
          ← Volver a la Web Principal
        </button>
      </div>

      <!-- SECCIÓN EXCLUSIVA DEL BARBERO JEFE: CAJA DEL DÍA EN COP -->
      ${isJefe ? `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          <div class="glass-card p-6 border-l-4 border-l-[#d4af37]">
            <span class="block text-xs uppercase tracking-wider text-[#a39f97] font-semibold mb-1">Caja Total Consolidada (Hoy)</span>
            <div class="text-3xl font-bold text-[#f7f4ef] font-mono tracking-tight">
              $${cashData.totalConsolidatedCop.toLocaleString('es-CO')} <span class="text-xs text-[#d4af37] font-normal">COP</span>
            </div>
            <span class="text-[11px] text-[#a39f97] mt-1 block">Total de cortes culminados: ${cashData.totalCount}</span>
          </div>

          <div class="glass-card p-6">
            <span class="block text-xs uppercase tracking-wider text-[#a39f97] font-semibold mb-1">Producción Maestro Lopez</span>
            <div class="text-2xl font-bold text-[#d4af37] font-mono">
              $${(cashData.breakdownByBarber['b-jefe-01']?.total || 0).toLocaleString('es-CO')} <span class="text-xs text-[#a39f97]">COP</span>
            </div>
            <span class="text-[11px] text-[#a39f97] mt-1 block">Cortes: ${cashData.breakdownByBarber['b-jefe-01']?.count || 0}</span>
          </div>

          <div class="glass-card p-6">
            <span class="block text-xs uppercase tracking-wider text-[#a39f97] font-semibold mb-1">Producción Practicante / Ayudante</span>
            <div class="text-2xl font-bold text-[#f7f4ef] font-mono">
              $${(cashData.breakdownByBarber['b-junior-01']?.total || 0).toLocaleString('es-CO')} <span class="text-xs text-[#a39f97]">COP</span>
            </div>
            <span class="text-[11px] text-[#a39f97] mt-1 block">Cortes: ${cashData.breakdownByBarber['b-junior-01']?.count || 0}</span>
          </div>
        </div>
      ` : ''}

      <!-- LISTA DE CITAS DEL DÍA -->
      <div class="mb-12">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-editorial text-xl font-bold text-[#f7f4ef]">
            ${isJefe ? 'Turnos de Hoy (Ambas Estaciones)' : 'Mis Turnos Asignados'}
          </h3>
          <span class="text-xs text-[#d4af37] font-mono">${visibleAppointments.length} turnos registrados</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${visibleAppointments.length === 0 ? `
            <div class="col-span-full p-8 text-center text-xs text-[#6e6a62] glass-card">
              No hay citas programadas para hoy.
            </div>
          ` : visibleAppointments.map((appt) => {
            const isCompleted = appt.status === 'COMPLETADA';
            const barberName = barbersMap.get(appt.barberId) || 'Barbero';
            return `
              <div class="glass-card p-5 border ${isCompleted ? 'border-green-500/30' : 'border-[#d4af37]/20'} flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="text-xs font-mono font-bold text-[#d4af37]">⏰ ${appt.startTime} - ${appt.endTime}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isCompleted ? 'bg-green-950 text-green-300 border border-green-700' : 'bg-amber-950 text-amber-300 border border-amber-700'
                    }">
                      ${appt.status}
                    </span>
                  </div>

                  <h4 class="font-bold text-base text-[#f7f4ef]">${appt.clientName}</h4>
                  <p class="text-xs text-[#a39f97] mb-1">Tel: ${appt.clientPhone || 'Sin teléfono'}</p>
                  <p class="text-xs text-[#a39f97] mb-3">Estación: <strong class="text-[#f7f4ef]">${barberName}</strong></p>
                  
                  <div class="text-[11px] text-[#d4af37] font-semibold bg-[#d4af37]/10 p-2 rounded-lg border border-[#d4af37]/20 mb-4">
                    Pago: ${appt.paymentMethod}
                  </div>
                </div>

                ${!isCompleted ? `
                  <button 
                    data-appt-id="${appt.id}" 
                    class="btn-complete-cut btn-gold w-full py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <span>Finalizar Corte & Guardar</span>
                  </button>
                ` : `
                  <div class="text-center text-xs text-green-400 py-1 font-semibold">
                    Corte Completado y Guardado en BD
                  </div>
                `}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- TABLA DE HISTORIAL EN BASE DE DATOS (CLIENTE, FECHA, HORA, VALOR) -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-editorial text-xl font-bold text-[#f7f4ef]">
              ${isJefe ? 'Historial Transaccional Consolidado' : 'Mi Historial de Cortes Realizados'}
            </h3>
            <p class="text-xs text-[#a39f97]">Registros almacenados en base de datos: Nombre del cliente, fecha, hora y valor cobrado.</p>
          </div>
        </div>

        <div class="glass-card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-[#141311] border-b border-[#d4af37]/20 text-[#d4af37] uppercase tracking-wider">
                <tr>
                  <th class="p-3.5">Cliente</th>
                  <th class="p-3.5">Fecha</th>
                  <th class="p-3.5">Hora</th>
                  ${isJefe ? '<th class="p-3.5">Barbero</th>' : ''}
                  <th class="p-3.5 text-right">Valor Cobrado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#d4af37]/10 text-[#f7f4ef]">
                ${historyData.length === 0 ? `
                  <tr>
                    <td colspan="${isJefe ? 5 : 4}" class="p-6 text-center text-[#6e6a62]">No hay cortes en el historial todavía.</td>
                  </tr>
                ` : historyData.map((h) => `
                  <tr class="hover:bg-[#d4af37]/5 transition-colors">
                    <td class="p-3.5 font-semibold">${h.clientName}</td>
                    <td class="p-3.5 font-mono text-[#a39f97]">${h.date}</td>
                    <td class="p-3.5 font-mono text-[#a39f97]">${h.time}</td>
                    ${isJefe ? `<td class="p-3.5 text-[#d4af37] font-medium">${h.barberName}</td>` : ''}
                    <td class="p-3.5 text-right font-mono font-bold text-[#d4af37]">
                      $${h.priceCop.toLocaleString('es-CO')} COP
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </section>
  `;
}
