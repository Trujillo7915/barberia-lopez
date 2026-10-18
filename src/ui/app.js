/**
 * Orquestador Principal de la UI (Application Bootstrapper)
 * Capa 4: UI Controller & Application Setup
 */
import { LocalStorageRepository } from '../infrastructure/persistence/LocalStorageRepository.js';
import { CalendarGateway } from '../infrastructure/calendar/CalendarGateway.js';

import { BookAppointmentUseCase } from '../application/use-cases/BookAppointmentUseCase.js';
import { CompleteCutUseCase } from '../application/use-cases/CompleteCutUseCase.js';
import { LoginUseCase } from '../application/use-cases/LoginUseCase.js';
import { ManageUsersUseCase } from '../application/use-cases/ManageUsersUseCase.js';
import { GetCashRegisterUseCase } from '../application/use-cases/GetCashRegisterUseCase.js';
import { GetBarberHistoryUseCase } from '../application/use-cases/GetBarberHistoryUseCase.js';

import { appState } from './state/AppState.js';
import { AccessControlService } from '../domain/services/AccessControlService.js';

import { renderNavbar } from './components/Navbar.js';
import { renderHero } from './components/Hero.js';
import { renderMarquee } from './components/Marquee.js';
import { renderCatalog } from './components/Catalog.js';
import { renderBookingWidget } from './components/BookingWidget.js';
import { renderAuthModal } from './components/AuthModal.js';
import { renderBarberDashboard } from './components/BarberDashboard.js';
import { renderAdminPanel } from './components/AdminPanel.js';

// 1. Inicialización de Repositorios e Infraestructura
const repo = new LocalStorageRepository();
const calendarGateway = new CalendarGateway();

// 2. Inyección de Dependencias en Casos de Uso
const bookAppointmentUseCase = new BookAppointmentUseCase({
  appointmentRepo: {
    findByDate: (d) => repo.findAppointmentsByDate(d),
    save: (a) => repo.saveAppointment(a)
  },
  barberRepo: {
    findById: (id) => repo.findBarberById(id)
  },
  serviceRepo: {
    findById: (id) => repo.findServiceById(id)
  },
  calendarGateway
});

const completeCutUseCase = new CompleteCutUseCase({
  appointmentRepo: {
    findById: (id) => repo.findAppointmentById(id),
    update: (a) => repo.updateAppointment(a)
  },
  serviceRepo: {
    findById: (id) => repo.findServiceById(id)
  },
  historyRepo: {
    save: (h) => repo.saveCutHistory(h)
  }
});

const loginUseCase = new LoginUseCase({
  userRepo: {
    findByUsername: (u) => repo.findUserByUsername(u),
    verifyPassword: (user, p) => repo.verifyPassword(user, p)
  },
  barberRepo: {
    findById: (id) => repo.findBarberById(id)
  }
});

const manageUsersUseCase = new ManageUsersUseCase({
  userRepo: {
    findByUsername: (u) => repo.findUserByUsername(u),
    findById: (id) => repo.findUserById(id),
    updatePassword: (id, p) => repo.updatePassword(id, p),
    save: (u) => repo.saveUser(u),
    update: (u) => repo.updateUser(u),
    findAll: () => repo.findAllUsers()
  },
  barberRepo: {
    findById: (id) => repo.findBarberById(id),
    save: (b) => repo.saveBarber(b),
    update: (b) => repo.updateBarber(b),
    findAll: () => repo.findAllBarbers()
  }
});

const getCashRegisterUseCase = new GetCashRegisterUseCase({
  historyRepo: {
    findAll: () => repo.findAllCutHistory()
  }
});

const getBarberHistoryUseCase = new GetBarberHistoryUseCase({
  historyRepo: {
    findAll: () => repo.findAllCutHistory()
  },
  barberRepo: {
    findAll: () => repo.findAllBarbers()
  }
});

// 3. Función Principal de Renderizado
async function renderApp() {
  const root = document.getElementById('app-root');
  if (!root) return;

  const users = await repo.findAllUsers();
  const barbers = await repo.findAllBarbers();
  const services = await repo.findAllServices();
  const appointments = await repo.findAllAppointments();
  const history = await repo.findAllCutHistory();

  appState.services = services;
  appState.barbers = barbers;
  appState.appointments = appointments;
  appState.history = history;

  // Filtrar barberos públicos (ocultando Admin)
  const publicBarbers = AccessControlService.filterPublicBarbers(barbers, users);

  if (!appState.bookingForm.barberId && publicBarbers.length > 0) {
    appState.bookingForm.barberId = publicBarbers[0].id;
  }
  if (!appState.bookingForm.serviceId && services.length > 0) {
    appState.bookingForm.serviceId = services[0].id;
  }

  const barbersMap = new Map(barbers.map((b) => [b.id, b.name]));

  // Composición según la vista activa
  let mainContent = '';

  if (appState.activeView === 'home') {
    mainContent = `
      ${renderHero()}
      ${renderMarquee()}
      ${renderCatalog(services, appState.bookingForm.serviceId)}
      ${renderBookingWidget(appState, publicBarbers)}
    `;
  } else if (appState.activeView === 'dashboard' && appState.currentUser) {
    const todayStr = new Date().toISOString().split('T')[0];
    const cashData = await getCashRegisterUseCase.execute({
      user: appState.currentUser,
      dateStr: todayStr
    });
    const historyData = await getBarberHistoryUseCase.execute({
      user: appState.currentUser
    });

    mainContent = renderBarberDashboard(appState, {
      cashData,
      historyData,
      appointmentsData: appointments,
      barbersMap
    });
  } else if (appState.activeView === 'admin' && appState.currentUser) {
    mainContent = renderAdminPanel({
      users,
      barbers
    });
  }

  root.innerHTML = `
    <!-- Top Preloader Line -->
    <div class="preloader-line"></div>

    <!-- Header Navbar -->
    ${renderNavbar(appState, {})}

    <!-- Contenido Dinámico -->
    <main>
      ${mainContent}
    </main>

    <!-- Footer de Lujo -->
    <footer class="border-t border-[#d4af37]/15 bg-[#090807] py-12 px-4 text-center mt-20">
      <div class="max-w-4xl mx-auto">
        <img src="./logo_barberia_lopez_hd.jpg" alt="Barbería Lopez" class="w-16 h-16 rounded-full mx-auto mb-4 border border-[#d4af37]/40">
        <h4 class="font-brand font-bold text-lg text-[#f7f4ef]">BARBERÍA LOPEZ</h4>
        <p class="text-xs text-[#d4af37] italic mt-1 mb-4">"Somos los arquitectos de tu imagen"</p>
        <p class="text-xs text-[#a39f97] mb-2">Neiva, Huila, Colombia · WhatsApp: +57 321 989 7910 · TikTok: @barber_lopez_neiva</p>
        <p class="text-[10px] text-[#6e6a62]">© 2026 Barbería Lopez — Sistema Transaccional con Arquitectura Limpia.</p>
      </div>
    </footer>

    <!-- Modal de Autenticación -->
    ${renderAuthModal()}

    <!-- Modal Contenedor de Confirmación de Cita / Calendario -->
    <div id="modal-confirmation-container"></div>
  `;

  bindEvents(users, barbers, services);
}

// 4. Enlace de Eventos del DOM
function bindEvents(users, barbers, services) {
  // Modal de Login
  const btnLoginTrigger = document.getElementById('btn-login-trigger');
  const modalAuth = document.getElementById('modal-auth');
  const btnCloseAuth = document.getElementById('btn-close-auth');

  if (btnLoginTrigger && modalAuth) {
    btnLoginTrigger.addEventListener('click', () => modalAuth.classList.remove('hidden'));
  }
  if (btnCloseAuth && modalAuth) {
    btnCloseAuth.addEventListener('click', () => modalAuth.classList.add('hidden'));
  }

  // Atajos de autocompletado en el login
  document.querySelectorAll('.quick-fill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('login-username').value = btn.dataset.u;
      document.getElementById('login-password').value = btn.dataset.p;
    });
  });

  // Submit Login
  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      const errorMsg = document.getElementById('login-error-msg');

      try {
        const { user } = await loginUseCase.execute({ username, password });
        modalAuth.classList.add('hidden');
        appState.setCurrentUser(user);
      } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.classList.remove('hidden');
      }
    });
  }

  // Logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      appState.setCurrentUser(null);
    });
  }

  // Navegación entre Web y Paneles
  const btnNavHome = document.getElementById('btn-nav-home');
  if (btnNavHome) {
    btnNavHome.addEventListener('click', () => appState.setActiveView('home'));
  }

  const btnNavPanel = document.getElementById('btn-nav-panel');
  if (btnNavPanel) {
    btnNavPanel.addEventListener('click', () => {
      if (appState.currentUser?.role === 'ADMIN') {
        appState.setActiveView('admin');
      } else {
        appState.setActiveView('dashboard');
      }
    });
  }

  const btnBackHome1 = document.getElementById('btn-dashboard-back-home');
  if (btnBackHome1) {
    btnBackHome1.addEventListener('click', () => appState.setActiveView('home'));
  }
  const btnBackHome2 = document.getElementById('btn-admin-back-home');
  if (btnBackHome2) {
    btnBackHome2.addEventListener('click', () => appState.setActiveView('home'));
  }

  // Selección de Servicio en el Catálogo
  document.querySelectorAll('.btn-select-service').forEach((btn) => {
    btn.addEventListener('click', () => {
      const serviceId = btn.dataset.serviceId;
      appState.updateBooking({ serviceId });
      const select = document.getElementById('booking-service-select');
      if (select) select.value = serviceId;
      document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Selección de Barbero en Widget
  document.querySelectorAll('.barber-card-choice').forEach((card) => {
    card.addEventListener('click', () => {
      const barberId = card.dataset.barberId;
      appState.updateBooking({ barberId });
    });
  });

  // Cambios en los selects del Booking Widget
  const serviceSelect = document.getElementById('booking-service-select');
  if (serviceSelect) {
    serviceSelect.addEventListener('change', (e) => appState.updateBooking({ serviceId: e.target.value }));
  }
  const dateInput = document.getElementById('booking-date');
  if (dateInput) {
    dateInput.addEventListener('change', (e) => appState.updateBooking({ date: e.target.value }));
  }
  const timeSelect = document.getElementById('booking-time-select');
  if (timeSelect) {
    timeSelect.addEventListener('change', (e) => appState.updateBooking({ startTime: e.target.value }));
  }

  // Radio botones de pago
  document.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
    radio.addEventListener('change', (e) => appState.updateBooking({ paymentMethod: e.target.value }));
  });

  // Envío del Formulario de Reserva
  const formBooking = document.getElementById('form-booking');
  if (formBooking) {
    formBooking.addEventListener('submit', async (e) => {
      e.preventDefault();
      const clientName = document.getElementById('booking-client-name').value;
      const clientPhone = document.getElementById('booking-client-phone').value;

      try {
        const result = await bookAppointmentUseCase.execute({
          clientName,
          clientPhone,
          barberId: appState.bookingForm.barberId,
          serviceId: appState.bookingForm.serviceId,
          date: appState.bookingForm.date,
          startTime: appState.bookingForm.startTime,
          paymentMethod: appState.bookingForm.paymentMethod
        });

        showConfirmationModal(result);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Completar Corte en Dashboard
  document.querySelectorAll('.btn-complete-cut').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const appointmentId = btn.dataset.apptId;
      try {
        await completeCutUseCase.execute({
          appointmentId,
          user: appState.currentUser
        });
        renderApp();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  // Admin: Crear Barbero
  const formCreateBarber = document.getElementById('form-create-barber');
  if (formCreateBarber) {
    formCreateBarber.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await manageUsersUseCase.createBarber({
          adminUser: appState.currentUser,
          name: document.getElementById('new-barber-name').value,
          specialty: document.getElementById('new-barber-spec').value,
          phone: document.getElementById('new-barber-phone').value,
          username: document.getElementById('new-barber-username').value,
          password: document.getElementById('new-barber-password').value,
          role: document.getElementById('new-barber-role').value
        });
        alert("¡Barbero y credenciales creadas exitosamente!");
        renderApp();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Admin: Cambiar Contraseña de Barbero
  document.querySelectorAll('.btn-change-password').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.userId;
      const username = btn.dataset.username;
      const newPassword = prompt(`Introduce la nueva contraseña para @${username}:`);
      if (newPassword) {
        try {
          const res = await manageUsersUseCase.changePassword({
            adminUser: appState.currentUser,
            userId,
            newPassword
          });
          alert(res.message);
        } catch (err) {
          alert(err.message);
        }
      }
    });
  });

  // Admin: Toggle Estado Activo/Inactivo
  document.querySelectorAll('.btn-toggle-status').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.toggleUserId;
      try {
        await manageUsersUseCase.toggleUserStatus({
          adminUser: appState.currentUser,
          userId
        });
        renderApp();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

// 5. Modal de Confirmación y Sincronización de Calendarios
function showConfirmationModal({ appointment, barber, service, calendarPayload }) {
  const container = document.getElementById('modal-confirmation-container');
  if (!container) return;

  container.innerHTML = `
    <div id="modal-confirm" class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div class="glass-modal w-full max-w-lg p-6 sm:p-8 rounded-2xl relative border border-[#d4af37]">
        
        <div class="text-center mb-6">
          <div class="w-14 h-14 rounded-full bg-green-950/60 border border-green-500/40 mx-auto mb-3 flex items-center justify-center text-green-400 text-2xl font-bold">
            ✓
          </div>
          <span class="text-[11px] font-mono uppercase tracking-widest text-[#d4af37]">TURNO CONFIRMADO</span>
          <h3 class="font-editorial text-2xl sm:text-3xl font-bold text-[#f7f4ef] mt-1">
            ¡Tu Cita está Reservada!
          </h3>
          <p class="text-xs text-[#a39f97] mt-1">
            Hola <strong class="text-[#f7f4ef]">${appointment.clientName}</strong>, tu cita ha sido asignada a la agenda de <strong class="text-[#d4af37]">${barber.name}</strong>.
          </p>
        </div>

        <div class="glass-card p-4 rounded-xl border border-[#d4af37]/20 text-xs space-y-2 mb-6">
          <div class="flex justify-between">
            <span class="text-[#a39f97]">Servicio:</span>
            <span class="font-bold text-[#f7f4ef]">${service.name}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[#a39f97]">Fecha y Hora:</span>
            <span class="font-mono text-[#d4af37] font-bold">${appointment.date} a las ${appointment.startTime}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[#a39f97]">Duración:</span>
            <span>${service.durationMinutes} minutos</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[#a39f97]">Método de Pago:</span>
            <span class="font-semibold text-[#f7f4ef]">${appointment.paymentMethod}</span>
          </div>
          <div class="flex justify-between pt-2 border-t border-[#d4af37]/15">
            <span class="text-[#a39f97] font-semibold">Total a Pagar:</span>
            <span class="font-mono text-base font-bold text-[#d4af37]">$${service.priceCop.toLocaleString('es-CO')} COP</span>
          </div>
        </div>

        <!-- BOTONES DE SINCRONIZACIÓN DE CALENDARIO -->
        <div class="space-y-3 mb-6">
          <p class="text-[11px] text-center uppercase tracking-wider text-[#d4af37] font-semibold">
            📅 Sincroniza con el calendario de tu celular:
          </p>
          
          <a 
            href="${calendarPayload.googleUrl}" 
            target="_blank" 
            class="w-full py-3 px-4 rounded-xl bg-[#141311] border border-[#d4af37]/40 text-[#f7f4ef] hover:border-[#d4af37] hover:bg-[#d4af37]/10 flex items-center justify-center gap-2.5 text-xs font-bold transition-all">
            <svg class="w-4 h-4 text-[#d4af37]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
            </svg>
            <span>Añadir a Google Calendar</span>
          </a>

          <button 
            id="btn-download-ics" 
            type="button" 
            class="w-full py-3 px-4 rounded-xl bg-[#141311] border border-[#d4af37]/40 text-[#f7f4ef] hover:border-[#d4af37] hover:bg-[#d4af37]/10 flex items-center justify-center gap-2.5 text-xs font-bold transition-all">
            <svg class="w-4 h-4 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            <span>Descargar Cita para iPhone / Apple iCal / .ics</span>
          </button>
        </div>

        <button id="btn-close-confirm" class="btn-gold w-full py-3 text-xs font-bold uppercase tracking-wider">
          Listo, Entendido
        </button>

      </div>
    </div>
  `;

  document.getElementById('btn-download-ics')?.addEventListener('click', () => {
    calendarPayload.downloadIcs();
  });

  document.getElementById('btn-close-confirm')?.addEventListener('click', () => {
    container.innerHTML = '';
    renderApp();
  });
}

// 6. Suscripción y Arranque
appState.subscribe(() => renderApp());
document.addEventListener('DOMContentLoaded', () => renderApp());
