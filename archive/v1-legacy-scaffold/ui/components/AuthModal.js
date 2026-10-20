/**
 * Componente AuthModal — Modal de Inicio de Sesión para Personal
 * Capa 4: UI Component
 */
export function renderAuthModal() {
  return `
    <div id="modal-auth" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 hidden">
      <div class="glass-modal w-full max-w-md p-6 sm:p-8 rounded-2xl relative border border-[#d4af37]/40">
        
        <!-- Botón Cerrar -->
        <button id="btn-close-auth" class="absolute top-4 right-4 text-[#a39f97] hover:text-[#f7f4ef] p-1.5 transition-colors">
          &times;
        </button>

        <div class="text-center mb-6">
          <div class="w-12 h-12 rounded-full border border-[#d4af37]/40 mx-auto mb-3 flex items-center justify-center bg-[#141311]">
            <span class="text-xs text-[#d4af37] font-bold">SEG</span>
          </div>
          <h3 class="font-editorial text-2xl font-bold text-[#f7f4ef]">Acceso de Personal</h3>
          <p class="text-xs text-[#a39f97] mt-1">Ingresa con tus credenciales asignadas por el Administrador.</p>
        </div>

        <form id="form-login" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-[#d4af37] uppercase tracking-wider mb-1.5">Usuario:</label>
            <input 
              type="text" 
              id="login-username" 
              required 
              placeholder="Ej: david.barber / matta.barber"
              class="w-full bg-[#141311] border border-[#d4af37]/25 rounded-xl px-4 py-2.5 text-sm text-[#f7f4ef] focus:outline-none focus:border-[#d4af37]">
          </div>

          <div>
            <label class="block text-xs font-semibold text-[#d4af37] uppercase tracking-wider mb-1.5">Contraseña:</label>
            <input 
              type="password" 
              id="login-password" 
              required 
              placeholder="••••••••"
              class="w-full bg-[#141311] border border-[#d4af37]/25 rounded-xl px-4 py-2.5 text-sm text-[#f7f4ef] focus:outline-none focus:border-[#d4af37]">
          </div>

          <div id="login-error-msg" class="text-xs text-red-400 bg-red-950/40 border border-red-800/40 p-2.5 rounded-lg hidden"></div>

          <button type="submit" class="btn-gold w-full py-3 text-xs font-bold uppercase tracking-wider">
            Ingresar al Panel
          </button>
        </form>

        <!-- Accesos directos preconfigurados -->
        <div class="mt-6 pt-5 border-t border-[#d4af37]/15">
          <span class="block text-[10px] uppercase tracking-wider text-[#6e6a62] font-semibold text-center mb-2.5">
            Credenciales del Personal:
          </span>
          <div class="flex flex-wrap gap-2 justify-center">
            <button type="button" class="quick-fill-btn text-[11px] px-2.5 py-1 rounded-full bg-[#141311] border border-[#d4af37]/20 text-[#a39f97] hover:border-[#d4af37]" data-u="david.barber" data-p="david2026">
              David (Barbero Jefe)
            </button>
            <button type="button" class="quick-fill-btn text-[11px] px-2.5 py-1 rounded-full bg-[#141311] border border-[#d4af37]/20 text-[#a39f97] hover:border-[#d4af37]" data-u="matta.barber" data-p="matta2026">
              Maicol Matta (Barbero)
            </button>
            <button type="button" class="quick-fill-btn text-[11px] px-2.5 py-1 rounded-full bg-[#141311] border border-[#d4af37]/20 text-[#a39f97] hover:border-[#d4af37]" data-u="admin" data-p="admin2026">
              Administrador
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}
