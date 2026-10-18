/**
 * Componente AdminPanel — Panel de Control Incógnito (Exclusivo Administrador)
 * Capa 4: UI Component
 */
export function renderAdminPanel({ users, barbers, onBackHome }) {
  const barberMap = new Map(barbers.map((b) => [b.id, b]));

  return `
    <section class="py-10 px-4 max-w-7xl mx-auto">
      
      <!-- Admin Header -->
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 pb-6 border-b border-[#d4af37]/20">
        <div>
          <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-950/40 border border-purple-500/40 text-purple-300 text-[10px] font-mono uppercase tracking-wider mb-2">
            🕵️ MODO INCÓGNITO — SUPERADMINISTRADOR TÉCNICO
          </div>
          <h2 class="font-editorial text-2xl sm:text-4xl font-bold text-[#f7f4ef]">
            Gestión Centralizada de <span class="italic text-[#d4af37]">Personal & Credenciales</span>
          </h2>
          <p class="text-xs text-[#a39f97] mt-1">
            Solo tú como administrador puedes crear barberos, cambiar sus contraseñas y controlar el acceso. Invisible para el personal de la barbería.
          </p>
        </div>

        <button id="btn-admin-back-home" class="btn-pill-subtle text-xs px-4 py-2 font-medium">
          ← Volver a la Web Principal
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        
        <!-- FORMULARIO: CREAR NUEVO BARBERO -->
        <div class="glass-card p-6 border border-[#d4af37]/30">
          <h3 class="font-editorial text-lg font-bold text-[#f7f4ef] mb-1">Crear Nuevo Barbero</h3>
          <p class="text-[11px] text-[#a39f97] mb-5">Añade un nuevo profesional y asigna su usuario y contraseña.</p>

          <form id="form-create-barber" class="space-y-3.5">
            <div>
              <label class="block text-[11px] font-semibold text-[#d4af37] uppercase mb-1">Nombre Completo:</label>
              <input type="text" id="new-barber-name" required placeholder="Ej: Mateo Valencia" class="w-full bg-[#0d0c0a] border border-[#d4af37]/20 rounded-lg px-3 py-2 text-xs text-[#f7f4ef] focus:outline-none focus:border-[#d4af37]">
            </div>

            <div>
              <label class="block text-[11px] font-semibold text-[#d4af37] uppercase mb-1">Especialidad:</label>
              <input type="text" id="new-barber-spec" placeholder="Ej: Barba Spa y Fade" class="w-full bg-[#0d0c0a] border border-[#d4af37]/20 rounded-lg px-3 py-2 text-xs text-[#f7f4ef] focus:outline-none focus:border-[#d4af37]">
            </div>

            <div>
              <label class="block text-[11px] font-semibold text-[#d4af37] uppercase mb-1">Teléfono:</label>
              <input type="tel" id="new-barber-phone" placeholder="+57 300 000 0000" class="w-full bg-[#0d0c0a] border border-[#d4af37]/20 rounded-lg px-3 py-2 text-xs text-[#f7f4ef] focus:outline-none focus:border-[#d4af37]">
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-semibold text-[#d4af37] uppercase mb-1">Usuario:</label>
                <input type="text" id="new-barber-username" required placeholder="mateo.barber" class="w-full bg-[#0d0c0a] border border-[#d4af37]/20 rounded-lg px-3 py-2 text-xs text-[#f7f4ef] focus:outline-none focus:border-[#d4af37]">
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-[#d4af37] uppercase mb-1">Rol:</label>
                <select id="new-barber-role" class="w-full bg-[#0d0c0a] border border-[#d4af37]/20 rounded-lg px-3 py-2 text-xs text-[#f7f4ef] focus:outline-none focus:border-[#d4af37]">
                  <option value="PRACTICANTE">Practicante</option>
                  <option value="JEFE">Barbero Jefe</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-semibold text-[#d4af37] uppercase mb-1">Contraseña Inicial:</label>
              <input type="password" id="new-barber-password" required placeholder="Clave de acceso" class="w-full bg-[#0d0c0a] border border-[#d4af37]/20 rounded-lg px-3 py-2 text-xs text-[#f7f4ef] focus:outline-none focus:border-[#d4af37]">
            </div>

            <button type="submit" class="btn-gold w-full py-2.5 text-xs font-bold uppercase mt-2">
              + Registrar Barbero
            </button>
          </form>
        </div>

        <!-- LISTA Y MODIFICACIÓN DE CONTRASEÑAS -->
        <div class="lg:col-span-2 glass-card p-6">
          <h3 class="font-editorial text-lg font-bold text-[#f7f4ef] mb-1">Cuentas del Personal & Cambio de Contraseñas</h3>
          <p class="text-[11px] text-[#a39f97] mb-5">Puedes cambiar la contraseña de cualquier barbero directamente desde esta lista.</p>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="border-b border-[#d4af37]/20 text-[#d4af37] uppercase">
                <tr>
                  <th class="p-2.5">Barbero / Nombre</th>
                  <th class="p-2.5">Usuario</th>
                  <th class="p-2.5">Rol</th>
                  <th class="p-2.5">Estado</th>
                  <th class="p-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#d4af37]/10 text-[#f7f4ef]">
                ${users.map((u) => {
                  const barber = u.barberId ? barberMap.get(u.barberId) : null;
                  const displayName = barber ? barber.name : (u.role === 'ADMIN' ? 'Fabián (Admin)' : 'Usuario');
                  return `
                    <tr class="hover:bg-[#d4af37]/5 transition-colors">
                      <td class="p-2.5 font-semibold">${displayName}</td>
                      <td class="p-2.5 font-mono text-[#a39f97]">@${u.username}</td>
                      <td class="p-2.5">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.role === 'ADMIN' ? 'bg-purple-950 text-purple-300' : (u.role === 'JEFE' ? 'bg-amber-950 text-amber-300' : 'bg-blue-950 text-blue-300')
                        }">
                          ${u.role}
                        </span>
                      </td>
                      <td class="p-2.5">
                        <span class="text-[10px] font-semibold ${u.active ? 'text-green-400' : 'text-red-400'}">
                          ${u.active ? '● Activo' : '○ Inactivo'}
                        </span>
                      </td>
                      <td class="p-2.5 text-right space-x-2">
                        <button 
                          data-user-id="${u.id}" 
                          data-username="${u.username}"
                          class="btn-change-password text-[11px] px-2.5 py-1 rounded bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 hover:bg-[#d4af37] hover:text-black transition-all">
                          Cambiar Clave
                        </button>
                        ${u.role !== 'ADMIN' ? `
                          <button 
                            data-toggle-user-id="${u.id}" 
                            class="btn-toggle-status text-[11px] px-2 py-1 rounded border ${
                              u.active ? 'border-red-500/30 text-red-400 hover:bg-red-950/40' : 'border-green-500/30 text-green-400 hover:bg-green-950/40'
                            }">
                            ${u.active ? 'Desactivar' : 'Activar'}
                          </button>
                        ` : ''}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </section>
  `;
}
