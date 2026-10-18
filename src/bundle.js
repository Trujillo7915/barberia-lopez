/**
 * Barbería Lopez — Bundle Transaccional Arquitectura Onion
 * Estilo Visual: Josh Warner — Black Void Gallery Wall (#0f0f0f, #f0f0f0, #b8b8b8, #08ff00, Inter 400)
 */
(() => {
  'use strict';

  const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try { return crypto.randomUUID(); } catch (e) {}
    }
    return 'id_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  };

  // --- CAPA 1: DOMAIN TYPES & ENUMS ---
  const Roles = Object.freeze({
    ADMIN: 'ADMIN',
    JEFE: 'JEFE',
    BARBERO: 'BARBERO',
    PRACTICANTE: 'PRACTICANTE'
  });

  const PaymentMethods = Object.freeze({
    EFECTIVO: 'EFECTIVO',
    TRANSFERENCIA: 'TRANSFERENCIA'
  });

  const AppointmentStatus = Object.freeze({
    PENDIENTE: 'PENDIENTE',
    CONFIRMADA: 'CONFIRMADA',
    COMPLETADA: 'COMPLETADA',
    CANCELADA: 'CANCELADA'
  });

  // --- CAPA 1: DOMAIN MODELS ---
  class User {
    constructor({ id, username, passwordHash, role, barberId = null, active = true, createdAt = new Date() }) {
      this.id = id || generateId();
      this.username = (username || '').toLowerCase().trim();
      this.passwordHash = passwordHash;
      this.role = role;
      this.barberId = barberId;
      this.active = active;
      this.createdAt = createdAt;
    }
  }

  class Barber {
    constructor({ id, userId = null, name, specialty = 'Barbero Profesional', phone = '', avatar = '', active = true }) {
      this.id = id || generateId();
      this.userId = userId;
      this.name = (name || '').trim();
      this.specialty = specialty;
      this.phone = phone;
      this.avatar = avatar;
      this.active = active;
    }
  }

  class Appointment {
    constructor({
      id,
      clientName,
      clientPhone,
      barberId,
      serviceId,
      date,
      startTime,
      endTime,
      paymentMethod = PaymentMethods.EFECTIVO,
      status = AppointmentStatus.CONFIRMADA,
      calendarEventUid = null,
      createdAt = new Date()
    }) {
      this.id = id || generateId();
      this.clientName = (clientName || '').trim();
      this.clientPhone = (clientPhone || '').trim();
      this.barberId = barberId;
      this.serviceId = serviceId;
      this.date = date;
      this.startTime = startTime;
      this.endTime = endTime;
      this.paymentMethod = paymentMethod;
      this.status = status;
      this.calendarEventUid = calendarEventUid || `${this.id}@barberialopez.co`;
      this.createdAt = createdAt;
    }
  }

  class CutHistory {
    constructor({ id, appointmentId = null, barberId, clientName, date, time, priceCop, createdAt = new Date() }) {
      this.id = id || generateId();
      this.appointmentId = appointmentId;
      this.barberId = barberId;
      this.clientName = (clientName || '').trim();
      this.date = date;
      this.time = time;
      this.priceCop = Number(priceCop) || 0;
      this.createdAt = createdAt;
    }
  }

  // --- CAPA 2: DOMAIN SERVICES ---
  class AvailabilityService {
    static isSlotAvailable(existingAppointments, barberId, date, newStart, newEnd) {
      const active = existingAppointments.filter(
        (a) => a.barberId === barberId && a.date === date && a.status !== 'CANCELADA'
      );

      const toMinutes = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };

      const newStartMin = toMinutes(newStart);
      const newEndMin = toMinutes(newEnd);

      for (const appt of active) {
        const existingStartMin = toMinutes(appt.startTime);
        const existingEndMin = toMinutes(appt.endTime);
        if (Math.max(newStartMin, existingStartMin) < Math.min(newEndMin, existingEndMin)) {
          return false;
        }
      }
      return true;
    }
  }

  class CashCalculatorService {
    static calculateDailyCash(historyList, dateStr) {
      const dayRecords = historyList.filter((r) => r.date === dateStr);
      let totalConsolidated = 0;
      const byBarber = {};

      for (const record of dayRecords) {
        totalConsolidated += record.priceCop;
        if (!byBarber[record.barberId]) {
          byBarber[record.barberId] = { count: 0, total: 0 };
        }
        byBarber[record.barberId].count += 1;
        byBarber[record.barberId].total += record.priceCop;
      }

      return {
        date: dateStr,
        totalCount: dayRecords.length,
        totalConsolidatedCop: totalConsolidated,
        breakdownByBarber: byBarber
      };
    }
  }

  class AccessControlService {
    static canViewCashRegister(user) {
      if (!user) return false;
      return user.role === Roles.JEFE || user.role === Roles.ADMIN;
    }

    static canManageCredentials(user) {
      if (!user) return false;
      return user.role === Roles.ADMIN;
    }

    static filterPublicBarbers(barbersList, usersList) {
      const adminUserIds = new Set(
        usersList.filter((u) => u.role === Roles.ADMIN).map((u) => u.id)
      );
      return barbersList.filter((b) => b.active && !adminUserIds.has(b.userId));
    }
  }

  // --- CAPA 4: INFRASTRUCTURE (PERSISTENCIA Y CALENDARIOS) ---
  const SEED_USERS = [
    {
      id: 'u-admin-01',
      username: 'admin',
      passwordHash: 'admin2026',
      role: Roles.ADMIN,
      barberId: null,
      active: true
    },
    {
      id: 'u-jefe-01',
      username: 'maestro.lopez',
      passwordHash: 'lopez2026',
      role: Roles.JEFE,
      barberId: 'b-jefe-01',
      active: true
    },
    {
      id: 'u-junior-01',
      username: 'carlos.junior',
      passwordHash: 'junior2026',
      role: Roles.PRACTICANTE,
      barberId: 'b-junior-01',
      active: true
    }
  ];

  const SEED_BARBERS = [
    {
      id: 'b-jefe-01',
      userId: 'u-jefe-01',
      name: 'Maestro Lopez',
      specialty: 'Maestro Barbero · Estación Principal',
      phone: '+57 321 989 7910',
      avatar: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80',
      active: true
    },
    {
      id: 'b-junior-01',
      userId: 'u-junior-01',
      name: 'Carlos Andrés',
      specialty: 'Barbero Practicante · Degradados & Perfilado',
      phone: '+57 312 456 7890',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80',
      active: true
    }
  ];

  const SEED_SERVICES = [
    {
      id: 's-01',
      name: 'Corte Básico',
      category: 'Tradicional',
      durationMinutes: 30,
      priceCop: 20000,
      description: 'Corte clásico o degradado a máquina y tijera, definición de contornos con navaja.',
      active: true
    },
    {
      id: 's-02',
      name: 'Combo 1',
      category: 'Corte + Barba',
      durationMinutes: 45,
      priceCop: 25000,
      description: 'Corte de cabello completo + perfilado de barba sencilla con vapor y aftershave.',
      active: true
    },
    {
      id: 's-03',
      name: 'Combo 2',
      category: 'Corte + Barba + Cejas',
      durationMinutes: 50,
      priceCop: 35000,
      description: 'Corte de cabello + ritual de barba con toalla caliente + perfilado de cejas.',
      active: true
    },
    {
      id: 's-04',
      name: 'Combo 3',
      category: 'Ritual Facial',
      durationMinutes: 60,
      priceCop: 40000,
      description: 'Corte + barba completa + limpieza facial con mascarilla de carbón activado.',
      active: true
    },
    {
      id: 's-05',
      name: 'Combi Completa VIP',
      category: 'Experiencia Integral',
      durationMinutes: 75,
      priceCop: 65000,
      description: 'Servicio integral VIP: corte + barba spa + mascarilla hidratante + pigmentación.',
      active: true
    },
    {
      id: 's-06',
      name: 'Pigmentación Aerógrafo',
      category: 'Acabado Capilar',
      durationMinutes: 30,
      priceCop: 18000,
      description: 'Definición de líneas y sombra natural con aerógrafo de precisión.',
      active: true
    },
    {
      id: 's-07',
      name: 'Pigmentación Manual',
      category: 'Acabado Artesanal',
      durationMinutes: 35,
      priceCop: 22000,
      description: 'Pigmentación artesanal detallada para mayor densidad y fijación en barba o contornos.',
      active: true
    }
  ];

  const SEED_APPOINTMENTS = [];
  const SEED_HISTORY = [];

  class LocalStorageRepository {
    constructor() {
      this.memStore = {};
      this._initializeStorage();
    }

    _initializeStorage() {
      // Limpieza automática de datos de prueba previos para despliegue en producción
      const CLEAN_DEPLOY_VERSION = 'v1_production_clean';
      try {
        if (localStorage.getItem('blopez_clean_version') !== CLEAN_DEPLOY_VERSION) {
          localStorage.removeItem('blopez_appointments');
          localStorage.removeItem('blopez_history');
          localStorage.removeItem('blopez_last_phone');
          localStorage.setItem('blopez_clean_version', CLEAN_DEPLOY_VERSION);
        }
      } catch (e) {}

      this._ensureKey('blopez_users', SEED_USERS);
      this._ensureKey('blopez_barbers', SEED_BARBERS);
      this._ensureKey('blopez_services', SEED_SERVICES);
      this._ensureKey('blopez_appointments', SEED_APPOINTMENTS);
      this._ensureKey('blopez_history', SEED_HISTORY);
    }

    _ensureKey(key, seed) {
      try {
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, JSON.stringify(seed));
        }
      } catch (e) {
        if (!this.memStore[key]) {
          this.memStore[key] = JSON.parse(JSON.stringify(seed));
        }
      }
    }

    _get(key) {
      try {
        const d = localStorage.getItem(key);
        return d ? JSON.parse(d) : (this.memStore[key] || []);
      } catch (e) {
        return this.memStore[key] || [];
      }
    }

    _set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch (e) {
        this.memStore[key] = val;
      }
    }

    async findUserByUsername(username) {
      const list = await this.findAllUsers();
      const cleanInput = (username || '').replace(/^@/, '').toLowerCase().trim();
      return list.find((u) => {
        const uClean = (u.username || '').replace(/^@/, '').toLowerCase().trim();
        return uClean === cleanInput;
      }) || null;
    }

    async findUserById(id) {
      const list = await this.findAllUsers();
      return list.find((u) => u.id === id) || null;
    }

    async verifyPassword(user, plainPassword) {
      if (!user || !user.passwordHash || !plainPassword) return false;
      const cleanStored = String(user.passwordHash).trim();
      const cleanPlain = String(plainPassword).trim();
      
      // Coincidencia exacta
      if (cleanStored === cleanPlain) return true;
      // Sin punto final accidental (habitual en teclados móviles tras doble espacio)
      if (cleanStored.replace(/\.$/, '') === cleanPlain.replace(/\.$/, '')) return true;
      // Sin distinción de mayúsculas/minúsculas
      if (cleanStored.toLowerCase() === cleanPlain.toLowerCase()) return true;
      if (cleanStored.toLowerCase().replace(/\.$/, '') === cleanPlain.toLowerCase().replace(/\.$/, '')) return true;
      // Con o sin arroba inicial
      if (cleanStored.replace(/^@/, '') === cleanPlain.replace(/^@/, '')) return true;
      if (cleanStored.toLowerCase().replace(/^@/, '').replace(/\.$/, '') === cleanPlain.toLowerCase().replace(/^@/, '').replace(/\.$/, '')) return true;

      return false;
    }

    async updatePassword(userId, newPassword) {
      const list = this._get('blopez_users');
      const idx = list.findIndex((u) => u.id === userId);
      if (idx !== -1) {
        list[idx].passwordHash = newPassword;
        this._set('blopez_users', list);
        try {
          await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(list[idx])
          });
        } catch (e) {}
        return true;
      }
      return false;
    }

    async saveUser(user) {
      const list = this._get('blopez_users');
      list.push(user);
      this._set('blopez_users', list);
      try {
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user)
        });
      } catch (e) {}
      return user;
    }

    async updateUser(user) {
      const list = this._get('blopez_users');
      const idx = list.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...user };
        this._set('blopez_users', list);
      }
      try {
        await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user)
        });
      } catch (e) {}
      return user;
    }

    async findAllUsers() {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const serverUsers = await res.json();
          if (Array.isArray(serverUsers) && serverUsers.length > 0) {
            this._set('blopez_users', serverUsers);
            return serverUsers;
          }
        }
      } catch (e) {}
      return this._get('blopez_users');
    }

    async deleteUser(userId) {
      let list = this._get('blopez_users');
      list = list.filter((u) => u.id !== userId);
      this._set('blopez_users', list);
      try {
        await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      } catch (e) {}
      return true;
    }

    async findBarberById(id) {
      const list = await this.findAllBarbers();
      return list.find((b) => b.id === id) || null;
    }

    async findAllBarbers() {
      try {
        const res = await fetch('/api/barbers');
        if (res.ok) {
          const serverBarbers = await res.json();
          if (Array.isArray(serverBarbers) && serverBarbers.length > 0) {
            this._set('blopez_barbers', serverBarbers);
            return serverBarbers;
          }
        }
      } catch (e) {}
      return this._get('blopez_barbers');
    }

    async saveBarber(barber) {
      const list = this._get('blopez_barbers');
      list.push(barber);
      this._set('blopez_barbers', list);
      try {
        await fetch('/api/barbers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(barber)
        });
      } catch (e) {}
      return barber;
    }

    async updateBarber(barber) {
      const list = this._get('blopez_barbers');
      const idx = list.findIndex((b) => b.id === barber.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...barber };
        this._set('blopez_barbers', list);
      }
      try {
        await fetch(`/api/barbers/${barber.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(barber)
        });
      } catch (e) {}
      return barber;
    }

    async deleteBarber(barberId) {
      let list = this._get('blopez_barbers');
      list = list.filter((b) => b.id !== barberId);
      this._set('blopez_barbers', list);
      try {
        await fetch(`/api/barbers/${barberId}`, { method: 'DELETE' });
      } catch (e) {}
      return true;
    }

    async findServiceById(id) { return this._get('blopez_services').find((s) => s.id === id) || null; }
    async findAllServices() { return this._get('blopez_services'); }
    async findAppointmentById(id) { return this._get('blopez_appointments').find((a) => a.id === id) || null; }
    async findAppointmentsByDate(date) { return this._get('blopez_appointments').filter((a) => a.date === date); }
    async findAllAppointments() {
      try {
        const res = await fetch('/api/appointments');
        if (res.ok) {
          const serverList = await res.json();
          if (Array.isArray(serverList)) {
            this._set('blopez_appointments', serverList);
            return serverList;
          }
        }
      } catch (e) {}
      return this._get('blopez_appointments');
    }

    async saveAppointment(appt) {
      const list = this._get('blopez_appointments');
      list.push(appt);
      this._set('blopez_appointments', list);
      try {
        await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appt)
        });
      } catch (e) {}
      return appt;
    }

    async updateAppointment(appt) {
      const list = this._get('blopez_appointments');
      const idx = list.findIndex((a) => a.id === appt.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...appt };
        this._set('blopez_appointments', list);
      }
      try {
        await fetch(`/api/appointments/${appt.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appt)
        });
      } catch (e) {}
      return appt;
    }

    async saveCutHistory(rec) {
      const list = this._get('blopez_history');
      list.push(rec);
      this._set('blopez_history', list);
      try {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rec)
        });
      } catch (e) {}
      return rec;
    }

    async findAllCutHistory() {
      try {
        const res = await fetch('/api/history');
        if (res.ok) {
          const serverHistory = await res.json();
          if (Array.isArray(serverHistory)) {
            this._set('blopez_history', serverHistory);
            return serverHistory;
          }
        }
      } catch (e) {}
      return this._get('blopez_history');
    }
  }

  class CalendarGateway {
    generateSyncData({ appointment, barberName, serviceName, priceCop }) {
      const cleanDate = appointment.date.replace(/-/g, '');
      const cleanStart = appointment.startTime.replace(/:/g, '') + '00';
      const cleanEnd = appointment.endTime.replace(/:/g, '') + '00';

      const dtStart = `${cleanDate}T${cleanStart}`;
      const dtEnd = `${cleanDate}T${cleanEnd}`;
      const description = `Servicio: ${serviceName}\\nBarbero: ${barberName}\\nValor: $${priceCop.toLocaleString('es-CO')} COP\\nUbicacion: Barberia Lopez, Neiva, Huila`;

      const icsString = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Barberia Lopez//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${appointment.calendarEventUid || appointment.id + '@barberialopez.co'}`,
        `SUMMARY:Cita Barberia Lopez - ${serviceName}`,
        `DESCRIPTION:${description}`,
        'LOCATION:Barberia Lopez, Neiva, Huila',
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT60M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Recordatorio de Cita en Barberia Lopez',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      const dates = `${cleanDate}T${cleanStart}/${cleanDate}T${cleanEnd}`;
      const text = encodeURIComponent(`Cita Barbería Lopez - ${serviceName}`);
      const details = encodeURIComponent(
        `Cita agendada con ${barberName}.\nServicio: ${serviceName}\nValor: $${priceCop.toLocaleString('es-CO')} COP\nLínea oficial: +57 321 989 7910`
      );
      const location = encodeURIComponent('Barbería Lopez, Neiva, Huila');
      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;

      const waText = encodeURIComponent(
        `Hola Barbería Lopez, confirmo mi turno agendado en la web:\nBarbero: ${barberName}\nServicio: ${serviceName}\nFecha: ${appointment.date}\nHora: ${appointment.startTime}`
      );
      const whatsappUrl = `https://wa.me/573219897910?text=${waText}`;
      const host = window.location.host;
      const cleanPhone = (appointment.clientPhone || '').replace(/\D/g, '');
      const clientWebcalUrl = cleanPhone 
        ? `webcal://${host}/api/calendar/client/${cleanPhone}.ics` 
        : `webcal://${host}/api/calendar/appointment/${appointment.id}.ics`;
      const appointmentWebcalUrl = `webcal://${host}/api/calendar/appointment/${appointment.id}.ics`;
      const icsDownloadUrl = `/api/appointment/${appointment.id}.ics`;
      const icsDataUri = 'data:text/calendar;charset=utf8,' + encodeURIComponent(icsString);

      return {
        icsString,
        icsDataUri,
        icsDownloadUrl,
        clientWebcalUrl,
        appointmentWebcalUrl,
        cleanPhone,
        googleUrl,
        whatsappUrl,
        openAppleCalendar: () => {
          window.location.href = clientWebcalUrl;
        },
        downloadIcs: () => {
          const link = document.createElement('a');
          link.href = icsDownloadUrl;
          link.setAttribute('download', `Cita_${barberName.replace(/\s+/g, '_')}.ics`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      };
    }
  }

  // --- HELPERS DE TIEMPO Y FECHAS LOCALES ---
  function getLocalDateString(dateObj = new Date()) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function isSlotInPast(dateStr, timeStr) {
    if (!dateStr || !timeStr) return false;
    const now = new Date();
    const todayStr = getLocalDateString(now);
    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;
    // Es hoy: comparar minutos transcurridos del día
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60 + m) <= currentTotalMinutes;
  }

  // --- CAPA 3: APPLICATION USE CASES ---
  class BookAppointmentUseCase {
    constructor({ repo, calendarGateway }) {
      this.repo = repo;
      this.calendarGateway = calendarGateway;
    }
    async execute({ clientName, clientPhone, barberId, serviceId, date, startTime, paymentMethod }) {
      if (isSlotInPast(date, startTime)) {
        throw new Error("El horario seleccionado ya ha transcurrido. Por favor selecciona una hora disponible actual o futura.");
      }

      const barber = await this.repo.findBarberById(barberId);
      if (!barber) throw new Error("Barbero no encontrado.");

      const service = await this.repo.findServiceById(serviceId);
      if (!service) throw new Error("Servicio no encontrado.");

      const [h, m] = startTime.split(':').map(Number);
      const endTotalMinutes = h * 60 + m + service.durationMinutes;
      const endH = String(Math.floor(endTotalMinutes / 60)).padStart(2, '0');
      const endM = String(endTotalMinutes % 60).padStart(2, '0');
      const endTime = `${endH}:${endM}`;

      const existingAppointments = await this.repo.findAppointmentsByDate(date);
      const isAvailable = AvailabilityService.isSlotAvailable(existingAppointments, barberId, date, startTime, endTime);

      if (!isAvailable) {
        throw new Error(`El barbero ${barber.name} ya tiene un turno reservado en esa franja horaria.`);
      }

      const appointment = new Appointment({
        clientName,
        clientPhone,
        barberId,
        serviceId,
        date,
        startTime,
        endTime,
        paymentMethod
      });

      const saved = await this.repo.saveAppointment(appointment);
      const calendarPayload = this.calendarGateway.generateSyncData({
        appointment: saved,
        barberName: barber.name,
        serviceName: service.name,
        priceCop: service.priceCop
      });

      return { appointment: saved, barber, service, calendarPayload };
    }
  }

  class CompleteCutUseCase {
    constructor({ repo }) { this.repo = repo; }
    async execute({ appointmentId, user }) {
      const appointment = await this.repo.findAppointmentById(appointmentId);
      if (!appointment) throw new Error("Cita no encontrada.");

      if ((user.role === Roles.PRACTICANTE || user.role === Roles.BARBERO) && user.barberId !== appointment.barberId) {
        throw new Error("No tienes autorización para modificar citas de otra estación.");
      }

      const service = await this.repo.findServiceById(appointment.serviceId);
      const priceCop = service ? service.priceCop : 0;

      appointment.status = AppointmentStatus.COMPLETADA;
      await this.repo.updateAppointment(appointment);

      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const cutRecord = new CutHistory({
        appointmentId: appointment.id,
        barberId: appointment.barberId,
        clientName: appointment.clientName,
        date: appointment.date,
        time: currentTime,
        priceCop: priceCop
      });

      await this.repo.saveCutHistory(cutRecord);
      return { appointment, cutRecord };
    }
  }

  class LoginUseCase {
    constructor({ repo }) { this.repo = repo; }
    async execute({ username, password }) {
      const user = await this.repo.findUserByUsername(username);
      if (!user || !user.active) throw new Error("Credenciales inválidas o usuario inactivo.");
      const valid = await this.repo.verifyPassword(user, password);
      if (!valid) throw new Error("Credenciales inválidas.");
      let barber = null;
      if (user.barberId) barber = await this.repo.findBarberById(user.barberId);
      return { user, barber };
    }
  }

  class ManageUsersUseCase {
    constructor({ repo }) { this.repo = repo; }
    async createBarber({ adminUser, name, specialty, phone, username, password, role }) {
      if (!AccessControlService.canManageCredentials(adminUser)) {
        throw new Error("Acceso denegado: solo el Administrador puede crear barberos.");
      }
      const existing = await this.repo.findUserByUsername(username);
      if (existing) throw new Error(`El usuario '@${username}' ya existe.`);

      const barber = new Barber({
        name,
        specialty,
        phone,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
      });
      await this.repo.saveBarber(barber);

      const user = new User({
        username,
        passwordHash: password,
        role,
        barberId: barber.id
      });
      await this.repo.saveUser(user);

      barber.userId = user.id;
      await this.repo.updateBarber(barber);
      return { user, barber };
    }

    async changePassword({ adminUser, userId, newPassword }) {
      if (!AccessControlService.canManageCredentials(adminUser)) {
        throw new Error("Acceso denegado.");
      }
      const user = await this.repo.findUserById(userId);
      if (!user) throw new Error("Usuario no encontrado.");
      await this.repo.updatePassword(userId, newPassword);
      return { success: true, message: `Contraseña de @${user.username} actualizada con éxito.` };
    }

    async toggleUserStatus({ adminUser, userId }) {
      if (!AccessControlService.canManageCredentials(adminUser)) {
        throw new Error("Acceso denegado.");
      }
      const user = await this.repo.findUserById(userId);
      if (!user) throw new Error("Usuario no encontrado.");
      if (user.role === Roles.ADMIN) throw new Error("No se puede desactivar al Administrador.");
      user.active = !user.active;
      await this.repo.updateUser(user);
      if (user.barberId) {
        const barber = await this.repo.findBarberById(user.barberId);
        if (barber) {
          barber.active = user.active;
          await this.repo.updateBarber(barber);
        }
      }
      return { user };
    }

    async deleteBarber({ adminUser, userId }) {
      if (!AccessControlService.canManageCredentials(adminUser)) {
        throw new Error("Acceso denegado: solo el Administrador puede eliminar cuentas.");
      }
      const user = await this.repo.findUserById(userId);
      if (!user) throw new Error("Usuario no encontrado.");
      if (user.role === Roles.ADMIN) throw new Error("No se puede eliminar la cuenta del Administrador.");

      const barberId = user.barberId;
      await this.repo.deleteUser(userId);
      if (barberId) {
        await this.repo.deleteBarber(barberId);
      }
      return { success: true, message: `La cuenta de @${user.username} ha sido eliminada con éxito.` };
    }
  }

  // --- HELPERS PARA CALENDARIO INTERACTIVO (JOSH WARNER STYLE) ---
  const TIME_SLOTS = [
    '09:00', '09:45', '10:30', '11:15', '12:00',
    '14:00', '14:45', '15:30', '16:15', '17:00', '17:45', '18:30'
  ];

  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  function formatDateFriendly(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayName = DAY_NAMES[dateObj.getDay()];
    const monthName = MONTH_NAMES[m - 1];
    return `${dayName}, ${d} de ${monthName} de ${y}`;
  }

  function computeEndTime(startTime, durationMinutes = 30) {
    const [h, m] = startTime.split(':').map(Number);
    const endTotalMinutes = h * 60 + m + durationMinutes;
    const endH = String(Math.floor(endTotalMinutes / 60)).padStart(2, '0');
    const endM = String(endTotalMinutes % 60).padStart(2, '0');
    return `${endH}:${endM}`;
  }

  function formatTime12h(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }

  function renderCalendarGrid(year, month, appointments, publicBarbers, selectedBarberFilter, selectedDate) {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDayIdx = (new Date(year, month, 1).getDay() + 6) % 7; // Lunes = 0
    const todayStr = getLocalDateString();

    const activeBarbers = selectedBarberFilter === 'ALL'
      ? publicBarbers
      : publicBarbers.filter((b) => b.id === selectedBarberFilter);

    let cellsHtml = '';

    // Celdas vacías antes del primer día del mes
    for (let i = 0; i < firstDayIdx; i++) {
      cellsHtml += `<div class="cal-journal-cell origin-cal-cell opacity-0 pointer-events-none"></div>`;
    }

    // Celdas de los días del mes
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isPast = dateStr < todayStr;
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;

      let freeSlotsCount = 0;
      if (!isPast) {
        for (const slot of TIME_SLOTS) {
          if (isToday && isSlotInPast(dateStr, slot)) {
            continue;
          }
          const slotEnd = computeEndTime(slot, 30);
          const hasFree = activeBarbers.some((b) => 
            AvailabilityService.isSlotAvailable(appointments, b.id, dateStr, slot, slotEnd)
          );
          if (hasFree) freeSlotsCount++;
        }
      }

      const cellClasses = [
        'cal-journal-cell',
        'origin-cal-cell',
        isPast ? 'disabled' : '',
        isToday ? 'today' : '',
        isSelected ? 'selected' : ''
      ].filter(Boolean).join(' ');

      cellsHtml += `
        <div class="${cellClasses}" data-date="${dateStr}" ${isPast ? 'title="Fecha pasada"' : 'title="Clic para ver turnos disponibles"'}>
          <div class="flex items-center justify-between mb-1">
            <span class="cal-journal-day-num">${day}</span>
            ${isToday ? '<span class="w-2 h-2 rounded-full bg-[#d4af37] shadow-[0_0_8px_#d4af37]" title="Hoy"></span>' : ''}
          </div>
          <div class="mt-auto pt-2">
            ${isPast ? `
              <span class="font-sans-ui text-[10px] text-[#8a8275]">PASADO</span>
            ` : freeSlotsCount > 0 ? `
              <span class="cal-journal-badge">
                ${freeSlotsCount} LIBRES
              </span>
            ` : `
              <span class="font-sans-ui text-[10px] text-[#8a8275]">LLENO</span>
            `}
          </div>
        </div>
      `;
    }

    return `
      <div class="cal-journal-grid">
        <div class="cal-journal-header">LUN</div>
        <div class="cal-journal-header">MAR</div>
        <div class="cal-journal-header">MIÉ</div>
        <div class="cal-journal-header">JUE</div>
        <div class="cal-journal-header">VIE</div>
        <div class="cal-journal-header">SÁB</div>
        <div class="cal-journal-header">DOM</div>
        ${cellsHtml}
      </div>
    `;
  }

  function renderTimeSlotsGrid(selectedDate, appointments, publicBarbers, selectedBarberFilter) {
    const todayStr = getLocalDateString();
    const isPast = selectedDate < todayStr;
    const activeBarbers = selectedBarberFilter === 'ALL'
      ? publicBarbers
      : publicBarbers.filter((b) => b.id === selectedBarberFilter);

    if (isPast) {
      return `
        <div class="bg-[#161a22] p-8 text-center text-[#c5c0b6] rounded-[24px] border border-[rgba(212,175,55,0.22)]">
          <p class="font-serif-editorial text-[18px]">Esta fecha ya transcurrió. Selecciona una fecha presente o futura en el calendario superior.</p>
        </div>
      `;
    }

    const slotsHtml = TIME_SLOTS.map((slot) => {
      const isPastSlot = isSlotInPast(selectedDate, slot);
      const slotEnd = computeEndTime(slot, 30);
      const freeBarbers = isPastSlot ? [] : activeBarbers.filter((b) => 
        AvailabilityService.isSlotAvailable(appointments, b.id, selectedDate, slot, slotEnd)
      );
      const isAvailable = !isPastSlot && freeBarbers.length > 0;
      const timeFormatted = formatTime12h(slot);

      if (isAvailable) {
        let barberHint = '';
        if (selectedBarberFilter !== 'ALL') {
          barberHint = freeBarbers[0].name.split(' ')[0].toUpperCase();
        } else if (publicBarbers.length === 1) {
          barberHint = freeBarbers[0].name.split(' ')[0].toUpperCase();
        } else if (freeBarbers.length === publicBarbers.length) {
          barberHint = publicBarbers.length === 2 ? 'AMBAS ESTACIONES' : 'TODAS LAS ESTACIONES';
        } else if (freeBarbers.length > 1) {
          barberHint = freeBarbers.map((b) => b.name.split(' ')[0]).join(', ').toUpperCase();
        } else {
          barberHint = freeBarbers[0].name.split(' ')[0].toUpperCase();
        }

        return `
          <button 
            type="button" 
            class="slot-journal-btn origin-slot-btn" 
            data-slot-date="${selectedDate}" 
            data-slot-time="${slot}" 
            data-slot-barber="${freeBarbers[0].id}"
            title="Clic para agendar a las ${timeFormatted}">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="w-2 h-2 rounded-full bg-[#d4af37] shadow-[0_0_6px_#d4af37]"></span>
              <span class="font-bold text-[#ffffff] text-[15px] font-mono-tech tracking-wide">${timeFormatted}</span>
            </div>
            <span class="slot-journal-hint text-[11px] font-semibold text-[#f3e5ab] tracking-wider">${barberHint} · LIBRE</span>
          </button>
        `;
      } else {
        const titleReason = isPastSlot ? 'Horario transcurrido hoy' : 'Turno no disponible';
        return `
          <div class="slot-journal-btn booked origin-slot-btn opacity-60" title="${titleReason}">
            <span class="text-[#8a8275] text-[15px] font-bold font-mono-tech line-through decoration-[#8a8275]/50">${timeFormatted}</span>
            <span class="slot-journal-hint text-[#615c53]">OCUPADO</span>
          </div>
        `;
      }
    }).join('');

    return `
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        ${slotsHtml}
      </div>
    `;
  }

  const initialNow = new Date();
  const initialDateStr = getLocalDateString(initialNow);

  // --- CAPA 4: UI STATE ---
  const state = {
    currentUser: null,
    services: [],
    barbers: [],
    appointments: [],
    history: [],
    activeView: 'home',
    calendarYear: initialNow.getFullYear(),
    calendarMonth: initialNow.getMonth(),
    selectedDate: initialDateStr,
    selectedBarberFilter: 'ALL',
    dashboardBarberFilter: 'ALL',
    historyBarberFilter: 'ALL',
    historyFilter: 'ALL',
    historySearch: '',
    bookingModalOpen: false,
    bookingForm: {
      barberId: null,
      serviceId: null,
      date: initialDateStr,
      startTime: '10:30',
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      clientNotes: '',
      paymentMethod: 'EFECTIVO'
    }
  };

  const repo = new LocalStorageRepository();
  const calendarGateway = new CalendarGateway();
  const bookAppointmentUseCase = new BookAppointmentUseCase({ repo, calendarGateway });
  const completeCutUseCase = new CompleteCutUseCase({ repo });
  const loginUseCase = new LoginUseCase({ repo });
  const manageUsersUseCase = new ManageUsersUseCase({ repo });

  // --- RENDERIZADO PRINCIPAL (JOSH WARNER — BLACK VOID GALLERY WALL) ---
  async function renderApp() {
    const root = document.getElementById('app-root');
    if (!root) return;

    const users = await repo.findAllUsers();
    const barbers = await repo.findAllBarbers();
    const services = await repo.findAllServices();
    const appointments = await repo.findAllAppointments();
    const history = await repo.findAllCutHistory();

    state.services = services;
    state.barbers = barbers;
    state.appointments = appointments;
    state.history = history;

    const publicBarbers = AccessControlService.filterPublicBarbers(barbers, users);
    const activeBarberIds = new Set(publicBarbers.map((b) => b.id));

    if (state.selectedBarberFilter !== 'ALL' && !activeBarberIds.has(state.selectedBarberFilter)) {
      state.selectedBarberFilter = 'ALL';
    }
    if ((!state.bookingForm.barberId || !activeBarberIds.has(state.bookingForm.barberId)) && publicBarbers.length > 0) {
      state.bookingForm.barberId = publicBarbers[0].id;
    }
    if (!state.bookingForm.serviceId && services.length > 0) {
      state.bookingForm.serviceId = services[0].id;
    }

    const barbersMap = new Map(barbers.map((b) => [b.id, b.name]));
    const isAuth = !!state.currentUser;

    let mainContent = '';

    if (state.activeView === 'home') {
      mainContent = `
        <!-- HERO & PILLARS WITH BARBERÍA LOPEZ LOGO BACKGROUND (Dentro del recuadro rojo) -->
        <section id="hero" class="relative overflow-hidden bg-[#0a0b0d] pt-6 pb-16 border-b border-[#d4af37]/20">
          
          <!-- LOGO WATERMARK / HERO BACKDROP (Proporción exacta 1:1 preservada, nitidez HD sin pixelado) -->
          <div class="absolute inset-0 pointer-events-none select-none flex items-center justify-center overflow-hidden z-0">
            <!-- Aura luminosa ambiental en oro cálido -->
            <div class="absolute w-[500px] md:w-[750px] h-[500px] md:h-[750px] rounded-full bg-[#d4af37]/10 blur-[130px] -translate-y-6"></div>
            
            <!-- Logotipo oficial HD renderizado en proporción nativa perfecta (no se deforma ni se pixela) -->
            <img 
              src="./logo_barberia_lopez_hd.jpg" 
              alt="Barbería Lopez Fondo" 
              class="w-[480px] sm:w-[600px] md:w-[700px] lg:w-[800px] max-w-[92vw] h-auto object-contain opacity-35 md:opacity-40 mix-blend-screen filter drop-shadow-[0_0_35px_rgba(212,175,55,0.2)]"
              loading="eager"
            >

            <!-- Máscaras de gradiente radial y lineal: los bordes se funden en #0a0b0d y el texto es 100% legible -->
            <div class="absolute inset-0 bg-gradient-to-t from-[#0a0b0d] via-transparent to-[#0a0b0d]/85"></div>
            <div class="absolute inset-0 bg-gradient-to-r from-[#0a0b0d]/90 via-transparent to-[#0a0b0d]/90"></div>
            <div class="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_25%,#0a0b0d_82%)]"></div>
          </div>

          <div class="relative z-10 max-w-[1240px] mx-auto px-6 md:px-12">
            
            <!-- Layout Hero Centrado y Majestuoso sobre el Logo de Fondo -->
            <div class="max-w-3xl mx-auto text-center flex flex-col items-center justify-center min-h-[52vh] py-10">
              
              <div class="inline-flex items-center gap-2 mb-6 px-3.5 py-1 rounded-full bg-[#d4af37]/15 text-[#f3e5ab] border border-[#d4af37]/35 text-xs font-sans-ui font-semibold tracking-wide w-fit backdrop-blur-sm">
                <span class="w-2 h-2 rounded-full bg-[#d4af37] shadow-[0_0_8px_#d4af37]"></span>
                <span>NEIVA, HUILA · AGENDA EN VIVO 2026</span>
              </div>

              <!-- Titular Display en blanco cálido y oro metálico -->
              <h1 class="type-display-editorial mb-6 text-[#ffffff] tracking-tight">
                Arquitectos de tu imagen.<br>
                <span class="text-[#d4af37] italic font-normal">Precisión en cada corte.</span>
              </h1>

              <!-- Subtítulo descriptivo -->
              <p class="font-serif-editorial text-[#c5c0b6] max-w-xl mx-auto text-[18px] sm:text-[20px] mb-8 font-normal leading-relaxed">
                Estudio de barbería tradicional y alta peluquería masculina. Agenda tu turno directamente en nuestro registro en vivo y sincronízalo de inmediato en tu calendario personal.
              </p>

              <!-- Botones de Acción en Oro y Borde Bruñido -->
              <div class="flex flex-wrap items-center justify-center gap-4">
                <a href="#calendario" class="btn-clay">
                  Reservar turno →
                </a>
                <button type="button" id="btn-open-client-sync" class="btn-stone-outline text-[#f3e5ab] cursor-pointer">
                  Sincronizar mi calendario iPhone
                </button>
                <a href="https://wa.me/573219897910" target="_blank" class="btn-stone-outline">
                  Línea WhatsApp (+57 321 989 7910)
                </a>
              </div>
            </div>

            <!-- TRES PILARES / ESTÁNDARES EN ORO & OBSIDIANA -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              <div class="bg-[#12151b]/85 backdrop-blur-md border border-[#d4af37]/25 rounded-[22px] p-7 flex flex-col justify-between shadow-lg hover:border-[#d4af37]/50 transition-all">
                <div class="font-serif-editorial text-[44px] sm:text-[52px] font-normal leading-none text-[#d4af37] mb-3">100%</div>
                <p class="font-sans-ui text-[14px] text-[#c5c0b6] leading-snug">Cero esperas en sala. Tu turno reservado en agenda es atendido al minuto exacto.</p>
              </div>
              <div class="bg-[#12151b]/85 backdrop-blur-md border border-[#d4af37]/25 rounded-[22px] p-7 flex flex-col justify-between shadow-lg hover:border-[#d4af37]/50 transition-all">
                <div class="font-serif-editorial text-[44px] sm:text-[52px] font-normal leading-none text-[#d4af37] mb-3">+12 Años</div>
                <p class="font-sans-ui text-[14px] text-[#c5c0b6] leading-snug">Maestro Lopez al frente de la alta escuela de peluquería clásica en Neiva, Huila.</p>
              </div>
              <div class="bg-[#12151b]/85 backdrop-blur-md border border-[#d4af37]/25 rounded-[22px] p-7 flex flex-col justify-between shadow-lg hover:border-[#d4af37]/50 transition-all">
                <div class="font-serif-editorial text-[44px] sm:text-[52px] font-normal leading-none text-[#d4af37] mb-3">4.9 / 5.0</div>
                <p class="font-sans-ui text-[14px] text-[#c5c0b6] leading-snug">Visagismo anatómico, toallas calientes y satisfacción absoluta en cada estación.</p>
              </div>
            </div>

          </div>
        </section>

        <!-- SECTION 2: CALENDARIO GRANDE INTERACTIVO -->
        <section id="calendario" class="max-w-[1240px] mx-auto px-6 md:px-12 py-[72px]">
          
          <!-- Encabezado de la Sección -->
          <div class="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div>
              <div class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#d4af37] mb-2">02 / CALENDARIO EN VIVO</div>
              <h2 class="type-display-editorial text-[36px] sm:text-[46px] leading-[1.05] text-[#ffffff]">
                Agenda de turnos en tiempo real
              </h2>
            </div>
            <p class="font-serif-editorial text-[#c5c0b6] max-w-md text-[16px] sm:text-[17px] leading-relaxed">
              Explora las fechas disponibles y haz clic sobre el día u hora que desees. Se abrirá el formulario para registrar tus datos, conectar tu calendario y apartar tu corte con tu barbero favorito.
            </p>
          </div>

          <!-- Filtro de Estaciones / Barberos -->
          <div class="bg-[#12151b] border border-[#d4af37]/20 rounded-[20px] p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-2.5">
              <span class="w-2 h-2 rounded-full bg-[#d4af37] shadow-[0_0_8px_#d4af37]"></span>
              <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#f3e5ab]">FILTRAR DISPONIBILIDAD:</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <button 
                type="button" 
                data-barber-filter="ALL" 
                class="btn-barber-filter ${state.selectedBarberFilter === 'ALL' ? 'btn-clay' : 'btn-stone-outline'} py-1.5 px-4 text-xs">
                Todas las estaciones
              </button>
              ${publicBarbers.map((b) => `
                <button 
                  type="button" 
                  data-barber-filter="${b.id}" 
                  class="btn-barber-filter ${state.selectedBarberFilter === b.id ? 'btn-clay' : 'btn-stone-outline'} py-1.5 px-4 text-xs">
                  ${b.name} (${b.specialty.split('&')[0].trim()})
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Cuadrícula del Calendario Grande -->
          <div class="bg-[#12151b] border border-[#d4af37]/20 rounded-[24px] p-5 md:p-8 mb-8 shadow-xl">
            <!-- Controles de Navegación de Mes -->
            <div class="flex items-center justify-between mb-6 pb-4 border-b border-[#d4af37]/20">
              <div class="flex items-center gap-2">
                <button id="cal-btn-prev" class="btn-stone-outline py-1 px-3 text-xs" title="Mes anterior">← Anterior</button>
                <button id="cal-btn-next" class="btn-stone-outline py-1 px-3 text-xs" title="Mes siguiente">Siguiente →</button>
              </div>

              <div class="font-serif-editorial text-[22px] sm:text-[28px] font-normal text-[#ffffff] tracking-tight text-center">
                ${MONTH_NAMES[state.calendarMonth]} <span class="text-[#d4af37] font-sans-ui">${state.calendarYear}</span>
              </div>

              <button id="cal-btn-today" class="btn-stone-outline py-1 px-3 text-xs">
                Ir a hoy
              </button>
            </div>

            <!-- Grilla de 7 columnas -->
            ${renderCalendarGrid(state.calendarYear, state.calendarMonth, appointments, publicBarbers, state.selectedBarberFilter, state.selectedDate)}
          </div>

          <!-- Franjas Horarias del Día Seleccionado -->
          <div class="bg-[#12151b] border border-[#d4af37]/20 rounded-[24px] p-5 md:p-8 shadow-xl">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#d4af37]/20">
              <div>
                <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#a39578] block mb-1">HORARIOS DISPONIBLES PARA:</span>
                <h3 class="font-serif-editorial text-[24px] sm:text-[30px] font-normal text-[#ffffff]">
                  ${formatDateFriendly(state.selectedDate)}
                </h3>
              </div>
              <div class="font-sans-ui text-xs font-medium text-[#f3e5ab] inline-flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-[#d4af37] shadow-[0_0_8px_#d4af37]"></span> Clic en una hora libre para ingresar tus datos
              </div>
            </div>

            ${renderTimeSlotsGrid(state.selectedDate, appointments, publicBarbers, state.selectedBarberFilter)}
          </div>

        </section>

        <!-- SECTION 03: SERVICIOS & FILOSOFÍA -->
        <section id="servicios" class="max-w-[1240px] mx-auto px-6 md:px-12 py-[72px] border-t border-[#d4af37]/20">
          <div class="mb-10">
            <div class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#d4af37] mb-2">03 / CATÁLOGO & DISTINCIÓN</div>
            <h2 class="type-display-editorial text-[36px] sm:text-[46px] leading-[1.05] text-[#ffffff]">
              Servicios de autor & filosofía
            </h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <!-- Card 1: Firma Clásica -->
            <div class="bg-[#12151b] border border-[#d4af37]/25 rounded-[24px] p-7 flex flex-col justify-between min-h-[240px] hover:border-[#d4af37]/50 transition-all shadow-lg">
              <div>
                <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#a39578] block mb-2">01 / ESTILO DE AUTOR</span>
                <h3 class="font-serif-editorial text-[26px] font-normal text-[#ffffff] mb-2">Corte Clásico Lopez</h3>
                <p class="font-sans-ui text-[14px] text-[#c5c0b6] leading-relaxed font-normal">
                  Degradado milimétrico, pulido a tijera sobre peine y perfilado con navaja tradicional. Incluye lavado y fijación profesional.
                </p>
              </div>
              <div class="flex items-center justify-between pt-4 mt-4 border-t border-[#d4af37]/20">
                <span class="font-mono-tech text-[20px] font-bold text-[#d4af37]">$25.000 COP</span>
                <span class="font-sans-ui text-xs text-[#a39578]">45 MINUTOS</span>
              </div>
            </div>

            <!-- Card 2: Ritual de Barba -->
            <div class="bg-[#12151b] border border-[#d4af37]/25 rounded-[24px] p-7 flex flex-col justify-between min-h-[240px] hover:border-[#d4af37]/50 transition-all shadow-lg">
              <div>
                <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#a39578] block mb-2">02 / SPA MASCULINO</span>
                <h3 class="font-serif-editorial text-[26px] font-normal text-[#ffffff] mb-2">Barba Esculpida</h3>
                <p class="font-sans-ui text-[14px] text-[#c5c0b6] leading-relaxed font-normal">
                  Ritual de toalla caliente aromatizada con eucalipto, aceite de argán hidratante y alineación geométrica de contornos a navaja.
                </p>
              </div>
              <div class="flex items-center justify-between pt-4 mt-4 border-t border-[#d4af37]/20">
                <span class="font-mono-tech text-[20px] font-bold text-[#d4af37]">$18.000 COP</span>
                <span class="font-sans-ui text-xs text-[#a39578]">35 MINUTOS</span>
              </div>
            </div>

            <!-- Card 3: Combo Imperial -->
            <div class="bg-[#12151b] border border-[#d4af37]/25 rounded-[24px] p-7 flex flex-col justify-between min-h-[240px] hover:border-[#d4af37]/50 transition-all shadow-lg">
              <div>
                <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#a39578] block mb-2">03 / EXPERIENCIA TOTAL</span>
                <h3 class="font-serif-editorial text-[26px] font-normal text-[#ffffff] mb-2">Combo Imperial</h3>
                <p class="font-sans-ui text-[14px] text-[#c5c0b6] leading-relaxed font-normal">
                  Corte integral + Ritual completo de barba + Limpieza e hidratación facial. La experiencia insignia de Barbería Lopez.
                </p>
              </div>
              <div class="flex items-center justify-between pt-4 mt-4 border-t border-[#d4af37]/20">
                <span class="font-mono-tech text-[20px] font-bold text-[#d4af37]">$40.000 COP</span>
                <span class="font-sans-ui text-xs text-[#a39578]">75 MINUTOS</span>
              </div>
            </div>

            <!-- Card 4: Visagismo de Precisión -->
            <div class="bg-[#12151b] border border-[#d4af37]/25 rounded-[24px] p-7 flex flex-col justify-between min-h-[240px] hover:border-[#d4af37]/50 transition-all shadow-lg">
              <div>
                <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#a39578] block mb-2">04 / ASESORÍA ANATÓMICA</span>
                <h3 class="font-serif-editorial text-[26px] font-normal text-[#ffffff] mb-2">Visagismo y Estructura</h3>
                <p class="font-sans-ui text-[14px] text-[#c5c0b6] leading-relaxed font-normal">
                  Estudio anatómico del rostro para definir las líneas de corte que mejor proyectan tus rasgos. Incluido en tu consulta.
                </p>
              </div>
              <div class="flex items-center justify-between pt-4 mt-4 border-t border-[#d4af37]/20">
                <span class="font-sans-ui text-[16px] font-semibold text-[#d4af37]">Incluido</span>
                <span class="font-sans-ui text-xs text-[#a39578]">CONSULTA PREVIA</span>
              </div>
            </div>

            <!-- Card 5: Estaciones de Trabajo -->
            <div class="bg-[#12151b] border border-[#d4af37]/25 rounded-[24px] p-7 flex flex-col justify-between min-h-[240px] hover:border-[#d4af37]/50 transition-all shadow-lg">
              <div>
                <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#a39578] block mb-2">05 / MAESTRÍA & RELEVO</span>
                <h3 class="font-serif-editorial text-[26px] font-normal text-[#ffffff] mb-2">Dos Estaciones Activas</h3>
                <p class="font-sans-ui text-[14px] text-[#c5c0b6] leading-relaxed font-normal">
                  Estación 1: Maestro Lopez (Maestro Barbero & Estilista Clásico). Estación 2: Carlos Andrés (Practicante de Alta Escuela).
                </p>
              </div>
              <div class="flex items-center justify-between pt-4 mt-4 border-t border-[#d4af37]/20">
                <span class="font-sans-ui text-[16px] font-semibold text-[#ffffff]">Neiva, Huila</span>
                <span class="font-sans-ui text-xs text-[#a39578]">PRESENCIAL</span>
              </div>
            </div>

            <!-- Card 6: Conexión Directa -->
            <div class="bg-[#12151b] border border-[#d4af37]/25 rounded-[24px] p-7 flex flex-col justify-between min-h-[240px] hover:border-[#d4af37]/50 transition-all shadow-lg">
              <div>
                <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#a39578] block mb-2">06 / TECNOLOGÍA TRANSPARENTE</span>
                <h3 class="font-serif-editorial text-[26px] font-normal text-[#ffffff] mb-2">Conexión de Calendario</h3>
                <p class="font-sans-ui text-[14px] text-[#c5c0b6] leading-relaxed font-normal">
                  Al confirmar tu turno, obtienes enlace instantáneo a Google Calendar y sincronización nativa para Apple Calendar con recordatorios.
                </p>
              </div>
              <div class="flex items-center justify-between pt-4 mt-4 border-t border-[#d4af37]/20">
                <span class="font-sans-ui text-[14px] font-semibold text-[#f3e5ab]">RFC 5545 Nativo</span>
                <span class="font-mono-tech text-xs text-[#d4af37] font-semibold">EN VIVO</span>
              </div>
            </div>

          </div>
        </section>
      `;
    } else if (state.activeView === 'dashboard' && state.currentUser) {
      const todayStr = getLocalDateString();
      const cashData = CashCalculatorService.calculateDailyCash(state.history, todayStr);
      const isJefe = state.currentUser.role === Roles.JEFE || state.currentUser.role === Roles.ADMIN;

      const visibleAppointments = isJefe
        ? appointments
        : appointments.filter((a) => a.barberId === state.currentUser.barberId);

      // Determinación de los sectores de barbero a desplegar en la agenda de turnos
      let sectorsToRender = [];
      if (isJefe) {
        if (state.dashboardBarberFilter && state.dashboardBarberFilter !== 'ALL') {
          sectorsToRender = barbers.filter((b) => b.id === state.dashboardBarberFilter);
          if (sectorsToRender.length === 0) {
            sectorsToRender = barbers;
          }
        } else {
          sectorsToRender = barbers;
        }
      } else {
        sectorsToRender = barbers.filter((b) => b.id === state.currentUser.barberId);
        if (sectorsToRender.length === 0 && barbers.length > 0) {
          sectorsToRender = [barbers[0]];
        }
      }

      const activeBarberFilterCount = isJefe && state.dashboardBarberFilter !== 'ALL'
        ? appointments.filter((a) => a.barberId === state.dashboardBarberFilter).length
        : visibleAppointments.length;

      const userHistory = isJefe
        ? state.history
        : state.history.filter((h) => h.barberId === state.currentUser.barberId);

      // Cálculo de meses para el filtro del historial
      const currentYear = initialNow.getFullYear();
      const currentMonth = initialNow.getMonth(); // 0-indexed
      const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      
      const prevDateObj = new Date(currentYear, currentMonth - 1, 1);
      const prevMonthStr = `${prevDateObj.getFullYear()}-${String(prevDateObj.getMonth() + 1).padStart(2, '0')}`;

      // Extraer meses únicos disponibles en orden descendente
      const availableMonths = Array.from(new Set(userHistory.map((h) => (h.date || '').substring(0, 7)))).filter(Boolean).sort().reverse();

      // Filtrado del historial según estado
      const filteredHistory = userHistory.filter((h) => {
        const hMonth = (h.date || '').substring(0, 7);
        let matchesMonth = true;
        if (state.historyFilter === 'THIS_MONTH') {
          matchesMonth = hMonth === currentMonthStr;
        } else if (state.historyFilter === 'LAST_MONTH') {
          matchesMonth = hMonth === prevMonthStr;
        } else if (state.historyFilter !== 'ALL') {
          matchesMonth = hMonth === state.historyFilter;
        }

        let matchesSearch = true;
        if (state.historySearch && state.historySearch.trim() !== '') {
          const q = state.historySearch.toLowerCase().trim();
          const barberName = (barbersMap.get(h.barberId) || '').toLowerCase();
          matchesSearch = (h.clientName || '').toLowerCase().includes(q) || barberName.includes(q) || (h.date || '').includes(q);
        }

        return matchesMonth && matchesSearch;
      });

      // Determinación de los sectores de barbero a desplegar en el historial de cortes
      let historySectorsToRender = [];
      if (isJefe) {
        if (state.historyBarberFilter && state.historyBarberFilter !== 'ALL') {
          historySectorsToRender = barbers.filter((b) => b.id === state.historyBarberFilter);
          if (historySectorsToRender.length === 0) {
            historySectorsToRender = barbers;
          }
        } else {
          historySectorsToRender = barbers;
        }
      } else {
        historySectorsToRender = barbers.filter((b) => b.id === state.currentUser.barberId);
        if (historySectorsToRender.length === 0 && barbers.length > 0) {
          historySectorsToRender = [barbers[0]];
        }
      }

      const activeHistoryDisplayCuts = isJefe && state.historyBarberFilter !== 'ALL'
        ? filteredHistory.filter((h) => h.barberId === state.historyBarberFilter)
        : filteredHistory;

      const totalFilteredCop = activeHistoryDisplayCuts.reduce((sum, h) => sum + (h.priceCop || 0), 0);

      mainContent = `
        <section class="max-w-[1240px] mx-auto px-6 md:px-12 py-10 font-sans-ui">
          
          <!-- Encabezado del Perfil -->
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 pb-6 border-b border-[rgba(212,175,55,0.22)]">
            <div>
              <div class="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)] text-[#f3e5ab] text-xs font-semibold">
                <span class="w-2 h-2 rounded-full bg-[#d4af37]"></span>
                <span>${isJefe ? 'Estación Maestra · Control General' : state.currentUser.role === Roles.BARBERO ? 'Estación Barbero · Vista de Turnos' : 'Estación Practicante · Vista Aislada'}</span>
              </div>
              <h2 class="font-serif-editorial text-2xl sm:text-3xl font-normal text-[#ffffff] tracking-tight">
                ${isJefe ? 'Panel de Maestro Lopez' : state.currentUser.role === Roles.BARBERO ? `Panel de ${barbersMap.get(state.currentUser.barberId) || 'Barbero'}` : 'Panel de Barbero Practicante'}
              </h2>
              <p class="font-sans-ui text-[#c5c0b6] text-sm mt-1">
                ${isJefe ? 'Supervisión de cortes, caja consolidada en COP y agenda de turnos organizada por sectores de estación.' : 'Turnos asignados a tu estación e historial personal de cortes.'}
              </p>
            </div>
            <button id="btn-dashboard-back-home" class="btn-stone-outline text-xs font-medium py-2 px-4">
              ← Volver al inicio
            </button>
          </div>

          ${isJefe ? `
            <!-- CAJA CONSOLIDADA HOY (EXCLUSIVO BARBERO JEFE) -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
              <div class="anthropic-card p-6">
                <span class="block text-xs font-semibold text-[#c5c0b6] uppercase tracking-wider mb-2">Caja consolidada hoy</span>
                <div class="text-3xl sm:text-4xl font-mono-tech font-bold text-[#ffffff] tracking-tight">
                  $${cashData.totalConsolidatedCop.toLocaleString('es-CO')} <span class="text-xs font-sans-ui font-semibold text-[#d4af37]">COP</span>
                </div>
                <span class="text-xs font-medium text-[#8a8275] mt-2 block">${cashData.totalCount} cortes completados hoy</span>
              </div>
              ${barbers.map((b) => `
                <div class="anthropic-card p-6">
                  <span class="block text-xs font-semibold text-[#c5c0b6] uppercase tracking-wider mb-2">Estación ${b.name}</span>
                  <div class="text-2xl sm:text-3xl font-mono-tech font-bold text-[#ffffff] tracking-tight">
                    $${(cashData.breakdownByBarber[b.id]?.total || 0).toLocaleString('es-CO')} <span class="text-xs font-sans-ui font-semibold text-[#8a8275]">COP</span>
                  </div>
                  <span class="text-xs font-medium text-[#8a8275] mt-2 block">Cortes realizados: ${cashData.breakdownByBarber[b.id]?.count || 0}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- AGENDA DE TURNOS SECTORIZADA -->
          <div class="mb-12">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[rgba(212,175,55,0.22)]">
              <div>
                <h3 class="font-serif-editorial text-xl sm:text-2xl font-normal text-[#ffffff] tracking-tight">
                  ${isJefe ? 'Agenda de turnos por estación' : 'Mis turnos programados'}
                </h3>
                <p class="font-sans-ui text-xs sm:text-sm text-[#c5c0b6] mt-0.5">
                  ${isJefe ? 'Organización por sectores individuales de barbería para evitar acumulaciones.' : 'Turnos asignados a tu estación de trabajo.'}
                </p>
              </div>
              <span class="text-xs text-[#d4af37] font-semibold font-mono-tech px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)] self-start sm:self-auto">
                ${activeBarberFilterCount} ${activeBarberFilterCount === 1 ? 'turno registrado' : 'turnos registrados'}
              </span>
            </div>

            <!-- TARJETA EXPLICATIVA DE VINCULACIÓN AUTOMÁTICA -->
            <div class="anthropic-card p-4 sm:p-5 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-[rgba(212,175,55,0.35)] bg-gradient-to-r from-[#141720] via-[#161a22] to-[#141720]">
              <div class="flex items-center gap-3.5">
                <div class="w-10 h-10 rounded-full bg-[#181c24] border border-[#d4af37] flex items-center justify-center flex-shrink-0 text-[#d4af37]">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <div>
                  <h4 class="font-serif-editorial text-base sm:text-lg text-[#ffffff] font-normal tracking-tight">
                    Sincronización automática de turnos en tu teléfono
                  </h4>
                  <p class="font-sans-ui text-xs text-[#c5c0b6] mt-0.5">
                    Vincula tu celular una sola vez. Cada nueva cita reservada en la web se agregará automáticamente al calendario de tu teléfono sin que tengas que hacer nada.
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                data-sync-barber-id="${isJefe ? (state.dashboardBarberFilter !== 'ALL' ? state.dashboardBarberFilter : 'all') : state.currentUser.barberId}"
                data-sync-barber-name="${isJefe ? (state.dashboardBarberFilter !== 'ALL' ? (barbersMap.get(state.dashboardBarberFilter) || 'Estación') : 'Todas las estaciones') : (barbersMap.get(state.currentUser.barberId) || 'Mi Estación')}"
                class="btn-sync-mobile-calendar btn-clay py-2 px-4 text-xs font-semibold whitespace-nowrap self-stretch md:self-auto justify-center cursor-pointer">
                Vincular mi celular ahora →
              </button>
            </div>

            ${isJefe ? `
              <!-- SELECTOR DE ESTACIÓN (FILTRO INTERACTIVO) -->
              <div class="flex flex-wrap items-center gap-2 mb-6 p-2 rounded-[12px] bg-[#12151b] border border-[rgba(212,175,55,0.22)]">
                <span class="text-xs font-semibold text-[#8a8275] uppercase tracking-wider px-2 mr-1">Filtrar estación:</span>
                <button 
                  data-dashboard-barber="ALL"
                  class="btn-dashboard-barber px-3.5 py-1.5 rounded-[8px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    state.dashboardBarberFilter === 'ALL'
                      ? 'bg-[#181c24] border border-[#d4af37] text-[#ffffff] shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                      : 'text-[#c5c0b6] hover:text-[#ffffff] hover:bg-[#161a22] border border-transparent'
                  }">
                  <span>Todas las estaciones</span>
                  <span class="text-[10px] font-mono-tech px-1.5 py-0.2 rounded-full ${state.dashboardBarberFilter === 'ALL' ? 'bg-[#d4af37]/20 text-[#f3e5ab]' : 'bg-[#161a22] text-[#8a8275]'}">${appointments.length}</span>
                </button>

                ${barbers.map((b) => {
                  const bCount = appointments.filter((a) => a.barberId === b.id).length;
                  const isSelected = state.dashboardBarberFilter === b.id;
                  return `
                    <button 
                      data-dashboard-barber="${b.id}"
                      class="btn-dashboard-barber px-3.5 py-1.5 rounded-[8px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#181c24] border border-[#d4af37] text-[#ffffff] shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                          : 'text-[#c5c0b6] hover:text-[#ffffff] hover:bg-[#161a22] border border-transparent'
                      }">
                      <span class="w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#d4af37]' : 'bg-[#8a8275]'}"></span>
                      <span>${b.name}</span>
                      <span class="text-[10px] font-mono-tech px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-[#d4af37]/20 text-[#f3e5ab]' : 'bg-[#161a22] text-[#8a8275]'}">${bCount}</span>
                    </button>
                  `;
                }).join('')}
              </div>
            ` : ''}

            <!-- CONTENEDORES DE SECTORES DE ESTACIÓN -->
            <div class="space-y-8">
              ${sectorsToRender.map((b) => {
                const bAppts = appointments.filter((a) => a.barberId === b.id);
                return `
                  <div class="bg-[#12151b] rounded-[16px] border border-[rgba(212,175,55,0.22)] p-5 sm:p-6 shadow-sm">
                    
                    <!-- ENCABEZADO DEL SECTOR -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-[rgba(212,175,55,0.14)]">
                      <div class="flex items-center gap-3.5">
                        ${b.avatar ? `
                          <img src="${b.avatar}" alt="${b.name}" class="w-12 h-12 rounded-full object-cover border-2 border-[rgba(212,175,55,0.4)] shadow-md">
                        ` : `
                          <div class="w-12 h-12 rounded-full bg-[#181c24] border-2 border-[rgba(212,175,55,0.4)] flex items-center justify-center font-serif-editorial text-lg text-[#d4af37]">
                            ${b.name.charAt(0)}
                          </div>
                        `}
                        <div>
                          <div class="flex items-center gap-2 mb-0.5">
                            <span class="text-[10px] font-mono-tech uppercase tracking-wider text-[#d4af37] font-semibold bg-[#181c24] px-2 py-0.5 rounded border border-[rgba(212,175,55,0.2)]">
                              Sector de Estación
                            </span>
                          </div>
                          <h4 class="font-serif-editorial text-xl font-normal text-[#ffffff] tracking-tight">
                            ${b.name}
                          </h4>
                          <p class="text-xs text-[#c5c0b6] font-sans-ui">${b.specialty || 'Barbero Profesional'}</p>
                        </div>
                      </div>

                      <div class="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                        <button 
                          type="button" 
                          data-sync-barber-id="${b.id}"
                          data-sync-barber-name="${b.name}"
                          class="btn-sync-mobile-calendar inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181c24] border border-[#d4af37] text-xs font-semibold text-[#f3e5ab] hover:text-[#ffffff] hover:bg-[#d4af37]/20 transition-all cursor-pointer shadow-[0_0_10px_rgba(212,175,55,0.15)]">
                          <svg class="w-3.5 h-3.5 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                          <span>Sincronizar celular</span>
                        </button>

                        <span class="text-xs font-medium px-3 py-1 rounded-full ${
                          bAppts.length > 0 
                            ? 'bg-[#181c24] text-[#f3e5ab] border border-[rgba(212,175,55,0.3)]' 
                            : 'bg-[#161a22] text-[#8a8275] border border-stone-800'
                        }">
                          ${bAppts.length} ${bAppts.length === 1 ? 'turno asignado' : 'turnos asignados'}
                        </span>
                      </div>
                    </div>

                    <!-- GRID DE TURNOS DEL SECTOR -->
                    ${bAppts.length === 0 ? `
                      <div class="text-center py-8 px-4 bg-[#161a22]/50 rounded-[10px] border border-dashed border-[rgba(212,175,55,0.14)]">
                        <p class="font-serif-editorial text-base text-[#c5c0b6]">Sin turnos programados en este sector</p>
                        <p class="font-sans-ui text-xs text-[#8a8275] mt-1">Los turnos reservados con ${b.name} aparecerán aquí automáticamente.</p>
                      </div>
                    ` : `
                      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${bAppts.map((appt) => {
                          const isCompleted = appt.status === 'COMPLETADA';
                          const serviceObj = services.find((s) => s.id === appt.serviceId);
                          const serviceName = serviceObj ? serviceObj.name : 'Corte Tradicional';
                          const servicePrice = serviceObj ? serviceObj.priceCop : 0;
                          return `
                            <div class="anthropic-card p-5 flex flex-col justify-between ${isCompleted ? 'border-[rgba(212,175,55,0.15)] bg-[#14171f]' : 'border-[rgba(212,175,55,0.3)] bg-[#161a22]'}">
                              <div>
                                <div class="flex items-center justify-between gap-2 mb-3">
                                  <span class="text-xs font-mono-tech font-bold text-[#f3e5ab] bg-[#12151b] px-2 py-0.5 rounded border border-[rgba(212,175,55,0.2)]">
                                    ${appt.startTime} — ${appt.endTime}
                                  </span>
                                  <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                                    isCompleted 
                                      ? 'bg-[#181c24] border border-[rgba(212,175,55,0.3)] text-[#d4af37]' 
                                      : 'bg-[#12151b] border border-[rgba(212,175,55,0.22)] text-[#c5c0b6]'
                                  }">
                                    ${isCompleted ? '<span class="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></span>' : ''}
                                    ${appt.status}
                                  </span>
                                </div>

                                <h5 class="text-base sm:text-lg font-bold text-[#ffffff] tracking-tight mb-1">
                                  ${appt.clientName}
                                </h5>
                                
                                <p class="text-xs font-medium text-[#d4af37] mb-3">
                                  ${serviceName} ${servicePrice > 0 ? `· $${servicePrice.toLocaleString('es-CO')} COP` : ''}
                                </p>

                                <div class="space-y-1.5 mb-4 text-xs font-sans-ui bg-[#12151b]/70 p-3 rounded-[8px] border border-[rgba(212,175,55,0.1)]">
                                  <div class="flex items-center justify-between text-[#ffffff]">
                                    <span class="text-[#8a8275] font-semibold">Teléfono:</span>
                                    <span class="font-medium text-[#c5c0b6]">${appt.clientPhone || 'No registrado'}</span>
                                  </div>
                                  <div class="flex items-center justify-between text-[#ffffff]">
                                    <span class="text-[#8a8275] font-semibold">Fecha:</span>
                                    <span class="font-medium text-[#c5c0b6]">${appt.date}</span>
                                  </div>
                                  <div class="flex items-center justify-between text-[#ffffff]">
                                    <span class="text-[#8a8275] font-semibold">Pago:</span>
                                    <span class="font-medium text-[#c5c0b6]">${appt.paymentMethod}</span>
                                  </div>
                                </div>
                              </div>

                              ${!isCompleted ? `
                                <button data-appt-id="${appt.id}" class="btn-complete-cut btn-clay w-full py-2.5 px-4 text-xs font-semibold justify-center">
                                  Finalizar corte y guardar en historial →
                                </button>
                              ` : `
                                <div class="text-xs font-semibold text-[#d4af37] py-2 text-center bg-[#181c24] border border-[rgba(212,175,55,0.3)] rounded-[8px]">
                                  Corte registrado en base de datos
                                </div>
                              `}
                            </div>
                          `;
                        }).join('')}
                      </div>
                    `}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- HISTORIAL EN BASE DE DATOS CON FILTRO POR MES Y SECTORES -->
          <div>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-2 border-b border-[rgba(212,175,55,0.18)]">
              <div>
                <h3 class="font-serif-editorial text-xl sm:text-2xl font-normal text-[#ffffff] tracking-tight">
                  ${isJefe ? 'Historial general en base de datos' : 'Mi historial de cortes'}
                </h3>
                <p class="text-[#c5c0b6] text-xs sm:text-sm mt-0.5 font-sans-ui">
                  ${isJefe ? 'Registro histórico organizado por sectores de estación con balances individuales y consolidados en COP.' : 'Registro histórico personal de clientes atendidos, fechas, horarios y valor cobrado.'}
                </p>
              </div>
            </div>

            <!-- BARRA DE FILTROS DEL HISTORIAL (MES + BUSCADOR + KPI) -->
            <div class="anthropic-card p-4 mb-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              
              <!-- Botones de filtro rápido por mes -->
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs font-semibold text-[#8a8275] uppercase tracking-wider mr-1">Período:</span>
                
                <button 
                  type="button" 
                  data-history-filter="ALL" 
                  class="btn-history-filter px-3.5 py-1.5 rounded-[8px] text-xs font-semibold transition-all ${state.historyFilter === 'ALL' ? 'btn-clay' : 'btn-stone-outline'}">
                  Todos (${userHistory.length})
                </button>

                <button 
                  type="button" 
                  data-history-filter="THIS_MONTH" 
                  class="btn-history-filter px-3.5 py-1.5 rounded-[8px] text-xs font-semibold transition-all ${state.historyFilter === 'THIS_MONTH' ? 'btn-clay' : 'btn-stone-outline'}">
                  Este mes (${MONTH_NAMES[currentMonth]})
                </button>

                <button 
                  type="button" 
                  data-history-filter="LAST_MONTH" 
                  class="btn-history-filter px-3.5 py-1.5 rounded-[8px] text-xs font-semibold transition-all ${state.historyFilter === 'LAST_MONTH' ? 'btn-clay' : 'btn-stone-outline'}">
                  Mes pasado (${MONTH_NAMES[prevDateObj.getMonth()]})
                </button>

                <!-- Selector dropdown de mes específico -->
                <select id="select-history-month" class="bg-[#161a22] text-[#ffffff] border border-[rgba(212,175,55,0.3)] rounded-[8px] px-3 py-1.5 text-xs font-medium outline-none focus:border-[#d4af37]">
                  <option value="ALL" ${state.historyFilter === 'ALL' ? 'selected' : ''}>Seleccionar mes...</option>
                  <option value="THIS_MONTH" ${state.historyFilter === 'THIS_MONTH' ? 'selected' : ''}>Este mes (${MONTH_NAMES[currentMonth]} ${currentYear})</option>
                  <option value="LAST_MONTH" ${state.historyFilter === 'LAST_MONTH' ? 'selected' : ''}>Mes pasado (${MONTH_NAMES[prevDateObj.getMonth()]} ${prevDateObj.getFullYear()})</option>
                  ${availableMonths.filter((m) => m !== currentMonthStr && m !== prevMonthStr).map((m) => {
                    const [y, mo] = m.split('-');
                    const monthName = MONTH_NAMES[parseInt(mo, 10) - 1] || m;
                    return `<option value="${m}" ${state.historyFilter === m ? 'selected' : ''}>${monthName} ${y}</option>`;
                  }).join('')}
                </select>
              </div>

              <!-- Buscador por texto y KPI acumulado -->
              <div class="flex items-center gap-3">
                <div class="relative flex-1 sm:w-60">
                  <input 
                    type="text" 
                    id="input-history-search" 
                    placeholder="Buscar cliente o fecha..." 
                    value="${state.historySearch || ''}"
                    class="input-parchment pl-8 pr-3 py-1.5 text-xs">
                  <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a8275] text-xs">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  </span>
                </div>
                <div class="text-right whitespace-nowrap pl-2 border-l border-[rgba(212,175,55,0.22)]">
                  <span class="block text-xs font-bold text-[#ffffff]">${activeHistoryDisplayCuts.length} cortes</span>
                  <span class="block text-xs font-bold font-mono-tech text-[#d4af37]">$${totalFilteredCop.toLocaleString('es-CO')} COP</span>
                </div>
              </div>

            </div>

            ${isJefe ? `
              <!-- SELECTOR DE ESTACIÓN EN HISTORIAL (FILTRO INTERACTIVO) -->
              <div class="flex flex-wrap items-center gap-2 mb-6 p-2 rounded-[12px] bg-[#12151b] border border-[rgba(212,175,55,0.22)]">
                <span class="text-xs font-semibold text-[#8a8275] uppercase tracking-wider px-2 mr-1">Filtrar estación:</span>
                <button 
                  type="button"
                  data-history-barber="ALL"
                  class="btn-history-barber px-3.5 py-1.5 rounded-[8px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    state.historyBarberFilter === 'ALL'
                      ? 'bg-[#181c24] border border-[#d4af37] text-[#ffffff] shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                      : 'text-[#c5c0b6] hover:text-[#ffffff] hover:bg-[#161a22] border border-transparent'
                  }">
                  <span>Todas las estaciones</span>
                  <span class="text-[10px] font-mono-tech px-1.5 py-0.2 rounded-full ${state.historyBarberFilter === 'ALL' ? 'bg-[#d4af37]/20 text-[#f3e5ab]' : 'bg-[#161a22] text-[#8a8275]'}">${filteredHistory.length}</span>
                </button>

                ${barbers.map((b) => {
                  const bCutsCount = filteredHistory.filter((h) => h.barberId === b.id).length;
                  const isSelected = state.historyBarberFilter === b.id;
                  return `
                    <button 
                      type="button"
                      data-history-barber="${b.id}"
                      class="btn-history-barber px-3.5 py-1.5 rounded-[8px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#181c24] border border-[#d4af37] text-[#ffffff] shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                          : 'text-[#c5c0b6] hover:text-[#ffffff] hover:bg-[#161a22] border border-transparent'
                      }">
                      <span class="w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#d4af37]' : 'bg-[#8a8275]'}"></span>
                      <span>${b.name}</span>
                      <span class="text-[10px] font-mono-tech px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-[#d4af37]/20 text-[#f3e5ab]' : 'bg-[#161a22] text-[#8a8275]'}">${bCutsCount}</span>
                    </button>
                  `;
                }).join('')}
              </div>
            ` : ''}

            <!-- SECTORES DE HISTORIAL POR ESTACIÓN -->
            <div class="space-y-8">
              ${historySectorsToRender.map((b) => {
                const bCuts = filteredHistory.filter((h) => h.barberId === b.id);
                const bTotalCop = bCuts.reduce((sum, h) => sum + (h.priceCop || 0), 0);
                return `
                  <div class="bg-[#12151b] rounded-[16px] border border-[rgba(212,175,55,0.22)] p-5 sm:p-6 shadow-sm">
                    
                    <!-- ENCABEZADO DEL SECTOR DE HISTORIAL -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-[rgba(212,175,55,0.14)]">
                      <div class="flex items-center gap-3.5">
                        ${b.avatar ? `
                          <img src="${b.avatar}" alt="${b.name}" class="w-12 h-12 rounded-full object-cover border-2 border-[rgba(212,175,55,0.4)] shadow-md">
                        ` : `
                          <div class="w-12 h-12 rounded-full bg-[#181c24] border-2 border-[rgba(212,175,55,0.4)] flex items-center justify-center font-serif-editorial text-lg text-[#d4af37]">
                            ${b.name.charAt(0)}
                          </div>
                        `}
                        <div>
                          <div class="flex items-center gap-2 mb-0.5">
                            <span class="text-[10px] font-mono-tech uppercase tracking-wider text-[#d4af37] font-semibold bg-[#181c24] px-2 py-0.5 rounded border border-[rgba(212,175,55,0.2)]">
                              Historial de Estación
                            </span>
                          </div>
                          <h4 class="font-serif-editorial text-xl font-normal text-[#ffffff] tracking-tight">
                            ${b.name}
                          </h4>
                          <p class="text-xs text-[#c5c0b6] font-sans-ui">${b.specialty || 'Barbero Profesional'}</p>
                        </div>
                      </div>

                      <div class="flex items-center gap-3 self-start sm:self-auto">
                        <span class="text-xs font-medium px-3 py-1 rounded-full ${
                          bCuts.length > 0 
                            ? 'bg-[#181c24] text-[#f3e5ab] border border-[rgba(212,175,55,0.3)]' 
                            : 'bg-[#161a22] text-[#8a8275] border border-stone-800'
                        }">
                          ${bCuts.length} ${bCuts.length === 1 ? 'corte registrado' : 'cortes registrados'}
                        </span>
                        <div class="text-right">
                          <span class="text-xs font-bold font-mono-tech text-[#d4af37] bg-[#181c24] px-3 py-1 rounded-full border border-[rgba(212,175,55,0.25)]">
                            $${bTotalCop.toLocaleString('es-CO')} COP
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- TABLA DE CORTES DE ESTA ESTACIÓN -->
                    ${bCuts.length === 0 ? `
                      <div class="text-center py-8 px-4 bg-[#161a22]/50 rounded-[10px] border border-dashed border-[rgba(212,175,55,0.14)]">
                        <p class="font-serif-editorial text-base text-[#c5c0b6]">Sin cortes registrados en este período</p>
                        <p class="font-sans-ui text-xs text-[#8a8275] mt-1">Los cortes finalizados por ${b.name} aparecerán archivados aquí automáticamente.</p>
                      </div>
                    ` : `
                      <div class="anthropic-card p-0 overflow-hidden border border-[rgba(212,175,55,0.18)]">
                        <div class="overflow-x-auto">
                          <table class="w-full text-left border-collapse font-sans-ui">
                            <thead class="border-b border-[rgba(212,175,55,0.22)] bg-[#161a22] text-xs font-semibold text-[#c5c0b6] uppercase tracking-wider">
                              <tr>
                                <th class="p-3.5 pl-4">Cliente</th>
                                <th class="p-3.5">Fecha</th>
                                <th class="p-3.5">Hora</th>
                                <th class="p-3.5 text-right pr-4">Valor cobrado</th>
                              </tr>
                            </thead>
                            <tbody class="divide-y divide-[rgba(212,175,55,0.12)] text-sm">
                              ${bCuts.map((h) => `
                                <tr class="history-cut-row hover:bg-[#181c24] transition-colors">
                                  <td class="p-3.5 pl-4 text-[#ffffff] font-semibold">${h.clientName}</td>
                                  <td class="p-3.5 text-[#c5c0b6] text-xs sm:text-sm">${formatDateFriendly(h.date)}</td>
                                  <td class="p-3.5 text-[#f3e5ab] font-mono-tech text-xs">${h.time}</td>
                                  <td class="p-3.5 pr-4 text-right text-[#d4af37] font-bold font-mono-tech text-sm">$${h.priceCop.toLocaleString('es-CO')} COP</td>
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    `}
                  </div>
                `;
              }).join('')}
            </div>

          </div>

        </section>
      `;
    } else if (state.activeView === 'admin' && state.currentUser) {
      mainContent = `
        <section class="max-w-[1240px] mx-auto px-6 md:px-12 py-10 font-sans-ui">
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 pb-6 border-b border-[rgba(212,175,55,0.22)]">
            <div>
              <div class="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)] text-[#f3e5ab] text-xs font-semibold">
                <span class="w-2 h-2 rounded-full bg-[#d4af37]"></span>
                <span>Modo Incógnito · Superadministrador</span>
              </div>
              <h2 class="font-serif-editorial text-2xl sm:text-3xl font-normal text-[#ffffff] tracking-tight">
                Gestión de usuarios y contraseñas
              </h2>
              <p class="text-[#c5c0b6] text-sm mt-1">
                Crea perfiles de barberos, asigna o cambia sus contraseñas y administra permisos de forma invisible.
              </p>
            </div>
            <button id="btn-admin-back-home" class="btn-stone-outline text-xs font-medium py-2 px-4">← Volver al inicio</button>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <!-- CREAR BARBERO -->
            <div class="anthropic-card p-6">
              <h3 class="font-serif-editorial text-lg font-normal text-[#ffffff] mb-1">Nuevo barbero</h3>
              <p class="text-xs text-[#c5c0b6] mb-5">Registra un barbero y sus credenciales de acceso.</p>
              <form id="form-create-barber" class="space-y-4">
                <div>
                  <label class="block text-xs font-semibold text-[#c5c0b6] mb-1.5">Nombre completo</label>
                  <input type="text" id="new-barber-name" required placeholder="Ej. Mateo Valencia" class="input-parchment text-sm">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-[#c5c0b6] mb-1.5">Especialidad</label>
                  <input type="text" id="new-barber-spec" placeholder="Ej. Degradados & Barba" class="input-parchment text-sm">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-[#c5c0b6] mb-1.5">Teléfono</label>
                  <input type="tel" id="new-barber-phone" placeholder="+57 300 000 0000" class="input-parchment text-sm">
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-semibold text-[#c5c0b6] mb-1.5">Usuario</label>
                    <input type="text" id="new-barber-username" required placeholder="mateo.barber" class="input-parchment text-sm">
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-[#c5c0b6] mb-1.5">Rol</label>
                    <select id="new-barber-role" class="input-parchment text-sm">
                      <option value="BARBERO">Barbero</option>
                      <option value="JEFE">Barbero Jefe</option>
                      <option value="PRACTICANTE">Practicante</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-[#c5c0b6] mb-1.5">Contraseña asignada</label>
                  <input type="password" id="new-barber-password" required placeholder="Clave de acceso" class="input-parchment text-sm">
                </div>
                <button type="submit" class="btn-clay w-full mt-3 justify-center text-sm font-semibold">Crear cuenta de barbero →</button>
              </form>
            </div>

            <!-- LISTA DE CUENTAS Y CAMBIO DE CONTRASEÑA -->
            <div class="lg:col-span-2 anthropic-card p-6">
              <h3 class="font-serif-editorial text-lg font-normal text-[#ffffff] mb-1">Directorio de cuentas y contraseñas</h3>
              <p class="text-xs text-[#c5c0b6] mb-5">Cambia la contraseña de cualquier barbero, modifica su estado o elimina cuentas del sistema.</p>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse font-sans-ui">
                  <thead class="border-b border-[rgba(212,175,55,0.22)] bg-[#161a22] text-xs font-semibold text-[#c5c0b6] uppercase tracking-wider">
                    <tr>
                      <th class="p-3.5">Nombre</th>
                      <th class="p-3.5">Usuario</th>
                      <th class="p-3.5">Rol</th>
                      <th class="p-3.5">Estado</th>
                      <th class="p-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[rgba(212,175,55,0.15)] text-sm">
                    ${users.map((u) => {
                      const barber = u.barberId ? barbersMap.get(u.barberId) : null;
                      const name = barber || (u.role === 'ADMIN' ? 'Fabián (Admin Incógnito)' : 'Personal');
                      const roleLabels = {
                        ADMIN: 'Administrador',
                        JEFE: 'Barbero Jefe',
                        BARBERO: 'Barbero',
                        PRACTICANTE: 'Practicante'
                      };
                      const roleDisplay = roleLabels[u.role] || u.role;
                      return `
                        <tr class="hover:bg-[#181c24] transition-colors">
                          <td class="p-3.5 text-[#ffffff] font-semibold">${name}</td>
                          <td class="p-3.5 font-mono-tech text-xs text-[#f3e5ab]">@${u.username}</td>
                          <td class="p-3.5"><span class="text-xs font-medium px-2.5 py-0.5 rounded-full bg-[#161a22] border border-[rgba(212,175,55,0.25)] text-[#f3e5ab]">${roleDisplay}</span></td>
                          <td class="p-3.5">
                            <span class="inline-flex items-center gap-1.5 text-xs font-medium text-[#ffffff]">
                              <span class="w-2 h-2 rounded-full ${u.active ? 'bg-[#d4af37]' : 'bg-[#8a8275]'}"></span>
                              ${u.active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td class="p-3.5 text-right space-x-2 whitespace-nowrap">
                            <button data-user-id="${u.id}" data-username="${u.username}" class="btn-change-password btn-stone-outline py-1 px-2.5 text-xs font-medium">Cambiar clave</button>
                            ${u.role !== 'ADMIN' ? `
                              <button data-toggle-user-id="${u.id}" class="btn-toggle-status btn-stone-outline py-1 px-2.5 text-xs font-medium">
                                ${u.active ? 'Desactivar' : 'Activar'}
                              </button>
                              <button data-delete-user-id="${u.id}" data-username="${u.username}" class="btn-delete-user btn-stone-outline py-1 px-2.5 text-xs font-medium text-red-400 hover:text-red-300 hover:border-red-500">
                                Eliminar
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

    root.innerHTML = `
      <!-- TOP EDITORIAL NAVIGATION BAR (Obsidian & Imperial Gold) -->
      <header class="anthropic-nav">
        <div class="max-w-[1240px] mx-auto flex items-center justify-between">
          
          <!-- Far Left: Circular Avatar (Logo Oficial) + Wordmark -->
          <a href="#hero" class="flex items-center gap-3 no-underline" id="nav-brand">
            <img src="./logo_barberia_lopez_hd.jpg" alt="Barbería Lopez" class="w-9 h-9 rounded-full object-cover border border-[rgba(212,175,55,0.4)]">
            <div class="flex flex-col">
              <span class="font-serif-editorial text-xl font-normal tracking-tight text-[#ffffff] leading-none">Barbería Lopez</span>
              <span class="font-sans-ui text-[11px] font-semibold text-[#d4af37] tracking-wider mt-0.5">NEIVA, HUILA · 2026</span>
            </div>
          </a>

          <!-- Center: Navigation Links -->
          <nav class="hidden md:flex items-center gap-8">
            <a href="#hero" class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#c5c0b6] hover:text-[#d4af37] transition-colors">INICIO</a>
            <a href="#calendario" class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#c5c0b6] hover:text-[#d4af37] transition-colors">CALENDARIO</a>
            <a href="#servicios" class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#c5c0b6] hover:text-[#d4af37] transition-colors">SERVICIOS</a>
            <a href="https://wa.me/573219897910" target="_blank" class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#f3e5ab] hover:text-[#d4af37] transition-colors link-editorial">WHATSAPP</a>
          </nav>

          <!-- Far Right: Auth & Action Button -->
          <div class="flex items-center gap-3">
            ${!isAuth ? `
              <button id="btn-login-trigger" class="btn-stone-outline py-2 px-3.5 text-xs">
                Acceder
              </button>
              <a href="#calendario" class="btn-clay py-2 px-4 text-xs font-medium">
                Reservar cita →
              </a>
            ` : `
              <span class="font-sans-ui text-xs font-semibold text-[#f3e5ab] px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)]">
                @${state.currentUser.username}
              </span>
              ${state.activeView !== 'home' ? `
                <button id="btn-nav-home" class="btn-stone-outline py-2 px-3.5 text-xs">Inicio</button>
              ` : `
                <button id="btn-nav-panel" class="btn-clay py-2 px-3.5 text-xs">Mi panel →</button>
              `}
              <button id="btn-logout" class="btn-stone-outline py-2 px-3 text-xs" title="Salir">Salir</button>
            `}
          </div>

        </div>
      </header>

      <!-- MAIN CANVAS -->
      <main>${mainContent}</main>

      <!-- FOOTER INVERSION (Charcoal Deep & Imperial Gold) -->
      <footer class="anthropic-footer mt-20">
        <div class="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div class="inline-flex items-center gap-2.5">
            <span class="w-2 h-2 rounded-full bg-[#d4af37]"></span>
            <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#f3e5ab]">ESTACIONES ACTIVAS · NEIVA, HUILA</span>
          </div>
          <div class="font-sans-ui text-[13px] text-[#8a8275] text-center">
            Barbería Lopez — Línea oficial +57 321 989 7910 · TikTok @barber_lopez_neiva
          </div>
          <a href="#calendario" class="btn-clay py-2 px-4 text-xs font-medium">
            Reservar turno →
          </a>
        </div>
      </footer>

      <!-- MODAL DE ACCESO DE PERSONAL (Obsidian & Imperial Gold) -->
      <div id="modal-auth" class="fixed inset-0 z-50 bg-[#0a0b0d]/80 backdrop-blur-sm flex items-center justify-center p-4 hidden">
        <div class="anthropic-card w-full max-w-md p-6 sm:p-8 relative">
          <button id="btn-close-auth" class="absolute top-4 right-4 text-[#c5c0b6] hover:text-[#ffffff] text-xl font-light">&times;</button>

          <div class="mb-6">
            <h3 class="font-serif-editorial text-[28px] font-normal text-[#ffffff]">Acceso de personal</h3>
            <p class="font-sans-ui text-sm text-[#c5c0b6] mt-1">Ingresa con el usuario y contraseña asignados por el administrador.</p>
          </div>

          <form id="form-login" class="space-y-4">
            <div>
              <label class="block font-sans-ui text-xs font-semibold text-[#c5c0b6] mb-1.5">Usuario</label>
              <input type="text" id="login-username" required placeholder="" class="input-parchment">
            </div>
            <div>
              <label class="block font-sans-ui text-xs font-semibold text-[#c5c0b6] mb-1.5">Contraseña</label>
              <input type="password" id="login-password" required placeholder="••••••••" class="input-parchment">
            </div>
            <div id="login-error-msg" class="font-sans-ui text-xs text-red-400 bg-red-950/50 border border-red-800 p-3 rounded-[8px] hidden"></div>
            <button type="submit" class="btn-clay w-full py-3 justify-center text-sm font-semibold">Ingresar al sistema →</button>
          </form>
        </div>
      </div>

      <!-- MODAL DE FORMULARIO DE AGENDAMIENTO Y DATOS PERSONALES -->
      <div id="modal-client-booking" class="fixed inset-0 z-50 bg-[#0a0b0d]/80 backdrop-blur-sm flex items-center justify-center p-4 ${state.bookingModalOpen ? '' : 'hidden'}">
        <div class="anthropic-card w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 relative">
          <button id="btn-close-client-booking" class="absolute top-4 right-4 text-[#c5c0b6] hover:text-[#ffffff] text-xl font-light">&times;</button>

          <div class="mb-6">
            <div class="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)] text-[#f3e5ab] text-xs font-semibold">
              <span class="w-2 h-2 rounded-full bg-[#d4af37]"></span>
              <span>02 / RESERVA DE TURNO</span>
            </div>
            <h3 class="font-serif-editorial text-[30px] sm:text-[34px] font-normal leading-tight text-[#ffffff] mb-1">Completar reserva de cita</h3>
            <div class="inline-block px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)] font-mono-tech text-xs text-[#f3e5ab] font-bold mt-1">
              ${formatDateFriendly(state.bookingForm.date)} · ${formatTime12h(state.bookingForm.startTime)}
            </div>
          </div>

          <form id="form-client-booking" class="space-y-6">
            
            <!-- 1. SELECCIÓN DE BARBERO -->
            <div>
              <label class="block font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#d4af37] mb-2">1. Selecciona tu Barbero</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${publicBarbers.map((b) => {
                  const isSelected = state.bookingForm.barberId === b.id;
                  return `
                    <div 
                      data-modal-barber-id="${b.id}" 
                      class="barber-modal-choice p-3.5 rounded-[12px] border cursor-pointer flex items-center gap-3 transition-all ${isSelected ? 'border-[#d4af37] bg-[rgba(212,175,55,0.14)] shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'border-[rgba(212,175,55,0.22)] bg-[#161a22] hover:border-[#d4af37]'}">
                      <img src="${b.avatar || './logo_barberia_lopez_hd.jpg'}" alt="${b.name}" class="w-11 h-11 rounded-full object-cover border border-[rgba(212,175,55,0.35)]">
                      <div class="flex-1">
                        <div class="font-sans-ui font-semibold text-[#ffffff] text-[14px]">${b.name}</div>
                        <div class="font-sans-ui text-[#c5c0b6] text-[11px] mt-0.5">${b.specialty}</div>
                      </div>
                      <span class="w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#d4af37] bg-[#d4af37]' : 'border-[rgba(212,175,55,0.35)]'}">
                        ${isSelected ? '<span class="w-1.5 h-1.5 rounded-full bg-[#0a0b0d]"></span>' : ''}
                      </span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- 2. SELECCIÓN DE CORTE O COMBO -->
            <div>
              <label class="block font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#d4af37] mb-2">2. Selecciona el Corte o Combo</label>
              <div id="service-modal-list" class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                ${services.map((s) => {
                  const isSelected = state.bookingForm.serviceId === s.id;
                  return `
                    <div 
                      data-modal-service-id="${s.id}" 
                      class="service-modal-choice p-3.5 rounded-[12px] border cursor-pointer flex flex-col justify-between transition-all ${isSelected ? 'border-[#d4af37] bg-[rgba(212,175,55,0.14)] shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'border-[rgba(212,175,55,0.22)] bg-[#161a22] hover:border-[#d4af37]'}">
                      <div class="flex items-center justify-between gap-1 mb-1">
                        <span class="font-sans-ui font-semibold text-[#ffffff] text-[14px]">${s.name}</span>
                        <span class="font-mono-tech font-bold text-[#d4af37] text-sm">$${s.priceCop.toLocaleString('es-CO')}</span>
                      </div>
                      <div class="font-sans-ui text-[#c5c0b6] text-[11px]">
                        ${s.durationMinutes} MIN · ${s.category.toUpperCase()}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- 3. DATOS PERSONALES NECESARIOS -->
            <div class="pt-4 border-t border-[rgba(212,175,55,0.22)]">
              <label class="block font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#d4af37] mb-3">3. Tus Datos Personales</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label class="block font-sans-ui text-xs font-semibold text-[#c5c0b6] mb-1">Nombre completo *</label>
                  <input 
                    type="text" 
                    id="client-booking-name" 
                    required 
                    value="${state.bookingForm.clientName}" 
                    placeholder="Ej. Camilo Andrés Pérez" 
                    class="input-parchment"
                  >
                </div>
                <div>
                  <label class="block font-sans-ui text-xs font-semibold text-[#c5c0b6] mb-1">Teléfono móvil / WhatsApp *</label>
                  <input 
                    type="tel" 
                    id="client-booking-phone" 
                    required 
                    value="${state.bookingForm.clientPhone}" 
                    placeholder="Ej. 321 989 7910" 
                    class="input-parchment"
                  >
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label class="block font-sans-ui text-xs font-semibold text-[#c5c0b6] mb-1">Correo electrónico (opcional)</label>
                  <input 
                    type="email" 
                    id="client-booking-email" 
                    value="${state.bookingForm.clientEmail || ''}" 
                    placeholder="Para invitación a calendario" 
                    class="input-parchment"
                  >
                </div>
                <div>
                  <label class="block font-sans-ui text-xs font-semibold text-[#c5c0b6] mb-1">Petición especial o estilo (opcional)</label>
                  <input 
                    type="text" 
                    id="client-booking-notes" 
                    value="${state.bookingForm.clientNotes || ''}" 
                    placeholder="Ej. Fade medio, barba perfilada" 
                    class="input-parchment"
                  >
                </div>
              </div>
            </div>

            <!-- SUBMIT -->
            <div class="pt-5 border-t border-[rgba(212,175,55,0.22)] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="inline-flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-[#d4af37]"></span>
                <span class="font-sans-ui text-xs font-semibold text-[#f3e5ab]">SINCRONIZACIÓN DIRECTA CON TU CALENDARIO</span>
              </div>
              <button type="submit" class="btn-clay px-7 py-3 w-full sm:w-auto justify-center font-medium">
                Agendar cita y conectar calendario →
              </button>
            </div>

          </form>
        </div>
      </div>

      <!-- CONTENEDOR MODAL DE CONFIRMACIÓN -->
      <div id="modal-confirmation-container"></div>
    `;

    bindEvents(users, barbers, services);
  }

  // --- EVENTOS INTERACTIVOS ---
  function bindEvents(users, barbers, services) {
    const btnLoginTrigger = document.getElementById('btn-login-trigger');
    const modalAuth = document.getElementById('modal-auth');
    const btnCloseAuth = document.getElementById('btn-close-auth');

    if (btnLoginTrigger && modalAuth) btnLoginTrigger.onclick = () => modalAuth.classList.remove('hidden');
    if (btnCloseAuth && modalAuth) btnCloseAuth.onclick = () => modalAuth.classList.add('hidden');

    document.querySelectorAll('.quick-fill-btn').forEach((btn) => {
      btn.onclick = () => {
        document.getElementById('login-username').value = btn.dataset.u;
        document.getElementById('login-password').value = btn.dataset.p;
      };
    });

    const formLogin = document.getElementById('form-login');
    if (formLogin) {
      formLogin.onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorMsg = document.getElementById('login-error-msg');
        try {
          const { user } = await loginUseCase.execute({ username, password });
          modalAuth.classList.add('hidden');
          state.currentUser = user;
          state.activeView = user.role === Roles.ADMIN ? 'admin' : 'dashboard';
          renderApp();
        } catch (err) {
          errorMsg.textContent = err.message;
          errorMsg.classList.remove('hidden');
        }
      };
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.onclick = () => {
        state.currentUser = null;
        state.activeView = 'home';
        renderApp();
      };
    }

    const btnNavHome = document.getElementById('btn-nav-home');
    if (btnNavHome) btnNavHome.onclick = () => { state.activeView = 'home'; renderApp(); };

    const btnNavPanel = document.getElementById('btn-nav-panel');
    if (btnNavPanel) {
      btnNavPanel.onclick = () => {
        state.activeView = state.currentUser?.role === Roles.ADMIN ? 'admin' : 'dashboard';
        renderApp();
      };
    }

    const btnBackHome1 = document.getElementById('btn-dashboard-back-home');
    if (btnBackHome1) btnBackHome1.onclick = () => { state.activeView = 'home'; renderApp(); };

    const btnBackHome2 = document.getElementById('btn-admin-back-home');
    if (btnBackHome2) btnBackHome2.onclick = () => { state.activeView = 'home'; renderApp(); };

    // Controles de mes del calendario
    const btnPrev = document.getElementById('cal-btn-prev');
    if (btnPrev) {
      btnPrev.onclick = () => {
        state.calendarMonth--;
        if (state.calendarMonth < 0) {
          state.calendarMonth = 11;
          state.calendarYear--;
        }
        renderApp();
      };
    }

    const btnNext = document.getElementById('cal-btn-next');
    if (btnNext) {
      btnNext.onclick = () => {
        state.calendarMonth++;
        if (state.calendarMonth > 11) {
          state.calendarMonth = 0;
          state.calendarYear++;
        }
        renderApp();
      };
    }

    const btnToday = document.getElementById('cal-btn-today');
    if (btnToday) {
      btnToday.onclick = () => {
        const now = new Date();
        state.calendarYear = now.getFullYear();
        state.calendarMonth = now.getMonth();
        state.selectedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        renderApp();
      };
    }

    // Filtros de barbero
    document.querySelectorAll('.btn-barber-filter').forEach((btn) => {
      btn.onclick = () => {
        state.selectedBarberFilter = btn.dataset.barberFilter;
        renderApp();
      };
    });

    // Clic en días del calendario
    document.querySelectorAll('.origin-cal-cell:not(.disabled), .cal-day-cell:not(.disabled), .cal-journal-cell:not(.disabled)').forEach((cell) => {
      cell.onclick = () => {
        if (cell.dataset.date) {
          state.selectedDate = cell.dataset.date;
          state.bookingForm.date = cell.dataset.date;
          renderApp();
        }
      };
    });

    // Clic en franjas horarias disponibles
    document.querySelectorAll('.origin-slot-btn:not(.booked), .time-slot-btn:not(.booked), .slot-journal-btn:not(.booked)').forEach((btn) => {
      btn.onclick = () => {
        state.bookingForm.date = btn.dataset.slotDate;
        state.bookingForm.startTime = btn.dataset.slotTime;
        if (btn.dataset.slotBarber) {
          state.bookingForm.barberId = btn.dataset.slotBarber;
        }
        state.bookingModalOpen = true;
        renderApp();
      };
    });

    // Cerrar modal de agendamiento
    const btnCloseBookingModal = document.getElementById('btn-close-client-booking');
    if (btnCloseBookingModal) {
      btnCloseBookingModal.onclick = () => {
        state.bookingModalOpen = false;
        renderApp();
      };
    }

    // Selección de barbero en el modal (in-place sin resetear scroll)
    document.querySelectorAll('.barber-modal-choice').forEach((card) => {
      card.onclick = () => {
        const barberId = card.dataset.modalBarberId;
        state.bookingForm.barberId = barberId;
        document.querySelectorAll('.barber-modal-choice').forEach((c) => {
          const isSelected = c.dataset.modalBarberId === barberId;
          c.classList.toggle('border-[#d97757]', isSelected);
          c.classList.toggle('bg-[#f5e3c7]', isSelected);
          c.classList.toggle('border-[#cccbc8]', !isSelected);
          c.classList.toggle('bg-[#faf9f5]', !isSelected);
          const indicator = c.querySelector('span.w-4');
          if (indicator) {
            indicator.className = `w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#d97757] bg-[#d97757]' : 'border-[#cccbc8]'}`;
            indicator.innerHTML = isSelected ? '<span class="w-1.5 h-1.5 rounded-full bg-white"></span>' : '';
          }
        });
      };
    });

    // Selección de combo en el modal (in-place sin resetear scroll)
    document.querySelectorAll('.service-modal-choice').forEach((card) => {
      card.onclick = () => {
        const serviceId = card.dataset.modalServiceId;
        state.bookingForm.serviceId = serviceId;
        document.querySelectorAll('.service-modal-choice').forEach((c) => {
          const isSelected = c.dataset.modalServiceId === serviceId;
          c.classList.toggle('border-[#d97757]', isSelected);
          c.classList.toggle('bg-[#f5e3c7]', isSelected);
          c.classList.toggle('border-[#cccbc8]', !isSelected);
          c.classList.toggle('bg-[#faf9f5]', !isSelected);
        });
      };
    });

    const btnOpenClientSync = document.getElementById('btn-open-client-sync');
    if (btnOpenClientSync) {
      btnOpenClientSync.onclick = () => {
        showClientSyncModal();
      };
    }

    // Envío del formulario de agendamiento
    const formClientBooking = document.getElementById('form-client-booking');
    if (formClientBooking) {
      formClientBooking.onsubmit = async (e) => {
        e.preventDefault();
        const clientName = document.getElementById('client-booking-name').value;
        const clientPhone = document.getElementById('client-booking-phone').value;
        const clientEmail = document.getElementById('client-booking-email')?.value || '';
        const clientNotes = document.getElementById('client-booking-notes')?.value || '';

        state.bookingForm.clientName = clientName;
        state.bookingForm.clientPhone = clientPhone;
        state.bookingForm.clientEmail = clientEmail;
        state.bookingForm.clientNotes = clientNotes;
        if (clientPhone) {
          localStorage.setItem('blopez_last_phone', clientPhone);
        }

        try {
          const result = await bookAppointmentUseCase.execute({
            clientName,
            clientPhone,
            barberId: state.bookingForm.barberId,
            serviceId: state.bookingForm.serviceId,
            date: state.bookingForm.date,
            startTime: state.bookingForm.startTime,
            paymentMethod: state.bookingForm.paymentMethod
          });

          state.bookingModalOpen = false;
          showConfirmationModal(result);
        } catch (err) {
          alert(err.message);
        }
      };
    }

    document.querySelectorAll('.btn-complete-cut').forEach((btn) => {
      btn.onclick = async () => {
        try {
          await completeCutUseCase.execute({
            appointmentId: btn.dataset.apptId,
            user: state.currentUser
          });
          renderApp();
        } catch (err) {
          alert(err.message);
        }
      };
    });

    // Filtro por estación en el Dashboard de turnos
    document.querySelectorAll('.btn-dashboard-barber').forEach((btn) => {
      btn.onclick = () => {
        state.dashboardBarberFilter = btn.dataset.dashboardBarber;
        renderApp();
      };
    });

    // Botones de sincronización automática de celular para barberos
    document.querySelectorAll('.btn-sync-mobile-calendar').forEach((btn) => {
      btn.onclick = () => {
        showSyncModal(btn.dataset.syncBarberId, btn.dataset.syncBarberName);
      };
    });

    // Filtro por estación en el Historial de cortes
    document.querySelectorAll('.btn-history-barber').forEach((btn) => {
      btn.onclick = () => {
        state.historyBarberFilter = btn.dataset.historyBarber;
        renderApp();
      };
    });

    // Filtros de historial por mes (Botones rápidos, Select dropdown y Buscador)
    document.querySelectorAll('.btn-history-filter').forEach((btn) => {
      btn.onclick = () => {
        state.historyFilter = btn.dataset.historyFilter;
        renderApp();
      };
    });

    const selectHistoryMonth = document.getElementById('select-history-month');
    if (selectHistoryMonth) {
      selectHistoryMonth.onchange = (e) => {
        state.historyFilter = e.target.value;
        renderApp();
      };
    }

    const inputHistorySearch = document.getElementById('input-history-search');
    if (inputHistorySearch) {
      inputHistorySearch.oninput = (e) => {
        state.historySearch = e.target.value;
        const q = e.target.value.toLowerCase().trim();
        const rows = document.querySelectorAll('.history-cut-row');
        rows.forEach((row) => {
          const text = row.innerText.toLowerCase();
          row.style.display = text.includes(q) ? '' : 'none';
        });
      };
    }

    const formCreateBarber = document.getElementById('form-create-barber');
    if (formCreateBarber) {
      formCreateBarber.onsubmit = async (e) => {
        e.preventDefault();
        try {
          await manageUsersUseCase.createBarber({
            adminUser: state.currentUser,
            name: document.getElementById('new-barber-name').value,
            specialty: document.getElementById('new-barber-spec').value,
            phone: document.getElementById('new-barber-phone').value,
            username: document.getElementById('new-barber-username').value,
            password: document.getElementById('new-barber-password').value,
            role: document.getElementById('new-barber-role').value
          });
          alert("Barbero y credenciales creados con éxito.");
          renderApp();
        } catch (err) {
          alert(err.message);
        }
      };
    }

    document.querySelectorAll('.btn-change-password').forEach((btn) => {
      btn.onclick = async () => {
        const userId = btn.dataset.userId;
        const username = btn.dataset.username;
        const newPassword = prompt(`Nueva contraseña para @${username}:`);
        if (newPassword && newPassword.trim().length >= 4) {
          try {
            const res = await manageUsersUseCase.changePassword({
              adminUser: state.currentUser,
              userId,
              newPassword
            });
            alert(res.message);
            renderApp();
          } catch (err) {
            alert(err.message);
          }
        }
      };
    });

    document.querySelectorAll('.btn-toggle-status').forEach((btn) => {
      btn.onclick = async () => {
        try {
          await manageUsersUseCase.toggleUserStatus({
            adminUser: state.currentUser,
            userId: btn.dataset.toggleUserId
          });
          renderApp();
        } catch (err) {
          alert(err.message);
        }
      };
    });

    document.querySelectorAll('.btn-delete-user').forEach((btn) => {
      btn.onclick = async () => {
        const username = btn.dataset.username;
        const userId = btn.dataset.deleteUserId;
        const confirmed = confirm(`¿Estás seguro de que deseas eliminar permanentemente la cuenta de @${username}? Esta acción borrará su perfil de barbero y no se puede deshacer.`);
        if (confirmed) {
          try {
            const res = await manageUsersUseCase.deleteBarber({
              adminUser: state.currentUser,
              userId
            });
            alert(res.message);
            renderApp();
          } catch (err) {
            alert(err.message);
          }
        }
      };
    });
  }

  function showConfirmationModal({ appointment, barber, service, calendarPayload }) {
    const container = document.getElementById('modal-confirmation-container');
    if (!container) return;

    container.innerHTML = `
      <div id="modal-confirm" class="fixed inset-0 z-50 bg-[#0a0b0d]/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="anthropic-card w-full max-w-lg p-6 sm:p-8 relative">
          <div class="mb-6">
            <div class="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)] text-[#f3e5ab] text-xs font-semibold">
              <span class="w-2 h-2 rounded-full bg-[#d4af37]"></span>
              <span>TURNO CONFIRMADO EN AGENDA</span>
            </div>
            <h3 class="font-serif-editorial text-[30px] sm:text-[34px] font-normal leading-tight text-[#ffffff] mb-1">¡Reserva completada!</h3>
            <p class="font-sans-ui text-[#c5c0b6] text-[15px]">
              ${appointment.clientName}, tu turno ha sido agendado exitosamente con ${barber.name}.
            </p>
          </div>

          <div class="bg-[#161a22] p-5 rounded-[12px] border border-[rgba(212,175,55,0.22)] space-y-2.5 mb-6 font-sans-ui text-sm">
            <div class="flex justify-between"><span class="text-[#8a8275]">Barbero</span><span class="text-[#ffffff] font-semibold">${barber.name} (${barber.specialty})</span></div>
            <div class="flex justify-between"><span class="text-[#8a8275]">Servicio</span><span class="text-[#ffffff]">${service.name}</span></div>
            <div class="flex justify-between"><span class="text-[#8a8275]">Fecha y hora</span><span class="text-[#f3e5ab] font-mono-tech font-bold">${formatDateFriendly(appointment.date)} · ${formatTime12h(appointment.startTime)}</span></div>
            <div class="flex justify-between"><span class="text-[#8a8275]">Duración estimada</span><span class="text-[#c5c0b6]">${service.durationMinutes} min</span></div>
            <div class="flex justify-between pt-3 border-t border-[rgba(212,175,55,0.22)]">
              <span class="text-[#8a8275]">Valor oficial</span>
              <span class="text-[#d4af37] font-mono-tech font-bold text-base">$${service.priceCop.toLocaleString('es-CO')} COP</span>
            </div>
          </div>

          <div class="space-y-3 mb-6">
            <p class="font-sans-ui text-xs font-semibold text-[#d4af37] uppercase tracking-wider">Conectar y sincronizar con tus calendarios:</p>

            <!-- OPCION IPHONE (WEBCAL NATIVO DE 1 TOQUE) -->
            <div class="bg-[#12151b] p-3.5 sm:p-4 rounded-[12px] border border-[rgba(212,175,55,0.35)] shadow-md">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs font-bold text-[#f3e5ab] font-mono-tech uppercase">En iPhone (Apple Calendar)</span>
                <span class="text-[10px] px-2 py-0.5 rounded bg-[#d4af37]/20 text-[#f3e5ab] font-semibold border border-[rgba(212,175,55,0.3)]">1 Toque Nativo</span>
              </div>
              <p class="text-xs text-[#c5c0b6] mb-3 leading-relaxed font-sans-ui">
                Abre la app Calendario de Apple. iOS te preguntará <em>"¿Deseas suscribirte al calendario?"</em>. Pulsa <strong>Suscribirse</strong> y tus turnos se guardarán automáticamente con recordatorio previo.
              </p>
              <a href="${calendarPayload.clientWebcalUrl}" class="btn-clay w-full py-3 justify-center text-xs sm:text-sm font-bold text-center block cursor-pointer">
                Añadir a Apple Calendar en iPhone →
              </a>
            </div>

            <!-- OPCION GOOGLE CALENDAR -->
            <a href="${calendarPayload.googleUrl}" target="_blank" class="btn-stone-outline w-full py-2.5 justify-center text-xs font-semibold text-[#f3e5ab] text-center block">
              Conectar a Google Calendar (Android / Gmail) →
            </a>

            <!-- OPCION DESCARGA ARCHIVO .ICS MANUAL -->
            <div class="text-center pt-0.5">
              <a href="${calendarPayload.icsDownloadUrl}" download="Cita_${barber.name.replace(/\s+/g, '_')}.ics" class="text-[11px] text-[#8a8275] hover:text-[#d4af37] underline transition-colors">
                Descargar archivo .ics manual (Mac / Outlook / PC)
              </a>
            </div>

            <!-- CONFIRMACION POR WHATSAPP -->
            <a href="${calendarPayload.whatsappUrl}" target="_blank" class="btn-stone-outline w-full py-2.5 justify-center text-xs font-semibold text-[#f3e5ab] link-editorial text-center block">
              Enviar confirmación por WhatsApp (+57 321 989 7910)
            </a>
          </div>

          <button id="btn-close-confirm" class="btn-stone-outline w-full py-2.5 justify-center text-xs text-[#8a8275] border-transparent hover:border-[rgba(212,175,55,0.3)]">Listo / Volver a la agenda</button>
        </div>
      </div>
    `;

    document.getElementById('btn-close-confirm')?.addEventListener('click', () => {
      container.innerHTML = '';
      renderApp();
    });
  }

  function showSyncModal(barberId, barberName) {
    let container = document.getElementById('modal-sync-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'modal-sync-container';
      document.body.appendChild(container);
    }

    const host = window.location.host;
    const protocol = window.location.protocol;
    const httpFeedUrl = `${protocol}//${host}/api/calendar/${barberId}.ics`;
    const webcalFeedUrl = `webcal://${host}/api/calendar/${barberId}.ics`;
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(httpFeedUrl)}`;

    container.innerHTML = `
      <div id="modal-sync-backdrop" class="fixed inset-0 z-50 bg-[#0a0b0d]/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="anthropic-card w-full max-w-lg p-6 sm:p-8 relative border border-[#d4af37]/40 shadow-2xl">
          
          <div class="flex items-start justify-between gap-3 mb-6 pb-4 border-b border-[rgba(212,175,55,0.22)]">
            <div>
              <div class="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)] text-[#f3e5ab] text-xs font-semibold">
                <span class="w-2 h-2 rounded-full bg-[#d4af37]"></span>
                <span>VINCULACIÓN AUTOMÁTICA EN CELULAR</span>
              </div>
              <h3 class="font-serif-editorial text-2xl sm:text-3xl font-normal text-[#ffffff] tracking-tight">
                ${barberName}
              </h3>
              <p class="font-sans-ui text-xs text-[#c5c0b6] mt-1">
                Realiza este paso <strong>una sola vez</strong> desde tu teléfono. Todas las citas que los clientes reserven en la web aparecerán automáticamente en tu calendario nativo con alarma previa.
              </p>
            </div>
            <button id="btn-close-sync-modal" class="text-[#8a8275] hover:text-[#ffffff] text-xl font-bold p-1 cursor-pointer">&times;</button>
          </div>

          <div class="space-y-4 mb-6 font-sans-ui text-sm">
            
            <!-- OPCION IPHONE / APPLE CALENDAR -->
            <div class="bg-[#12151b] p-4 rounded-[12px] border border-[rgba(212,175,55,0.25)]">
              <div class="flex items-center gap-2 mb-1.5">
                <span class="text-xs font-bold text-[#f3e5ab] uppercase tracking-wider font-mono-tech">En iPhone (Apple Calendar)</span>
              </div>
              <p class="text-xs text-[#c5c0b6] mb-3">
                Abre este enlace desde tu iPhone. iOS te preguntará <em>"¿Deseas suscribirte al calendario?"</em>. Pulsa <strong>Suscribirse</strong> y listo.
              </p>
              <a href="${webcalFeedUrl}" class="btn-clay w-full py-2.5 text-xs font-semibold justify-center block text-center cursor-pointer">
                Suscribir en iPhone (1 toque) →
              </a>
            </div>

            <!-- OPCION ANDROID / GOOGLE CALENDAR -->
            <div class="bg-[#12151b] p-4 rounded-[12px] border border-[rgba(212,175,55,0.25)]">
              <div class="flex items-center gap-2 mb-1.5">
                <span class="text-xs font-bold text-[#f3e5ab] uppercase tracking-wider font-mono-tech">En Android (Google Calendar)</span>
              </div>
              <p class="text-xs text-[#c5c0b6] mb-3">
                Vincula directamente tu cuenta de Google Calendar para sincronizar todas las citas en segundo plano.
              </p>
              <a href="${googleCalendarUrl}" target="_blank" class="btn-stone-outline w-full py-2.5 text-xs font-semibold justify-center block text-center text-[#f3e5ab] cursor-pointer">
                Añadir a Google Calendar (Android / Gmail) →
              </a>
            </div>

            <!-- ENLACE DIRECTO COPIABLE -->
            <div class="bg-[#12151b] p-3 rounded-[10px] border border-[rgba(212,175,55,0.15)] flex items-center justify-between gap-2">
              <div class="overflow-hidden">
                <span class="block text-[10px] font-semibold text-[#8a8275] uppercase">Enlace directo iCal:</span>
                <span class="text-xs font-mono-tech text-[#c5c0b6] truncate block select-all">${httpFeedUrl}</span>
              </div>
              <button id="btn-copy-feed-url" type="button" class="btn-stone-outline text-xs py-1.5 px-3 flex-shrink-0 cursor-pointer">
                Copiar
              </button>
            </div>

          </div>

          <button id="btn-close-sync-modal-bottom" class="btn-stone-outline w-full py-2 text-xs text-[#8a8275] justify-center cursor-pointer">
            Cerrar ventana
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-close-sync-modal')?.addEventListener('click', () => { container.innerHTML = ''; });
    document.getElementById('btn-close-sync-modal-bottom')?.addEventListener('click', () => { container.innerHTML = ''; });
    document.getElementById('btn-copy-feed-url')?.addEventListener('click', () => {
      navigator.clipboard.writeText(httpFeedUrl).then(() => {
        alert('Enlace del calendario copiado. Puedes pegarlo en la aplicación de calendario de tu teléfono.');
      }).catch(() => {
        prompt('Copia este enlace de suscripción para tu celular:', httpFeedUrl);
      });
    });
  }

  function showClientSyncModal(prefilledPhone = '') {
    let container = document.getElementById('modal-client-sync-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'modal-client-sync-container';
      document.body.appendChild(container);
    }

    const savedPhone = prefilledPhone || localStorage.getItem('blopez_last_phone') || '';
    const host = window.location.host;
    const protocol = window.location.protocol;

    function renderClientSyncContent(phone) {
      const cleanPhone = (phone || '').replace(/\D/g, '');
      const httpFeedUrl = `${protocol}//${host}/api/calendar/client/${cleanPhone || 'mi_numero'}.ics`;
      const webcalFeedUrl = `webcal://${host}/api/calendar/client/${cleanPhone || 'mi_numero'}.ics`;
      const googleCalendarUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(httpFeedUrl)}`;

      return `
        <div id="modal-client-sync-backdrop" class="fixed inset-0 z-50 bg-[#0a0b0d]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div class="anthropic-card w-full max-w-lg p-6 sm:p-8 relative border border-[#d4af37]/40 shadow-2xl">
            
            <div class="flex items-start justify-between gap-3 mb-5 pb-3 border-b border-[rgba(212,175,55,0.22)]">
              <div>
                <div class="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)] text-[#f3e5ab] text-xs font-semibold">
                  <span class="w-2 h-2 rounded-full bg-[#d4af37]"></span>
                  <span>CALENDARIO MÓVIL DEL CLIENTE</span>
                </div>
                <h3 class="font-serif-editorial text-2xl sm:text-3xl font-normal text-[#ffffff] tracking-tight">
                  Sincronizar mis turnos
                </h3>
                <p class="font-sans-ui text-xs text-[#c5c0b6] mt-1">
                  Ingresa tu número de teléfono para vincular todas tus citas actuales y futuras a tu calendario en tiempo real con recordatorio previo.
                </p>
              </div>
              <button id="btn-close-client-sync-modal" class="text-[#8a8275] hover:text-[#ffffff] text-xl font-bold p-1 cursor-pointer">&times;</button>
            </div>

            <div class="space-y-4 mb-6 font-sans-ui text-sm">
              <div>
                <label class="block text-xs font-semibold text-[#f3e5ab] uppercase tracking-wider mb-1.5">Número de teléfono con el que reservaste:</label>
                <div class="flex gap-2">
                  <input type="tel" id="input-client-sync-phone" value="${phone}" placeholder="Ej: 320 466 8428" class="input-parchment flex-1 text-sm font-mono-tech py-2">
                  <button type="button" id="btn-update-client-sync-phone" class="btn-clay text-xs px-4 py-2 font-semibold cursor-pointer">Actualizar</button>
                </div>
              </div>

              <!-- OPCION IPHONE / APPLE CALENDAR -->
              <div class="bg-[#12151b] p-4 rounded-[12px] border border-[rgba(212,175,55,0.25)]">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-xs font-bold text-[#f3e5ab] uppercase tracking-wider font-mono-tech">En iPhone (Apple Calendar)</span>
                  <span class="text-[10px] px-2 py-0.5 rounded bg-[#d4af37]/20 text-[#f3e5ab] font-semibold border border-[rgba(212,175,55,0.3)]">1 Toque Nativo</span>
                </div>
                <p class="text-xs text-[#c5c0b6] mb-3 leading-relaxed">
                  Toca el botón desde tu iPhone. iOS te preguntará <em>"¿Deseas suscribirte al calendario?"</em>. Pulsa <strong>Suscribirse</strong> y todas tus citas aparecerán al instante.
                </p>
                <a href="${webcalFeedUrl}" class="btn-clay w-full py-2.5 text-xs sm:text-sm font-bold justify-center block text-center cursor-pointer shadow-md">
                  Añadir a Apple Calendar en iPhone (1 toque) →
                </a>
              </div>

              <!-- OPCION ANDROID / GOOGLE CALENDAR -->
              <div class="bg-[#12151b] p-4 rounded-[12px] border border-[rgba(212,175,55,0.25)]">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-xs font-bold text-[#f3e5ab] uppercase tracking-wider font-mono-tech">En Android (Google Calendar)</span>
                </div>
                <p class="text-xs text-[#c5c0b6] mb-3">
                  Vincula tu cuenta de Google Calendar para sincronizar todas tus citas automáticamente.
                </p>
                <a href="${googleCalendarUrl}" target="_blank" class="btn-stone-outline w-full py-2.5 text-xs font-semibold justify-center block text-center text-[#f3e5ab] cursor-pointer">
                  Añadir a Google Calendar →
                </a>
              </div>

              <!-- ENLACE DIRECTO COPIABLE -->
              <div class="bg-[#12151b] p-3 rounded-[10px] border border-[rgba(212,175,55,0.15)] flex items-center justify-between gap-2">
                <div class="overflow-hidden">
                  <span class="block text-[10px] font-semibold text-[#8a8275] uppercase">Enlace directo iCal:</span>
                  <span class="text-xs font-mono-tech text-[#c5c0b6] truncate block select-all">${httpFeedUrl}</span>
                </div>
                <button id="btn-copy-client-feed-url" type="button" class="btn-stone-outline text-xs py-1.5 px-3 flex-shrink-0 cursor-pointer">
                  Copiar
                </button>
              </div>

            </div>

            <button id="btn-close-client-sync-modal-bottom" class="btn-stone-outline w-full py-2 text-xs text-[#8a8275] justify-center cursor-pointer">
              Cerrar ventana
            </button>
          </div>
        </div>
      `;
    }

    function attachListeners() {
      document.getElementById('btn-close-client-sync-modal')?.addEventListener('click', () => { container.innerHTML = ''; });
      document.getElementById('btn-close-client-sync-modal-bottom')?.addEventListener('click', () => { container.innerHTML = ''; });
      document.getElementById('btn-update-client-sync-phone')?.addEventListener('click', () => {
        const p = document.getElementById('input-client-sync-phone').value;
        localStorage.setItem('blopez_last_phone', p);
        container.innerHTML = renderClientSyncContent(p);
        attachListeners();
      });
      document.getElementById('btn-copy-client-feed-url')?.addEventListener('click', () => {
        const p = document.getElementById('input-client-sync-phone').value;
        const cleanPhone = (p || '').replace(/\D/g, '');
        const url = `${protocol}//${host}/api/calendar/client/${cleanPhone || 'mi_numero'}.ics`;
        navigator.clipboard.writeText(url).then(() => {
          alert('Enlace copiado al portapapeles.');
        }).catch(() => {
          prompt('Copia este enlace de suscripción:', url);
        });
      });
    }

    container.innerHTML = renderClientSyncContent(savedPhone);
    attachListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderApp);
  } else {
    renderApp();
  }

  // Actualización automática en tiempo real cada 30 segundos si el usuario está en la vista de cliente
  setInterval(() => {
    if (state.activeView === 'home' && !state.bookingModalOpen) {
      const confirmModal = document.getElementById('modal-confirmation-container');
      const syncModal = document.getElementById('modal-sync-container');
      const clientSyncModal = document.getElementById('modal-client-sync-container');
      const hasOpenModal = (confirmModal && confirmModal.children.length > 0) || 
                           (syncModal && syncModal.children.length > 0) ||
                           (clientSyncModal && clientSyncModal.children.length > 0);
      if (!hasOpenModal) {
        renderApp();
      }
    }
  }, 30000);

  window.addEventListener('focus', () => {
    if (state.activeView === 'home' && !state.bookingModalOpen) {
      renderApp();
    }
  });
})();
