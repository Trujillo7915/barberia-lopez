/**
 * Componente Navbar — Navegación Superior Dark Luxury
 * Capa 4: UI Component
 */
export function renderNavbar(state, { onOpenLogin, onLogout, onNavigate }) {
  const isAuth = !!state.currentUser;

  return `
    <header class="sticky top-0 z-40 bg-[#090807]/90 backdrop-blur-md border-b border-[#d4af37]/15 px-4 lg:px-8 py-3.5 transition-all">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        
        <!-- Brand / Logo -->
        <a href="#hero" class="flex items-center gap-3 group" id="nav-brand">
          <img src="./logo_barberia_lopez_hd.jpg" alt="Barbería Lopez" class="w-10 h-10 rounded-full border border-[#d4af37]/40 object-cover shadow-sm group-hover:scale-105 transition-transform">
          <div>
            <span class="font-brand font-bold text-lg tracking-wider text-[#f7f4ef] group-hover:text-[#d4af37] transition-colors">BARBERÍA LOPEZ</span>
          </div>
        </a>

        <!-- Navigation Links (Cliente) -->
        <nav class="hidden md:flex items-center gap-7 text-xs font-semibold tracking-wider text-[#a39f97] uppercase">
          <a href="#servicios" class="hover:text-[#f7f4ef] transition-colors">Catálogo</a>
          <a href="#barberos" class="hover:text-[#f7f4ef] transition-colors">Maestros</a>
          <a href="#reservar" class="hover:text-[#f7f4ef] transition-colors">Agendamiento</a>
          <a href="https://wa.me/573219897910" target="_blank" class="hover:text-[#d4af37] transition-colors flex items-center gap-1.5 text-[#d4af37]">
            <span>WhatsApp</span>
          </a>
        </nav>

        <!-- Right Action Button -->
        <div class="flex items-center gap-3">
          ${!isAuth ? `
            <a href="#reservar" class="hidden sm:inline-flex btn-gold text-xs px-5 py-2.5">
              Reservar Cita
            </a>
            <button id="btn-login-trigger" class="btn-pill-subtle text-xs px-4 py-2 font-medium flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
              </svg>
              <span>Acceder</span>
            </button>
          ` : `
            <div class="flex items-center gap-2">
              <span class="text-xs px-2.5 py-1 rounded-full bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 font-mono font-medium">
                @${state.currentUser.username} (${state.currentUser.role})
              </span>
              ${state.activeView !== 'home' ? `
                <button id="btn-nav-home" class="btn-pill-subtle text-xs px-3 py-1.5">Ver Web</button>
              ` : `
                <button id="btn-nav-panel" class="btn-gold text-xs px-3.5 py-1.5">Mi Panel</button>
              `}
              <button id="btn-logout" class="text-xs text-[#a39f97] hover:text-red-400 p-1.5 transition-colors" title="Cerrar Sesión">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                </svg>
              </button>
            </div>
          `}
        </div>

      </div>
    </header>
  `;
}
