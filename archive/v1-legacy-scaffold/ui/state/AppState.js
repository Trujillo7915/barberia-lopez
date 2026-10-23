/**
 * AppState — Gestor Reactivo de Estado de la Aplicación
 * Capa 4: UI State
 */
export class AppState {
  constructor() {
    this.currentUser = null;
    this.services = [];
    this.barbers = [];
    this.appointments = [];
    this.history = [];
    this.activeView = 'home'; // 'home' | 'dashboard' | 'admin'
    this.bookingForm = {
      barberId: null,
      serviceId: null,
      date: new Date().toISOString().split('T')[0],
      startTime: '10:00',
      clientName: '',
      clientPhone: '',
      paymentMethod: 'EFECTIVO'
    };
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this);
    }
  }

  setCurrentUser(user) {
    this.currentUser = user;
    if (!user) {
      this.activeView = 'home';
    } else if (user.role === 'ADMIN') {
      this.activeView = 'admin';
    } else {
      this.activeView = 'dashboard';
    }
    this.notify();
  }

  setActiveView(view) {
    this.activeView = view;
    this.notify();
  }

  updateBooking(fields) {
    this.bookingForm = { ...this.bookingForm, ...fields };
    this.notify();
  }
}

export const appState = new AppState();
