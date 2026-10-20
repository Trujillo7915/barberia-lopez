/**
 * Repositorio de Persistencia en LocalStorage
 * Capa 4: Infrastructure Persistence
 */
import { SEED_USERS, SEED_BARBERS, SEED_SERVICES, SEED_APPOINTMENTS, SEED_HISTORY } from './SeedData.js';

const STORAGE_KEYS = {
  USERS: 'blopez_users',
  BARBERS: 'blopez_barbers',
  SERVICES: 'blopez_services',
  APPOINTMENTS: 'blopez_appointments',
  HISTORY: 'blopez_history'
};

export class LocalStorageRepository {
  constructor() {
    this._initializeStorage();
  }

  _initializeStorage() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.BARBERS)) {
      localStorage.setItem(STORAGE_KEYS.BARBERS, JSON.stringify(SEED_BARBERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SERVICES)) {
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(SEED_SERVICES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.APPOINTMENTS)) {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(SEED_APPOINTMENTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.HISTORY)) {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(SEED_HISTORY));
    }
  }

  _get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // --- Usuarios ---
  async findUserByUsername(username) {
    const list = this._get(STORAGE_KEYS.USERS);
    return list.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  async findUserById(id) {
    const list = this._get(STORAGE_KEYS.USERS);
    return list.find((u) => u.id === id) || null;
  }

  async verifyPassword(user, plainPassword) {
    // Verificación de credencial
    return user.passwordHash === plainPassword;
  }

  async updatePassword(userId, newPassword) {
    const list = this._get(STORAGE_KEYS.USERS);
    const index = list.findIndex((u) => u.id === userId);
    if (index !== -1) {
      list[index].passwordHash = newPassword;
      list[index].updatedAt = new Date().toISOString();
      this._set(STORAGE_KEYS.USERS, list);
      return true;
    }
    return false;
  }

  async saveUser(user) {
    const list = this._get(STORAGE_KEYS.USERS);
    list.push(user);
    this._set(STORAGE_KEYS.USERS, list);
    return user;
  }

  async updateUser(user) {
    const list = this._get(STORAGE_KEYS.USERS);
    const idx = list.findIndex((u) => u.id === user.id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...user };
      this._set(STORAGE_KEYS.USERS, list);
    }
    return user;
  }

  async findAllUsers() {
    return this._get(STORAGE_KEYS.USERS);
  }

  // --- Barberos ---
  async findBarberById(id) {
    const list = this._get(STORAGE_KEYS.BARBERS);
    return list.find((b) => b.id === id) || null;
  }

  async findAllBarbers() {
    return this._get(STORAGE_KEYS.BARBERS);
  }

  async saveBarber(barber) {
    const list = this._get(STORAGE_KEYS.BARBERS);
    list.push(barber);
    this._set(STORAGE_KEYS.BARBERS, list);
    return barber;
  }

  async updateBarber(barber) {
    const list = this._get(STORAGE_KEYS.BARBERS);
    const idx = list.findIndex((b) => b.id === barber.id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...barber };
      this._set(STORAGE_KEYS.BARBERS, list);
    }
    return barber;
  }

  // --- Servicios ---
  async findServiceById(id) {
    const list = this._get(STORAGE_KEYS.SERVICES);
    return list.find((s) => s.id === id) || null;
  }

  async findAllServices() {
    return this._get(STORAGE_KEYS.SERVICES);
  }

  // --- Citas ---
  async findAppointmentById(id) {
    const list = this._get(STORAGE_KEYS.APPOINTMENTS);
    return list.find((a) => a.id === id) || null;
  }

  async findAppointmentsByDate(date) {
    const list = this._get(STORAGE_KEYS.APPOINTMENTS);
    return list.filter((a) => a.date === date);
  }

  async findAllAppointments() {
    return this._get(STORAGE_KEYS.APPOINTMENTS);
  }

  async saveAppointment(appointment) {
    const list = this._get(STORAGE_KEYS.APPOINTMENTS);
    list.push(appointment);
    this._set(STORAGE_KEYS.APPOINTMENTS, list);
    return appointment;
  }

  async updateAppointment(appointment) {
    const list = this._get(STORAGE_KEYS.APPOINTMENTS);
    const idx = list.findIndex((a) => a.id === appointment.id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...appointment };
      this._set(STORAGE_KEYS.APPOINTMENTS, list);
    }
    return appointment;
  }

  // --- Historial de Cortes ---
  async saveCutHistory(record) {
    const list = this._get(STORAGE_KEYS.HISTORY);
    list.push(record);
    this._set(STORAGE_KEYS.HISTORY, list);
    return record;
  }

  async findAllCutHistory() {
    return this._get(STORAGE_KEYS.HISTORY);
  }

  // Reseteo para pruebas si es necesario
  resetStorage() {
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.BARBERS);
    localStorage.removeItem(STORAGE_KEYS.SERVICES);
    localStorage.removeItem(STORAGE_KEYS.APPOINTMENTS);
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
    this._initializeStorage();
  }
}
