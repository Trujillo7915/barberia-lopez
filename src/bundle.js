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

  const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
      serviceName = null,
      additionals = [],
      totalPriceCop = null,
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
      this.serviceName = serviceName;
      this.additionals = additionals || [];
      this.totalPriceCop = totalPriceCop;
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
    constructor({ id, appointmentId = null, barberId, clientName, date, executionDate, appointmentDate, time, priceCop, createdAt = new Date() }) {
      this.id = id || generateId();
      this.appointmentId = appointmentId;
      this.barberId = barberId;
      this.clientName = (clientName || '').trim();
      this.date = date;
      this.executionDate = executionDate || date;
      this.appointmentDate = appointmentDate || date;
      this.time = time;
      this.priceCop = Number(priceCop) || 0;
      this.createdAt = createdAt instanceof Date ? createdAt.toISOString() : (createdAt || new Date().toISOString());
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
    static calculateDailyCash(historyList, dateStr, storeOrdersList = []) {
      const dayRecords = (historyList || []).filter((r) => {
        if (!r) return false;
        if (r.executionDate) {
          return r.executionDate === dateStr;
        }
        const createdDate = r.createdAt
          ? (typeof r.createdAt === 'string'
              ? r.createdAt.substring(0, 10)
              : getLocalDateString(new Date(r.createdAt)))
          : null;
        return r.date === dateStr || createdDate === dateStr;
      });
      let cutsTotal = 0;
      const byBarber = {};

      for (const record of dayRecords) {
        const price = Number(record.priceCop) || 0;
        cutsTotal += price;
        if (!byBarber[record.barberId]) {
          byBarber[record.barberId] = { count: 0, total: 0 };
        }
        byBarber[record.barberId].count += 1;
        byBarber[record.barberId].total += price;
      }

      const deliveredStoreOrders = (storeOrdersList || []).filter(
        (o) => o.status === 'ENTREGADO' && (o.deliveredDate || o.date) === dateStr
      );
      const storeTotalCop = deliveredStoreOrders.reduce((sum, o) => sum + (Number(o.totalCop) || 0), 0);

      return {
        date: dateStr,
        totalCount: dayRecords.length,
        cutsTotalCop: cutsTotal,
        storeOrdersCount: deliveredStoreOrders.length,
        storeTotalCop: storeTotalCop,
        totalConsolidatedCop: cutsTotal + storeTotalCop,
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
      return user.role === Roles.ADMIN || user.role === Roles.JEFE;
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
      category: 'Corte + Masaje',
      durationMinutes: 30,
      priceCop: 20000,
      description: 'Corte tradicional o moderno + masaje capilar relajante.',
      active: true
    },
    {
      id: 's-02',
      name: 'Combo 1',
      category: 'Corte + Masaje Espalda + Mascarilla + Cejas',
      durationMinutes: 30,
      priceCop: 25000,
      description: 'Corte completo + masaje de espalda + mascarilla negra + perfilado de cejas.',
      active: true
    },
    {
      id: 's-03',
      name: 'Combo 2',
      category: 'Corte + Masaje + Mascarilla + Barba + Cejas',
      durationMinutes: 30,
      priceCop: 35000,
      description: 'Corte + masaje + mascarilla facial + ritual de barba con toalla caliente + cejas.',
      active: true
    },
    {
      id: 's-04',
      name: 'Combo 3',
      category: 'Corte + Spa + Lavado',
      durationMinutes: 30,
      priceCop: 40000,
      description: 'Corte + masaje + mascarilla + barba completa + cejas + lavado de cabello con shampoo refrescante.',
      active: true
    },
    {
      id: 's-05',
      name: 'Combi Completa VIP',
      category: 'Experiencia Total + Granizado',
      durationMinutes: 30,
      priceCop: 65000,
      description: 'Corte + masaje + mascarilla + barba spa + cejas + lavado de cabello + granizado artesanal de la casa.',
      active: true
    }
  ];

  const OPTIONAL_EXTRAS = {
    pigmentacion: [
      { id: 'pig-none', name: 'Sin pigmentación', priceCop: 0, desc: 'Acabado natural sin tinte' },
      { id: 'pig-aero', name: 'Pigmentación Aerógrafo', priceCop: 18000, desc: 'Definición y sombra natural con aerógrafo' },
      { id: 'pig-manual', name: 'Pigmentación Manual', priceCop: 22000, desc: 'Pigmentación artesanal para densidad capilar' }
    ],
    adicionales: [
      { id: 'extra-cejas', name: 'Cejas', priceCop: 3000, desc: 'Perfilado y alineación a navaja' },
      { id: 'extra-barba', name: 'Barba', priceCop: 10000, desc: 'Ritual y perfilado de barba con toalla caliente' },
      { id: 'extra-afeitado', name: 'Afeitado tradicional', priceCop: 6000, desc: 'Afeitado al ras con espuma y toalla caliente' }
    ]
  };

  const SEED_APPOINTMENTS = [];
  const SEED_HISTORY = [];
  const SEED_PRODUCTS = [
    {
      id: 'p-01',
      name: 'Cera Mate Fijacion Extrema Lopez',
      category: 'Cuidado Capilar',
      priceCop: 32000,
      stock: 15,
      description: 'Acabado seco natural sin residuos grasos. Fijacion de alta duracion ideal para peinados texturizados y clasicos.',
      imageUrl: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=600&auto=format&fit=crop&q=80',
      active: true
    },
    {
      id: 'p-02',
      name: 'Pomada Clasica Brillo Imperial',
      category: 'Cuidado Capilar',
      priceCop: 30000,
      stock: 12,
      description: 'Formula a base de agua con brillo elegante para estilos clasicos, slick back y pompadour. Se retira facilmente con agua.',
      imageUrl: 'https://images.unsplash.com/photo-1585751119414-ef2636f8aede?w=600&auto=format&fit=crop&q=80',
      active: true
    },
    {
      id: 'p-03',
      name: 'Aceite Hidratante de Barba Cedro y Argan',
      category: 'Barba y Piel',
      priceCop: 35000,
      stock: 10,
      description: 'Nutre el vello facial desde la raiz, elimina la resequedad e irritacion y deja un aroma masculino amaderado.',
      imageUrl: 'https://images.unsplash.com/photo-1608248597359-0e6d526a6828?w=600&auto=format&fit=crop&q=80',
      active: true
    },
    {
      id: 'p-04',
      name: 'Tonico Capilar y de Barba Crecimiento 5%',
      category: 'Tratamiento',
      priceCop: 45000,
      stock: 8,
      description: 'Locion activadora de foliculos para poblar zonas abiertas en barba y fortalecer la densidad capilar.',
      imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80',
      active: true
    },
    {
      id: 'p-05',
      name: 'Polvo Texturizador Volumen Instantaneo',
      category: 'Styling',
      priceCop: 38000,
      stock: 14,
      description: 'Control de gravedad y volumen inmediato en la raiz con efecto mate invisible para cortes modernos y crop.',
      imageUrl: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=600&auto=format&fit=crop&q=80',
      active: true
    },
    {
      id: 'p-06',
      name: 'Cepillo Militar Cerdas Naturales para Barba',
      category: 'Accesorios',
      priceCop: 22000,
      stock: 9,
      description: 'Madera de nogal tallada con cerdas firmes para distribuir aceites, exfoliar la piel y domar la barba rebelde.',
      imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&auto=format&fit=crop&q=80',
      active: true
    }
  ];
  const SEED_STORE_ORDERS = [];

  class LocalStorageRepository {
    constructor() {
      this.memStore = {};
      this._initializeStorage();
    }

    _initializeStorage() {
      // Actualización automática: vaciar historial y turnos de prueba de versiones anteriores
      const CLEAN_DEPLOY_VERSION = 'v4_clean_test_history';
      try {
        if (localStorage.getItem('blopez_clean_version') !== CLEAN_DEPLOY_VERSION) {
          localStorage.setItem('blopez_services', JSON.stringify(SEED_SERVICES));
          localStorage.setItem('blopez_appointments', JSON.stringify([]));
          localStorage.setItem('blopez_history', JSON.stringify([]));
          localStorage.setItem('blopez_clean_version', CLEAN_DEPLOY_VERSION);
        }
      } catch (e) {}

      this._ensureKey('blopez_users', SEED_USERS);
      this._ensureKey('blopez_barbers', SEED_BARBERS);
      this._ensureKey('blopez_services', SEED_SERVICES);
      this._ensureKey('blopez_appointments', SEED_APPOINTMENTS);
      this._ensureKey('blopez_history', SEED_HISTORY);
      this._ensureKey('blopez_products', SEED_PRODUCTS);
      this._ensureKey('blopez_store_orders', SEED_STORE_ORDERS);
    }

    _ensureKey(key, seed) {
      try {
        const raw = localStorage.getItem(key);
        let parsed = null;
        if (raw) {
          try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
        }
        const needsSeed = !Array.isArray(parsed) || (seed.length > 0 && parsed.length === 0);
        if (needsSeed) {
          localStorage.setItem(key, JSON.stringify(seed));
        }
      } catch (e) {
        if (!this.memStore[key] || (seed.length > 0 && this.memStore[key].length === 0)) {
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

    _getAuthHeaders() {
      const token = localStorage.getItem('blopez_token') || '';
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      return headers;
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
      if (!user || !plainPassword) return false;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user.username, password: plainPassword })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.token) localStorage.setItem('blopez_token', data.token);
          return true;
        }
      } catch (e) {}
      return false;
    }

    async updatePassword(userId, newPassword) {
      const list = this._get('blopez_users');
      const idx = list.findIndex((u) => u.id === userId);
      if (idx !== -1) {
        this._set('blopez_users', list);
        try {
          const res = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: this._getAuthHeaders(),
            body: JSON.stringify({ password: newPassword })
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'No fue posible actualizar la contraseña.');
          }
        } catch (e) {
          throw e;
        }
        return true;
      }
      return false;
    }

    async saveUser(user) {
      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: this._getAuthHeaders(),
          body: JSON.stringify(user)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No fue posible crear el usuario en el servidor.');
        }
        const data = await res.json().catch(() => ({}));
        const savedUser = data.user || user;
        const list = this._get('blopez_users');
        const existingIdx = list.findIndex((u) => u.id === savedUser.id);
        if (existingIdx !== -1) {
          list[existingIdx] = savedUser;
        } else {
          list.push(savedUser);
        }
        this._set('blopez_users', list);
        return savedUser;
      } catch (e) {
        throw e;
      }
    }

    async updateUser(user) {
      try {
        const res = await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: this._getAuthHeaders(),
          body: JSON.stringify(user)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No fue posible actualizar el usuario.');
        }
        const data = await res.json().catch(() => ({}));
        const savedUser = data.user || user;
        const list = this._get('blopez_users');
        const idx = list.findIndex((u) => u.id === savedUser.id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...savedUser };
          this._set('blopez_users', list);
        }
        return savedUser;
      } catch (e) {
        throw e;
      }
    }

    async findAllUsers() {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const serverUsers = await res.json();
          if (Array.isArray(serverUsers)) {
            this._set('blopez_users', serverUsers);
            return serverUsers;
          }
        }
      } catch (e) {}
      return this._get('blopez_users');
    }

    async deleteUser(userId) {
      try {
        const res = await fetch(`/api/users/${userId}`, {
          method: 'DELETE',
          headers: this._getAuthHeaders()
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No fue posible eliminar el usuario.');
        }
        let list = this._get('blopez_users');
        list = list.filter((u) => u.id !== userId);
        this._set('blopez_users', list);
        return true;
      } catch (e) {
        throw e;
      }
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
          if (Array.isArray(serverBarbers)) {
            this._set('blopez_barbers', serverBarbers);
            return serverBarbers;
          }
        }
      } catch (e) {}
      return this._get('blopez_barbers');
    }

    async saveBarber(barber) {
      try {
        const res = await fetch('/api/barbers', {
          method: 'POST',
          headers: this._getAuthHeaders(),
          body: JSON.stringify(barber)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No fue posible registrar el barbero.');
        }
        const data = await res.json().catch(() => ({}));
        const savedBarber = data.barber || barber;
        const list = this._get('blopez_barbers');
        const existingIdx = list.findIndex((b) => b.id === savedBarber.id);
        if (existingIdx !== -1) {
          list[existingIdx] = savedBarber;
        } else {
          list.push(savedBarber);
        }
        this._set('blopez_barbers', list);
        return savedBarber;
      } catch (e) {
        throw e;
      }
    }

    async updateBarber(barber) {
      try {
        const res = await fetch(`/api/barbers/${barber.id}`, {
          method: 'PUT',
          headers: this._getAuthHeaders(),
          body: JSON.stringify(barber)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No fue posible actualizar el barbero.');
        }
        const data = await res.json().catch(() => ({}));
        const savedBarber = data.barber || barber;
        const list = this._get('blopez_barbers');
        const idx = list.findIndex((b) => b.id === savedBarber.id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...savedBarber };
          this._set('blopez_barbers', list);
        }
        return savedBarber;
      } catch (e) {
        throw e;
      }
    }

    async deleteBarber(barberId) {
      try {
        const res = await fetch(`/api/barbers/${barberId}`, {
          method: 'DELETE',
          headers: this._getAuthHeaders()
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No fue posible eliminar el barbero.');
        }
        let list = this._get('blopez_barbers');
        list = list.filter((b) => b.id !== barberId);
        this._set('blopez_barbers', list);
        return true;
      } catch (e) {
        throw e;
      }
    }

    async findServiceById(id) {
      const list = await this.findAllServices();
      if (id) {
        const found = list.find((s) => s.id === id);
        if (found) return found;
      }
      return list[0] || SEED_SERVICES[0] || null;
    }

    async findAllServices() {
      try {
        const res = await fetch('/api/services');
        if (res.ok) {
          const serverServices = await res.json();
          if (Array.isArray(serverServices) && serverServices.length > 0) {
            this._set('blopez_services', serverServices);
            return serverServices;
          }
        }
      } catch (e) {}
      const cached = this._get('blopez_services');
      if (Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
      this._set('blopez_services', SEED_SERVICES);
      return SEED_SERVICES;
    }
    async findAppointmentById(id) { return this._get('blopez_appointments').find((a) => a.id === id) || null; }
    async findAppointmentsByDate(date) {
      const all = await this.findAllAppointments();
      return all.filter((a) => a.date === date);
    }

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
      try {
        const res = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appt)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'El turno seleccionado no pudo ser reservado en el servidor.');
        }
        const data = await res.json();
        const savedAppt = data.appointment || appt;
        const list = this._get('blopez_appointments');
        const existingIdx = list.findIndex((a) => a.id === savedAppt.id);
        if (existingIdx !== -1) {
          list[existingIdx] = savedAppt;
        } else {
          list.push(savedAppt);
        }
        this._set('blopez_appointments', list);
        return savedAppt;
      } catch (e) {
        throw e;
      }
    }

    async updateAppointment(appt) {
      try {
        const res = await fetch(`/api/appointments/${appt.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appt)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No fue posible actualizar la cita.');
        }
        const data = await res.json();
        const savedAppt = data.appointment || appt;
        const list = this._get('blopez_appointments');
        const idx = list.findIndex((a) => a.id === savedAppt.id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...savedAppt };
        } else {
          list.push(savedAppt);
        }
        this._set('blopez_appointments', list);
        return savedAppt;
      } catch (e) {
        throw e;
      }
    }

    async saveCutHistory(rec) {
      const list = this._get('blopez_history');
      const alreadyInList = rec.appointmentId && list.some((h) => h.appointmentId === rec.appointmentId);
      if (!alreadyInList) {
        list.push(rec);
        this._set('blopez_history', list);
      }
      try {
        const res = await fetch('/api/history', {
          method: 'POST',
          headers: this._getAuthHeaders(),
          body: JSON.stringify(rec)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No fue posible registrar el corte en el historial.');
        }
      } catch (e) {
        throw e;
      }
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


async findAllProducts() {
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const serverProducts = await res.json();
          if (Array.isArray(serverProducts)) {
            this._set('blopez_products', serverProducts);
            return serverProducts;
          }
        }
      } catch (e) {}
      return this._get('blopez_products');
    }

    async saveProduct(productData) {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: this._getAuthHeaders(),
        body: JSON.stringify(productData)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'No fue posible crear el producto.');
      }
      const data = await res.json();
      if (Array.isArray(data.products)) {
        this._set('blopez_products', data.products);
      }
      return data.product;
    }

    async updateProduct(productId, updates) {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
        method: 'PUT',
        headers: this._getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'No fue posible actualizar el producto.');
      }
      const data = await res.json();
      if (Array.isArray(data.products)) {
        this._set('blopez_products', data.products);
      }
      return data.product;
    }

    async deleteProduct(productId) {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers: this._getAuthHeaders()
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'No fue posible eliminar el producto.');
      }
      const data = await res.json();
      if (Array.isArray(data.products)) {
        this._set('blopez_products', data.products);
      }
      return true;
    }

    async findAllStoreOrders() {
      try {
        const res = await fetch('/api/store/orders');
        if (res.ok) {
          const serverOrders = await res.json();
          if (Array.isArray(serverOrders)) {
            this._set('blopez_store_orders', serverOrders);
            return serverOrders;
          }
        }
      } catch (e) {}
      return this._get('blopez_store_orders');
    }

    async createStoreOrder({ productId, quantity, clientName, clientPhone }) {
      const res = await fetch('/api/store/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity, clientName, clientPhone })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'No fue posible registrar el pedido en tienda.');
      }
      const data = await res.json();
      return data;
    }

    async deliverStoreOrder(orderIdOrRef) {
      const res = await fetch(`/api/store/orders/${encodeURIComponent(orderIdOrRef)}/deliver`, {
        method: 'PUT',
        headers: this._getAuthHeaders()
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'No fue posible confirmar la entrega del pedido.');
      }
      const data = await res.json();
      if (Array.isArray(data.orders)) {
        this._set('blopez_store_orders', data.orders);
      }
      return data.order;
    }

    async cancelStoreOrder(orderIdOrRef) {
      const res = await fetch(`/api/store/orders/${encodeURIComponent(orderIdOrRef)}/cancel`, {
        method: 'PUT',
        headers: this._getAuthHeaders()
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'No fue posible cancelar el pedido.');
      }
      const data = await res.json();
      if (Array.isArray(data.orders)) {
        this._set('blopez_store_orders', data.orders);
      }
      if (Array.isArray(data.products)) {
        this._set('blopez_products', data.products);
      }
      return data.order;
    }

    async deleteAppointment(id) {
      try {
        const res = await fetch(`/api/appointments/${id}`, {
          method: 'DELETE',
          headers: this._getAuthHeaders()
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No fue posible eliminar la cita.');
        }
      } catch (e) {
        throw e;
      }
      let list = this._get('blopez_appointments');
      list = list.filter((a) => a.id !== id);
      this._set('blopez_appointments', list);
      return true;
    }

    async deleteCutHistory(id) {
      try {
        const res = await fetch(`/api/history/${id}`, {
          method: 'DELETE',
          headers: this._getAuthHeaders()
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No fue posible eliminar el registro del historial.');
        }
      } catch (e) {
        throw e;
      }
      let list = this._get('blopez_history');
      list = list.filter((h) => h.id !== id);
      this._set('blopez_history', list);
      return true;
    }

    async clearControlTests() {
      try {
        const res = await fetch('/api/control/clear-tests', {
          method: 'POST',
          headers: this._getAuthHeaders()
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No fue posible vaciar el historial en el servidor.');
        }
      } catch (e) {
        throw e;
      }
      this._set('blopez_appointments', []);
      this._set('blopez_history', []);
      return true;

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
      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}&ctz=America/Bogota`;

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
      const icsDownloadUrl = `/api/calendar/appointment/${appointment.id}.ics`;
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
    async execute({ clientName, clientPhone, barberId, serviceId, pigmentacion = 'pig-none', additionals = [], date, startTime, paymentMethod }) {
      if (isSlotInPast(date, startTime)) {
        throw new Error("El horario seleccionado ya ha transcurrido. Por favor selecciona una hora disponible actual o futura.");
      }

      const barber = await this.repo.findBarberById(barberId);
      if (!barber) throw new Error("Barbero no encontrado.");

      const service = await this.repo.findServiceById(serviceId);
      if (!service) throw new Error("Servicio no encontrado.");

      const [h, m] = startTime.split(':').map(Number);
      const endTotalMinutes = h * 60 + m + (service.durationMinutes || 30);
      const endH = String(Math.floor(endTotalMinutes / 60)).padStart(2, '0');
      const endM = String(endTotalMinutes % 60).padStart(2, '0');
      const endTime = `${endH}:${endM}`;

      const existingAppointments = await this.repo.findAppointmentsByDate(date);
      const isAvailable = AvailabilityService.isSlotAvailable(existingAppointments, barberId, date, startTime, endTime);

      if (!isAvailable) {
        throw new Error(`El barbero ${barber.name} ya tiene un turno reservado en esa franja horaria.`);
      }

      let extrasTotal = 0;
      const extraLabels = [];

      if (pigmentacion === 'pig-aero') {
        extrasTotal += 18000;
        extraLabels.push('Pigmentación Aerógrafo (+$18.000)');
      } else if (pigmentacion === 'pig-manual') {
        extrasTotal += 22000;
        extraLabels.push('Pigmentación Manual (+$22.000)');
      }

      if (Array.isArray(additionals)) {
        if (additionals.includes('extra-cejas')) {
          extrasTotal += 3000;
          extraLabels.push('Cejas (+$3.000)');
        }
        if (additionals.includes('extra-barba')) {
          extrasTotal += 10000;
          extraLabels.push('Barba (+$10.000)');
        }
        if (additionals.includes('extra-afeitado')) {
          extrasTotal += 6000;
          extraLabels.push('Afeitado tradicional (+$6.000)');
        }
      }

      const totalPriceCop = (service.priceCop || 0) + extrasTotal;
      const serviceFullTitle = extraLabels.length > 0 
        ? `${service.name} + ${extraLabels.map(l => l.split(' (')[0]).join(' + ')}`
        : service.name;

      const appointment = new Appointment({
        clientName,
        clientPhone,
        barberId,
        serviceId,
        serviceName: serviceFullTitle,
        additionals: extraLabels,
        totalPriceCop,
        date,
        startTime,
        endTime,
        paymentMethod
      });

      const saved = await this.repo.saveAppointment(appointment);
      const calendarPayload = this.calendarGateway.generateSyncData({
        appointment: saved,
        barberName: barber.name,
        serviceName: serviceFullTitle,
        priceCop: totalPriceCop
      });

      return { appointment: saved, barber, service, calendarPayload, totalPriceCop, serviceFullTitle, extraLabels };
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

      const historyList = await this.repo.findAllCutHistory();
      const existingRecord = historyList.find((h) => h.appointmentId === appointmentId);

      const service = await this.repo.findServiceById(appointment.serviceId);
      const priceCop = appointment.totalPriceCop || (service ? service.priceCop : 0);

      appointment.status = AppointmentStatus.COMPLETADA;
      await this.repo.updateAppointment(appointment);

      if (existingRecord) {
        return { appointment, cutRecord: existingRecord, duplicatePrevented: true };
      }

      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todayDateStr = getLocalDateString(now);

      const cutRecord = new CutHistory({
        appointmentId: appointment.id,
        barberId: appointment.barberId,
        clientName: appointment.clientName,
        date: todayDateStr,
        executionDate: todayDateStr,
        appointmentDate: appointment.date,
        time: currentTime,
        priceCop: priceCop,
        createdAt: now.toISOString()
      });

      await this.repo.saveCutHistory(cutRecord);
      return { appointment, cutRecord };
    }
  }

  class LoginUseCase {
    constructor({ repo }) { this.repo = repo; }
    async execute({ username, password }) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            localStorage.setItem('blopez_token', data.token);
          }
          return { user: data.user, barber: data.barber };
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Credenciales inválidas o usuario inactivo.');
        }
      } catch (err) {
        throw err;
      }
    }
  }

  class ManageUsersUseCase {
    constructor({ repo }) { this.repo = repo; }
    async createBarber({ adminUser, name, specialty, phone, username, password, role }) {
      if (!AccessControlService.canManageCredentials(adminUser)) {
        throw new Error("Acceso denegado: se requieren permisos administrativos.");
      }
      const existing = await this.repo.findUserByUsername(username);
      if (existing) throw new Error(`El usuario '@${username}' ya existe.`);

      // Intento de creacion atomica integral en el servidor
      try {
        const res = await fetch('/api/barbers/with-user', {
          method: 'POST',
          headers: this.repo._getAuthHeaders(),
          body: JSON.stringify({
            barberData: { name, specialty, phone },
            userData: { username, password, role }
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.barber && data.user) {
            const barbers = this.repo._get('blopez_barbers');
            barbers.push(data.barber);
            this.repo._set('blopez_barbers', barbers);

            const users = this.repo._get('blopez_users');
            users.push(data.user);
            this.repo._set('blopez_users', users);

            return { user: data.user, barber: data.barber };
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'No fue posible registrar el barbero en el servidor.');
        }
      } catch (err) {
        if (err.message && (err.message.includes('servidor') || err.message.includes('ya existe') || err.message.includes('denegado'))) {
          throw err;
        }
      }

      // Fallback transaccional seguro
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
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30'
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

  let initialUser = null;
  try {
    const rawUser = localStorage.getItem('blopez_current_user');
    const token = localStorage.getItem('blopez_token');
    if (rawUser && token) {
      initialUser = JSON.parse(rawUser);
    }
  } catch (e) {}

  // --- CAPA 4: UI STATE ---
  const state = {
    currentUser: initialUser,
    services: [],
    barbers: [],
    appointments: [],
    history: [],
    products: [],
    storeOrders: [],
    activeView: 'home',
    storeCategoryFilter: 'ALL',
    storeOrderSearch: '',
    storeOrderStatusFilter: 'ALL',
    calendarYear: initialNow.getFullYear(),
    calendarMonth: initialNow.getMonth(),
    selectedDate: initialDateStr,
    selectedBarberFilter: 'ALL',
    dashboardBarberFilter: 'ALL',
    historyBarberFilter: 'ALL',
    historyFilter: 'ALL',
    historySearch: '',
    bookingModalOpen: false,
    confirmationModalData: null,
    bookingForm: {
      barberId: null,
      serviceId: null,
      pigmentacion: 'pig-none',
      extras: [],
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
    const products = await repo.findAllProducts();
    const storeOrders = await repo.findAllStoreOrders();

    state.services = services;
    state.barbers = barbers;
    state.appointments = appointments;
    state.history = history;
    state.products = products;
    state.storeOrders = storeOrders;

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
                <button type="button" id="btn-hero-open-store" class="btn-stone-outline text-[#f3e5ab] border-[#d4af37]/40 cursor-pointer">
                  Explorar Tienda de Productos →
                </button>
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
            <div class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#d4af37] mb-2">03 / CATÁLOGO OFICIAL & SERVICIOS</div>
            <h2 class="type-display-editorial text-[36px] sm:text-[46px] leading-[1.05] text-[#ffffff]">
              Servicios de autor & combos insignia
            </h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <!-- Card 1: Corte Básico -->
            <div class="bg-[#12151b] border border-[#d4af37]/25 rounded-[24px] p-7 flex flex-col justify-between min-h-[240px] hover:border-[#d4af37]/50 transition-all shadow-lg">
              <div>
                <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#a39578] block mb-2">01 / CORTE TRADICIONAL</span>
                <h3 class="font-serif-editorial text-[26px] font-normal text-[#ffffff] mb-2">Corte Básico</h3>
                <p class="font-sans-ui text-[14px] text-[#c5c0b6] leading-relaxed font-normal">
                  Corte tradicional o degradado a máquina y tijera + masaje capilar relajante al finalizar.
                </p>
              </div>
              <div class="flex items-center justify-between pt-4 mt-4 border-t border-[#d4af37]/20">
                <span class="font-mono-tech text-[20px] font-bold text-[#d4af37]">$20.000 COP</span>
                <span class="font-sans-ui text-xs text-[#a39578]">30 MINUTOS</span>
              </div>
            </div>

            <!-- Card 2: Combo 1 -->
            <div class="bg-[#12151b] border border-[#d4af37]/25 rounded-[24px] p-7 flex flex-col justify-between min-h-[240px] hover:border-[#d4af37]/50 transition-all shadow-lg">
              <div>
                <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#a39578] block mb-2">02 / CORTE + RELAJACIÓN</span>
                <h3 class="font-serif-editorial text-[26px] font-normal text-[#ffffff] mb-2">Combo 1</h3>
                <p class="font-sans-ui text-[14px] text-[#c5c0b6] leading-relaxed font-normal">
                  Corte de cabello completo + masaje de espalda descontracturante + mascarilla negra purificante + perfilado de cejas.
                </p>
              </div>
              <div class="flex items-center justify-between pt-4 mt-4 border-t border-[#d4af37]/20">
                <span class="font-mono-tech text-[20px] font-bold text-[#d4af37]">$25.000 COP</span>
                <span class="font-sans-ui text-xs text-[#a39578]">30 MINUTOS</span>
              </div>
            </div>

            <!-- Card 3: Combo 2 -->
            <div class="bg-[#12151b] border border-[#d4af37]/25 rounded-[24px] p-7 flex flex-col justify-between min-h-[240px] hover:border-[#d4af37]/50 transition-all shadow-lg">
              <div>
                <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#a39578] block mb-2">03 / CORTE + BARBA + SPA</span>
                <h3 class="font-serif-editorial text-[26px] font-normal text-[#ffffff] mb-2">Combo 2</h3>
                <p class="font-sans-ui text-[14px] text-[#c5c0b6] leading-relaxed font-normal">
                  Corte de cabello + masaje capilar + mascarilla facial + ritual de barba con toalla caliente + perfilado de cejas.
                </p>
              </div>
              <div class="flex items-center justify-between pt-4 mt-4 border-t border-[#d4af37]/20">
                <span class="font-mono-tech text-[20px] font-bold text-[#d4af37]">$35.000 COP</span>
                <span class="font-sans-ui text-xs text-[#a39578]">30 MINUTOS</span>
              </div>
            </div>

            <!-- Card 4: Combo 3 -->
            <div class="bg-[#12151b] border border-[#d4af37]/25 rounded-[24px] p-7 flex flex-col justify-between min-h-[240px] hover:border-[#d4af37]/50 transition-all shadow-lg">
              <div>
                <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#a39578] block mb-2">04 / SPA FACIAL COMPLETO</span>
                <h3 class="font-serif-editorial text-[26px] font-normal text-[#ffffff] mb-2">Combo 3</h3>
                <p class="font-sans-ui text-[14px] text-[#c5c0b6] leading-relaxed font-normal">
                  Corte + masaje + mascarilla + barba completa + perfilado de cejas + lavado de cabello con shampoo refrescante.
                </p>
              </div>
              <div class="flex items-center justify-between pt-4 mt-4 border-t border-[#d4af37]/20">
                <span class="font-mono-tech text-[20px] font-bold text-[#d4af37]">$40.000 COP</span>
                <span class="font-sans-ui text-xs text-[#a39578]">30 MINUTOS</span>
              </div>
            </div>

            <!-- Card 5: Combi Completa VIP -->
            <div class="bg-[#12151b] border border-[#d4af37]/25 rounded-[24px] p-7 flex flex-col justify-between min-h-[240px] hover:border-[#d4af37]/50 transition-all shadow-lg">
              <div>
                <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#a39578] block mb-2">05 / EXPERIENCIA TOTAL VIP</span>
                <h3 class="font-serif-editorial text-[26px] font-normal text-[#ffffff] mb-2">Combi Completa VIP</h3>
                <p class="font-sans-ui text-[14px] text-[#c5c0b6] leading-relaxed font-normal">
                  Corte + masaje + mascarilla + barba spa + cejas + lavado de cabello + granizado artesanal de cortesía.
                </p>
              </div>
              <div class="flex items-center justify-between pt-4 mt-4 border-t border-[#d4af37]/20">
                <span class="font-mono-tech text-[20px] font-bold text-[#d4af37]">$65.000 COP</span>
                <span class="font-sans-ui text-xs text-[#a39578]">30 MINUTOS</span>
              </div>
            </div>

            <!-- Card 6: Adicionales & Pigmentación -->
            <div class="bg-gradient-to-br from-[#161a22] to-[#101217] border border-[#d4af37]/45 rounded-[24px] p-7 flex flex-col justify-between min-h-[240px] shadow-xl">
              <div>
                <span class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#d4af37] block mb-2">OPCIONALES / PERSONALIZACIÓN</span>
                <h3 class="font-serif-editorial text-[26px] font-normal text-[#ffffff] mb-2">Adicionales de Autor</h3>
                <div class="font-sans-ui text-[13px] text-[#c5c0b6] space-y-1.5 leading-relaxed">
                  <div class="flex justify-between"><span>Pigmentación Aerógrafo:</span><strong class="text-[#f3e5ab] font-mono-tech">$18.000</strong></div>
                  <div class="flex justify-between"><span>Pigmentación Manual:</span><strong class="text-[#f3e5ab] font-mono-tech">$22.000</strong></div>
                  <div class="flex justify-between"><span>Perfilado de Cejas:</span><strong class="text-[#f3e5ab] font-mono-tech">$3.000</strong></div>
                  <div class="flex justify-between"><span>Ritual de Barba:</span><strong class="text-[#f3e5ab] font-mono-tech">$10.000</strong></div>
                  <div class="flex justify-between"><span>Afeitado tradicional:</span><strong class="text-[#f3e5ab] font-mono-tech">$6.000</strong></div>
                </div>
              </div>
              <div class="pt-4 mt-4 border-t border-[#d4af37]/20 text-xs text-[#a39578]">
                Añádelos al agendar tu turno
              </div>
            </div>

          </div>
        </section>
      `;
    } else if (state.activeView === 'store') {
      const activeProducts = products.filter((p) => p.active !== false);
      const categories = ['ALL', ...Array.from(new Set(activeProducts.map((p) => p.category || 'General')))];
      const filteredProducts = state.storeCategoryFilter === 'ALL'
        ? activeProducts
        : activeProducts.filter((p) => (p.category || 'General') === state.storeCategoryFilter);

      mainContent = `
        <section class="max-w-[1240px] mx-auto px-6 md:px-12 py-12 font-sans-ui">
          
          <!-- Encabezado Editorial de la Tienda -->
          <div class="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-10 pb-8 border-b border-[rgba(212,175,55,0.22)]">
            <div>
              <div class="inline-flex items-center gap-2 mb-3 px-3.5 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.35)] text-[#f3e5ab] text-xs font-semibold tracking-wider uppercase">
                <span class="w-2 h-2 rounded-full bg-[#d4af37] shadow-[0_0_8px_#d4af37]"></span>
                <span>BOUTIQUE OFICIAL · PAGO EXCLUSIVO EN EFECTIVO</span>
              </div>
              <h1 class="type-display-editorial text-[36px] sm:text-[48px] leading-[1.05] text-[#ffffff] tracking-tight">
                Tienda & Cuidado Masculino
              </h1>
              <p class="font-serif-editorial text-[#c5c0b6] max-w-2xl text-[17px] sm:text-[19px] mt-2 leading-relaxed">
                Aparta tus productos de barbería en línea. El sistema genera una <strong>Referencia Única de Pago</strong> y reserva tus unidades en inventario para que las reclames y pagues en efectivo directamente en la barbería.
              </p>
            </div>
            <button type="button" id="btn-store-back-home" class="btn-stone-outline text-xs font-semibold py-2.5 px-5 whitespace-nowrap cursor-pointer">
              ← Volver a la agenda de cortes
            </button>
          </div>

          <!-- BANDA INFORMATIVA DEL PROTOCOLO ANTI-ROBO CON REFERENCIA -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <div class="bg-[#12151b] border border-[rgba(212,175,55,0.25)] rounded-[16px] p-5">
              <div class="text-xs font-mono-tech font-bold text-[#d4af37] uppercase tracking-wider mb-1">PASO 01 · SELECCIONA Y APARTA</div>
              <p class="text-xs text-[#c5c0b6] leading-relaxed">Elige el producto y la cantidad deseada. Nuestro sistema descuenta y separa tu unidad inmediatamente del stock disponible.</p>
            </div>
            <div class="bg-[#12151b] border border-[rgba(212,175,55,0.25)] rounded-[16px] p-5">
              <div class="text-xs font-mono-tech font-bold text-[#d4af37] uppercase tracking-wider mb-1">PASO 02 · GUARDA TU REFERENCIA</div>
              <p class="text-xs text-[#c5c0b6] leading-relaxed">Recibirás un comprobante con código único <strong>REF-BL-XXXX</strong> en pantalla que podrás guardar o enviar por WhatsApp.</p>
            </div>
            <div class="bg-[#12151b] border border-[rgba(212,175,55,0.25)] rounded-[16px] p-5">
              <div class="text-xs font-mono-tech font-bold text-[#d4af37] uppercase tracking-wider mb-1">PASO 03 · PAGA EN EFECTIVO Y RECIBE</div>
              <p class="text-xs text-[#c5c0b6] leading-relaxed">Presenta tu referencia en Barbería Lopez, realiza el pago en efectivo y el barbero validará el código para entregarte tu producto.</p>
            </div>
          </div>

          <!-- FILTRO DE CATEGORÍAS -->
          <div class="flex flex-wrap items-center justify-between gap-4 mb-8 bg-[#12151b] border border-[rgba(212,175,55,0.2)] rounded-[16px] p-4">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#d4af37]"></span>
              <span class="text-xs font-semibold uppercase tracking-wider text-[#f3e5ab]">CATEGORÍAS DE TIENDA:</span>
            </div>
            <div class="flex flex-wrap gap-2">
              ${categories.map((cat) => {
                const isSelected = state.storeCategoryFilter === cat;
                const label = cat === 'ALL' ? `Todos los productos (${activeProducts.length})` : cat;
                return `
                  <button
                    type="button"
                    data-store-cat="${escapeHtml(cat)}"
                    class="btn-store-cat ${isSelected ? 'btn-clay' : 'btn-stone-outline'} py-1.5 px-4 text-xs font-semibold cursor-pointer">
                    ${escapeHtml(label)}
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- CATÁLOGO DE PRODUCTOS -->
          ${filteredProducts.length === 0 ? `
            <div class="anthropic-card p-12 text-center">
              <h3 class="font-serif-editorial text-2xl text-[#ffffff] mb-2">No hay productos en esta categoría</h3>
              <p class="text-sm text-[#c5c0b6]">Selecciona otra categoría o consulta nuevamente más tarde.</p>
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
              ${filteredProducts.map((p) => {
                const outOfStock = (Number(p.stock) || 0) <= 0;
                return `
                  <div class="bg-[#12151b] border ${outOfStock ? 'border-stone-800 opacity-75' : 'border-[rgba(212,175,55,0.28)] hover:border-[#d4af37]'} rounded-[22px] overflow-hidden flex flex-col justify-between transition-all shadow-xl">
                    <div>
                      <div class="relative h-56 w-full bg-[#0a0b0d] overflow-hidden border-b border-[rgba(212,175,55,0.18)]">
                        <img
                          src="${escapeHtml(p.imageUrl || './logo_barberia_lopez_hd.jpg')}"
                          alt="${escapeHtml(p.name)}"
                          class="w-full h-full object-cover object-center transition-transform duration-500 hover:scale-105"
                          onerror="this.src='./logo_barberia_lopez_hd.jpg'"
                        >
                        <div class="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#0a0b0d]/85 backdrop-blur-md border border-[rgba(212,175,55,0.35)] text-[11px] font-semibold text-[#f3e5ab] uppercase tracking-wider">
                          ${escapeHtml(p.category || 'Cuidado Personal')}
                        </div>
                        <div class="absolute top-3 right-3 px-3 py-1 rounded-full font-mono-tech text-[11px] font-bold ${
                          outOfStock
                            ? 'bg-red-950/90 border border-red-700 text-red-300'
                            : 'bg-[#0a0b0d]/90 border border-[#d4af37] text-[#d4af37]'
                        }">
                          ${outOfStock ? 'AGOTADO' : `${p.stock} EN STOCK`}
                        </div>
                      </div>

                      <div class="p-6">
                        <h3 class="font-serif-editorial text-[24px] font-normal text-[#ffffff] leading-snug mb-2">
                          ${escapeHtml(p.name)}
                        </h3>
                        <p class="font-sans-ui text-xs sm:text-sm text-[#c5c0b6] leading-relaxed">
                          ${escapeHtml(p.description || 'Producto profesional de barbería.')}
                        </p>
                      </div>
                    </div>

                    <div class="px-6 pb-6 pt-4 border-t border-[rgba(212,175,55,0.16)] flex items-center justify-between gap-4">
                      <div>
                        <span class="block text-[10px] font-semibold uppercase tracking-wider text-[#8a8275]">Pago en efectivo</span>
                        <span class="font-mono-tech text-[22px] font-bold text-[#d4af37]">$${Number(p.priceCop || 0).toLocaleString('es-CO')} <span class="text-xs font-sans-ui text-[#f3e5ab]">COP</span></span>
                      </div>
                      ${outOfStock ? `
                        <button type="button" disabled class="btn-stone-outline py-2.5 px-4 text-xs font-semibold opacity-50 cursor-not-allowed">
                          Sin existencias
                        </button>
                      ` : `
                        <button
                          type="button"
                          data-buy-product-id="${escapeHtml(p.id)}"
                          class="btn-buy-store-product btn-clay py-2.5 px-5 text-xs font-semibold cursor-pointer">
                          Comprar y generar referencia →
                        </button>
                      `}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}

        </section>
      `;
    } else if (state.activeView === 'dashboard' && state.currentUser) {
      const todayStr = getLocalDateString();
      const cashData = CashCalculatorService.calculateDailyCash(state.history, todayStr, state.storeOrders);
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
            <div class="flex items-center gap-2">
              ${isJefe ? `
                <button id="btn-clear-control-tests" class="btn-stone-outline text-xs text-red-400 hover:text-red-300 hover:border-red-500 font-medium py-2 px-3">
                  Limpiar solicitudes de prueba
                </button>
              ` : ''}
              <button id="btn-dashboard-back-home" class="btn-stone-outline text-xs font-medium py-2 px-4">
                ← Volver al inicio
              </button>
            </div>
          </div>

          ${isJefe ? `
            <!-- CAJA CONSOLIDADA HOY (EXCLUSIVO BARBERO JEFE) -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
              <div class="anthropic-card p-6 border border-[rgba(212,175,55,0.4)]">
                <span class="block text-xs font-semibold text-[#d4af37] uppercase tracking-wider mb-2">Gran Total Caja Hoy</span>
                <div class="text-2xl sm:text-3xl font-mono-tech font-bold text-[#ffffff] tracking-tight">
                  $${cashData.totalConsolidatedCop.toLocaleString('es-CO')} <span class="text-xs font-sans-ui font-semibold text-[#d4af37]">COP</span>
                </div>
                <span class="text-xs font-medium text-[#c5c0b6] mt-2 block">Cortes ($${cashData.cutsTotalCop.toLocaleString('es-CO')}) + Tienda ($${cashData.storeTotalCop.toLocaleString('es-CO')})</span>
              </div>
              <div class="anthropic-card p-6">
                <span class="block text-xs font-semibold text-[#f3e5ab] uppercase tracking-wider mb-2">Ventas Tienda Hoy (Efectivo)</span>
                <div class="text-2xl sm:text-3xl font-mono-tech font-bold text-[#d4af37] tracking-tight">
                  $${cashData.storeTotalCop.toLocaleString('es-CO')} <span class="text-xs font-sans-ui font-semibold text-[#8a8275]">COP</span>
                </div>
                <span class="text-xs font-medium text-[#8a8275] mt-2 block">${cashData.storeOrdersCount} ${cashData.storeOrdersCount === 1 ? 'pedido entregado hoy' : 'pedidos entregados hoy'}</span>
              </div>
              ${barbers.map((b) => `
                <div class="anthropic-card p-6">
                  <span class="block text-xs font-semibold text-[#c5c0b6] uppercase tracking-wider mb-2">Estación ${escapeHtml(b.name)}</span>
                  <div class="text-2xl sm:text-3xl font-mono-tech font-bold text-[#ffffff] tracking-tight">
                    $${(cashData.breakdownByBarber[b.id]?.total || 0).toLocaleString('es-CO')} <span class="text-xs font-sans-ui font-semibold text-[#8a8275]">COP</span>
                  </div>
                  <span class="text-xs font-medium text-[#8a8275] mt-2 block">Cortes realizados: ${cashData.breakdownByBarber[b.id]?.count || 0}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- DESPACHO DE TIENDA Y VERIFICACIÓN DE REFERENCIAS DE PAGO (ANTI-ROBO) -->
          <div class="mb-12">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-[rgba(212,175,55,0.22)]">
              <div>
                <div class="inline-flex items-center gap-2 mb-1 px-2.5 py-0.5 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)] text-[#f3e5ab] text-[11px] font-semibold">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></span>
                  <span>CONTROL ANTI-ROBO · SOLO PAGO EN EFECTIVO</span>
                </div>
                <h3 class="font-serif-editorial text-xl sm:text-2xl font-normal text-[#ffffff] tracking-tight">
                  Verificación de Referencias y Entrega de Productos
                </h3>
                <p class="font-sans-ui text-xs sm:text-sm text-[#c5c0b6] mt-0.5">
                  Cuando el cliente venga a reclamar su producto, verifica aquí su código <strong>REF-BL-XXXX</strong>, recibe el efectivo y confirma la entrega.
                </p>
              </div>
              <div class="flex items-center gap-2 self-start sm:self-auto">
                <span class="text-xs font-mono-tech font-bold text-[#d4af37] bg-[#181c24] px-3 py-1.5 rounded-full border border-[rgba(212,175,55,0.3)]">
                  ${state.storeOrders.filter((o) => o.status === 'PENDIENTE').length} pendientes por reclamar
                </span>
              </div>
            </div>

            <!-- BUSCADOR DE REFERENCIA RÁPIDA Y FILTRO DE ESTADO -->
            <div class="anthropic-card p-4 mb-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs font-semibold text-[#8a8275] uppercase tracking-wider mr-1">Estado:</span>
                <button type="button" data-order-status-filter="ALL" class="btn-order-status-filter px-3 py-1.5 rounded-[8px] text-xs font-semibold cursor-pointer ${state.storeOrderStatusFilter === 'ALL' ? 'btn-clay' : 'btn-stone-outline'}">
                  Todos (${state.storeOrders.length})
                </button>
                <button type="button" data-order-status-filter="PENDIENTE" class="btn-order-status-filter px-3 py-1.5 rounded-[8px] text-xs font-semibold cursor-pointer ${state.storeOrderStatusFilter === 'PENDIENTE' ? 'btn-clay' : 'btn-stone-outline'}">
                  Pendientes de cobro (${state.storeOrders.filter((o) => o.status === 'PENDIENTE').length})
                </button>
                <button type="button" data-order-status-filter="ENTREGADO" class="btn-order-status-filter px-3 py-1.5 rounded-[8px] text-xs font-semibold cursor-pointer ${state.storeOrderStatusFilter === 'ENTREGADO' ? 'btn-clay' : 'btn-stone-outline'}">
                  Entregados (${state.storeOrders.filter((o) => o.status === 'ENTREGADO').length})
                </button>
              </div>
              <div class="relative flex-1 md:max-w-xs">
                <input
                  type="text"
                  id="input-store-order-search"
                  placeholder="Buscar referencia REF-BL-... o cliente"
                  value="${escapeHtml(state.storeOrderSearch || '')}"
                  class="input-parchment py-1.5 px-3 text-xs font-mono-tech uppercase"
                >
              </div>
            </div>

            <!-- TABLA / TARJETAS DE PEDIDOS DE TIENDA -->
            ${(() => {
              const filteredOrders = state.storeOrders.filter((o) => {
                if (state.storeOrderStatusFilter !== 'ALL' && o.status !== state.storeOrderStatusFilter) return false;
                if (state.storeOrderSearch && state.storeOrderSearch.trim() !== '') {
                  const q = state.storeOrderSearch.toLowerCase().trim();
                  const matchRef = (o.referenceCode || '').toLowerCase().includes(q);
                  const matchClient = (o.clientName || '').toLowerCase().includes(q);
                  const matchPhone = (o.clientPhone || '').toLowerCase().includes(q);
                  const matchProd = (o.productName || '').toLowerCase().includes(q);
                  return matchRef || matchClient || matchPhone || matchProd;
                }
                return true;
              });

              if (filteredOrders.length === 0) {
                return `
                  <div class="bg-[#12151b] rounded-[14px] border border-dashed border-[rgba(212,175,55,0.2)] p-8 text-center">
                    <p class="font-serif-editorial text-lg text-[#c5c0b6]">No hay pedidos de tienda que coincidan con el filtro actual</p>
                    <p class="text-xs text-[#8a8275] mt-1">Cuando un cliente compre un producto en el apartado TIENDA, su referencia aparecerá aquí al instante.</p>
                  </div>
                `;
              }

              return `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  ${filteredOrders.map((ord) => {
                    const isPending = ord.status === 'PENDIENTE';
                    const isDelivered = ord.status === 'ENTREGADO';
                    return `
                      <div class="store-order-card anthropic-card p-5 flex flex-col justify-between border ${
                        isPending
                          ? 'border-[#d4af37]/50 bg-[#161a22]'
                          : isDelivered
                          ? 'border-emerald-700/40 bg-[#12151b]'
                          : 'border-stone-800 bg-[#12151b] opacity-65'
                      }">
                        <div>
                          <div class="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-[rgba(212,175,55,0.15)]">
                            <span class="font-mono-tech text-sm font-bold text-[#d4af37] bg-[#0a0b0d] px-3 py-1 rounded border border-[#d4af37]/40 tracking-wider">
                              ${escapeHtml(ord.referenceCode)}
                            </span>
                            <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                              isPending
                                ? 'bg-[#d4af37]/20 text-[#f3e5ab] border border-[#d4af37]/40'
                                : isDelivered
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50'
                                : 'bg-red-950/60 text-red-300 border border-red-800/50'
                            }">
                              ${isPending ? 'PENDIENTE DE PAGO' : isDelivered ? 'COBRADO Y ENTREGADO' : 'CANCELADO'}
                            </span>
                          </div>

                          <h5 class="font-serif-editorial text-lg text-[#ffffff] leading-snug mb-1">
                            ${escapeHtml(ord.productName)}
                          </h5>
                          <p class="text-xs font-mono-tech text-[#f3e5ab] mb-3">
                            Cantidad: <strong>${ord.quantity} und</strong> · Total Efectivo: <strong class="text-[#d4af37]">$${Number(ord.totalCop || 0).toLocaleString('es-CO')} COP</strong>
                          </p>

                          <div class="space-y-1 text-xs bg-[#0a0b0d]/70 p-3 rounded-[8px] border border-[rgba(212,175,55,0.12)] mb-4">
                            <div class="flex justify-between">
                              <span class="text-[#8a8275]">Cliente:</span>
                              <span class="text-[#ffffff] font-semibold">${escapeHtml(ord.clientName)}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="text-[#8a8275]">WhatsApp:</span>
                              <span class="text-[#c5c0b6] font-mono-tech">${escapeHtml(ord.clientPhone)}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="text-[#8a8275]">Fecha pedido:</span>
                              <span class="text-[#c5c0b6]">${escapeHtml(ord.date || '')}</span>
                            </div>
                            ${isDelivered && ord.deliveredBy ? `
                              <div class="flex justify-between pt-1 border-t border-[rgba(212,175,55,0.12)]">
                                <span class="text-[#8a8275]">Entregado por:</span>
                                <span class="text-[#d4af37] font-mono-tech">@${escapeHtml(ord.deliveredBy)}</span>
                              </div>
                            ` : ''}
                          </div>
                        </div>

                        ${isPending ? `
                          <div class="space-y-2">
                            <button
                              type="button"
                              data-deliver-order-id="${escapeHtml(ord.id)}"
                              data-deliver-ref="${escapeHtml(ord.referenceCode)}"
                              class="btn-deliver-store-order btn-clay w-full py-2.5 px-3 text-xs font-semibold justify-center cursor-pointer">
                              Confirmar pago en efectivo y entregar →
                            </button>
                            <button
                              type="button"
                              data-cancel-order-id="${escapeHtml(ord.id)}"
                              data-cancel-ref="${escapeHtml(ord.referenceCode)}"
                              class="btn-cancel-store-order btn-stone-outline w-full py-1.5 px-3 text-[11px] text-red-300 hover:text-red-200 hover:border-red-500 justify-center cursor-pointer">
                              Cancelar pedido y devolver al stock
                            </button>
                          </div>
                        ` : isDelivered ? `
                          <div class="text-xs font-semibold text-emerald-300 py-2 text-center bg-emerald-950/40 border border-emerald-700/40 rounded-[8px]">
                            Producto entregado · Efectivo en caja
                          </div>
                        ` : `
                          <div class="text-xs font-semibold text-[#8a8275] py-2 text-center bg-[#14171f] border border-stone-800 rounded-[8px]">
                            Pedido anulado · Stock restaurado
                          </div>
                        `}
                      </div>
                    `;
                  }).join('')}
                </div>
              `;
            })()}
          </div>

          ${isJefe ? `
            <!-- GESTIÓN DE INVENTARIO Y PRODUCTOS DE TIENDA (EXCLUSIVO BARBERO JEFE / ADMIN) -->
            <div class="mb-12">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-[rgba(212,175,55,0.22)]">
                <div>
                  <div class="inline-flex items-center gap-2 mb-1 px-2.5 py-0.5 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)] text-[#f3e5ab] text-[11px] font-semibold">
                    <span class="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></span>
                    <span>ADMINISTRACIÓN DE BOUTIQUE · MAESTRO LOPEZ</span>
                  </div>
                  <h3 class="font-serif-editorial text-xl sm:text-2xl font-normal text-[#ffffff] tracking-tight">
                    Control de Inventario y Catálogo de Productos
                  </h3>
                  <p class="font-sans-ui text-xs sm:text-sm text-[#c5c0b6] mt-0.5">
                    Agrega nuevos productos a la tienda, ajusta precios en COP, recarga unidades de stock o elimina referencias.
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- FORMULARIO PARA AGREGAR NUEVO PRODUCTO -->
                <div class="anthropic-card p-6">
                  <h4 class="font-serif-editorial text-lg text-[#ffffff] mb-1">Agregar nuevo producto</h4>
                  <p class="text-xs text-[#c5c0b6] mb-4">Publica un artículo inmediatamente en el apartado TIENDA.</p>
                  <form id="form-create-product" class="space-y-3.5">
                    <div>
                      <label class="block text-xs font-semibold text-[#c5c0b6] mb-1">Nombre del producto *</label>
                      <input type="text" id="new-prod-name" required placeholder="Ej. Cera Mate Imperial 120g" class="input-parchment text-xs">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-xs font-semibold text-[#c5c0b6] mb-1">Categoría</label>
                        <input type="text" id="new-prod-category" placeholder="Ej. Cuidado Capilar" value="Cuidado Capilar" class="input-parchment text-xs">
                      </div>
                      <div>
                        <label class="block text-xs font-semibold text-[#c5c0b6] mb-1">Stock inicial *</label>
                        <input type="number" id="new-prod-stock" required min="0" value="10" class="input-parchment text-xs font-mono-tech">
                      </div>
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-[#c5c0b6] mb-1">Precio en Efectivo (COP) *</label>
                      <input type="number" id="new-prod-price" required min="1000" step="500" placeholder="Ej. 32000" class="input-parchment text-xs font-mono-tech">
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-[#c5c0b6] mb-1">URL de Imagen (opcional)</label>
                      <input type="url" id="new-prod-image" placeholder="https://..." class="input-parchment text-xs">
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-[#c5c0b6] mb-1">Descripción breve</label>
                      <textarea id="new-prod-desc" rows="2" placeholder="Beneficios y características del producto..." class="input-parchment text-xs"></textarea>
                    </div>
                    <button type="submit" class="btn-clay w-full py-2.5 justify-center text-xs font-semibold cursor-pointer">
                      Publicar producto en Tienda →
                    </button>
                  </form>
                </div>

                <!-- TABLA DE INVENTARIO ACTUAL -->
                <div class="lg:col-span-2 anthropic-card p-6">
                  <h4 class="font-serif-editorial text-lg text-[#ffffff] mb-1">Inventario activo en tienda (${products.length})</h4>
                  <p class="text-xs text-[#c5c0b6] mb-4">Usa los botones rápidos para sumar/restar stock, cambiar precio o eliminar un producto.</p>
                  <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse font-sans-ui">
                      <thead class="border-b border-[rgba(212,175,55,0.22)] bg-[#161a22] text-[11px] font-semibold text-[#c5c0b6] uppercase tracking-wider">
                        <tr>
                          <th class="p-3">Producto</th>
                          <th class="p-3">Precio (COP)</th>
                          <th class="p-3">Stock Disponible</th>
                          <th class="p-3 text-right">Acciones de Jefe</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-[rgba(212,175,55,0.14)] text-xs">
                        ${products.map((p) => `
                          <tr class="hover:bg-[#181c24] transition-colors">
                            <td class="p-3">
                              <div class="font-semibold text-[#ffffff]">${escapeHtml(p.name)}</div>
                              <div class="text-[11px] text-[#8a8275]">${escapeHtml(p.category || 'General')}</div>
                            </td>
                            <td class="p-3 font-mono-tech font-bold text-[#d4af37]">
                              $${Number(p.priceCop || 0).toLocaleString('es-CO')}
                            </td>
                            <td class="p-3">
                              <div class="inline-flex items-center gap-2">
                                <button type="button" data-stock-prod-id="${escapeHtml(p.id)}" data-stock-delta="-1" class="btn-adjust-stock px-2 py-0.5 rounded bg-[#161a22] border border-[rgba(212,175,55,0.3)] text-[#f3e5ab] hover:border-[#d4af37] font-mono-tech font-bold cursor-pointer">-</button>
                                <span class="font-mono-tech font-bold text-sm ${p.stock <= 2 ? 'text-red-400' : 'text-[#ffffff]'} min-w-[28px] text-center">${p.stock}</span>
                                <button type="button" data-stock-prod-id="${escapeHtml(p.id)}" data-stock-delta="1" class="btn-adjust-stock px-2 py-0.5 rounded bg-[#161a22] border border-[rgba(212,175,55,0.3)] text-[#f3e5ab] hover:border-[#d4af37] font-mono-tech font-bold cursor-pointer">+</button>
                              </div>
                            </td>
                            <td class="p-3 text-right space-x-1.5 whitespace-nowrap">
                              <button type="button" data-edit-prod-id="${escapeHtml(p.id)}" class="btn-edit-product btn-stone-outline py-1 px-2.5 text-[11px] cursor-pointer">
                                Editar precio/stock
                              </button>
                              <button type="button" data-delete-prod-id="${escapeHtml(p.id)}" data-delete-prod-name="${escapeHtml(p.name)}" class="btn-delete-product btn-stone-outline py-1 px-2.5 text-[11px] text-red-400 hover:text-red-300 hover:border-red-500 cursor-pointer">
                                Quitar
                              </button>
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
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
                          const isCompleted = appt.status === 'COMPLETADA' || (state.history && state.history.some((h) => h.appointmentId === appt.id));
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
                                  ${escapeHtml(appt.clientName)}
                                </h5>
                                
                                <p class="text-xs font-medium text-[#d4af37] mb-3">
                                  ${serviceName} ${servicePrice > 0 ? `· $${servicePrice.toLocaleString('es-CO')} COP` : ''}
                                </p>

                                <div class="space-y-1.5 mb-4 text-xs font-sans-ui bg-[#12151b]/70 p-3 rounded-[8px] border border-[rgba(212,175,55,0.1)]">
                                  <div class="flex items-center justify-between text-[#ffffff]">
                                    <span class="text-[#8a8275] font-semibold">Teléfono:</span>
                                    <span class="font-medium text-[#c5c0b6]">${escapeHtml(appt.clientPhone || 'No registrado')}</span>
                                  </div>
                                  <div class="flex items-center justify-between text-[#ffffff]">
                                    <span class="text-[#8a8275] font-semibold">Fecha:</span>
                                    <span class="font-medium text-[#c5c0b6]">${appt.date}</span>
                                  </div>
                                  <div class="flex items-center justify-between text-[#ffffff]">
                                    <span class="text-[#8a8275] font-semibold">Pago:</span>
                                    <span class="font-medium text-[#c5c0b6]">${escapeHtml(appt.paymentMethod)}</span>
                                  </div>
                                </div>
                              </div>

                              ${!isCompleted ? `
                                <button data-appt-id="${appt.id}" class="btn-complete-cut btn-clay w-full py-2.5 px-4 text-xs font-semibold justify-center">
                                  Finalizar corte y guardar en historial →
                                </button>
                                <button data-delete-appt-id="${appt.id}" class="btn-delete-appt btn-stone-outline w-full py-1.5 px-3 text-xs text-red-400 hover:text-red-300 hover:border-red-500 justify-center cursor-pointer mt-2">
                                  Cancelar / Eliminar turno de prueba
                                </button>
                              ` : `
                                <div class="text-xs font-semibold text-[#d4af37] py-2.5 px-3 text-center bg-[#181c24] border border-[rgba(212,175,55,0.3)] rounded-[8px] flex items-center justify-center gap-2">
                                  <span class="w-2 h-2 rounded-full bg-[#d4af37]"></span>
                                  <span>Corte finalizado y registrado en caja</span>
                                </div>
                                <button data-delete-appt-id="${appt.id}" class="btn-delete-appt btn-stone-outline w-full py-1.5 px-3 text-xs text-red-400 hover:text-red-300 hover:border-red-500 justify-center cursor-pointer mt-2">
                                  Eliminar registro de turno
                                </button>
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
                                ${isJefe ? '<th class="p-3.5 text-right pr-4">Accion</th>' : ''}
                              </tr>
                            </thead>
                            <tbody class="divide-y divide-[rgba(212,175,55,0.12)] text-sm">
                              ${bCuts.map((h) => `
                                <tr class="history-cut-row hover:bg-[#181c24] transition-colors">
                                  <td class="p-3.5 pl-4 text-[#ffffff] font-semibold">${escapeHtml(h.clientName)}</td>
                                  <td class="p-3.5 text-[#c5c0b6] text-xs sm:text-sm">
                                    ${formatDateFriendly(h.date)}
                                    ${h.appointmentDate && h.appointmentDate !== h.date ? `<span class="block text-[10px] text-[#8a8275]">Turno: ${h.appointmentDate}</span>` : ''}
                                  </td>
                                  <td class="p-3.5 text-[#f3e5ab] font-mono-tech text-xs">${h.time}</td>
                                  <td class="p-3.5 pr-4 text-right text-[#d4af37] font-bold font-mono-tech text-sm">${h.priceCop.toLocaleString('es-CO')} COP</td>
                                  ${isJefe ? `
                                    <td class="p-3.5 pr-4 text-right">
                                      <button data-delete-history-id="${h.id}" class="btn-delete-history-item text-xs text-red-400 hover:text-red-300 hover:underline cursor-pointer">
                                        Eliminar
                                      </button>
                                    </td>
                                  ` : ''}
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
                          <td class="p-3.5 text-[#ffffff] font-semibold">${escapeHtml(name)}</td>
                          <td class="p-3.5 font-mono-tech text-xs text-[#f3e5ab]">@${escapeHtml(u.username)}</td>
                          <td class="p-3.5"><span class="text-xs font-medium px-2.5 py-0.5 rounded-full bg-[#161a22] border border-[rgba(212,175,55,0.25)] text-[#f3e5ab]">${roleDisplay}</span></td>
                          <td class="p-3.5">
                            <span class="inline-flex items-center gap-1.5 text-xs font-medium text-[#ffffff]">
                              <span class="w-2 h-2 rounded-full ${u.active ? 'bg-[#d4af37]' : 'bg-[#8a8275]'}"></span>
                              ${u.active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td class="p-3.5 text-right space-x-2 whitespace-nowrap">
                            <button data-user-id="${u.id}" data-username="${escapeHtml(u.username)}" class="btn-change-password btn-stone-outline py-1 px-2.5 text-xs font-medium">Cambiar clave</button>
                            ${u.barberId ? `
                              <button data-edit-barber-id="${u.barberId}" data-barber-name="${escapeHtml(name)}" data-barber-specialty="${escapeHtml(barber ? barber.specialty : '')}" class="btn-edit-barber btn-stone-outline py-1 px-2.5 text-xs font-medium text-[#f3e5ab]">
                                Editar nombre
                              </button>
                            ` : ''}
                            ${u.role !== 'ADMIN' ? `
                              <button data-toggle-user-id="${u.id}" class="btn-toggle-status btn-stone-outline py-1 px-2.5 text-xs font-medium">
                                ${u.active ? 'Desactivar' : 'Activar'}
                              </button>
                              <button data-delete-user-id="${u.id}" data-username="${escapeHtml(u.username)}" class="btn-delete-user btn-stone-outline py-1 px-2.5 text-xs font-medium text-red-400 hover:text-red-300 hover:border-red-500">
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
            <a href="#hero" id="nav-link-inicio" class="font-sans-ui text-xs font-semibold uppercase tracking-wider ${state.activeView === 'home' ? 'text-[#d4af37]' : 'text-[#c5c0b6]'} hover:text-[#d4af37] transition-colors">INICIO</a>
            <a href="#calendario" id="nav-link-calendario" class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#c5c0b6] hover:text-[#d4af37] transition-colors">CALENDARIO</a>
            <a href="#servicios" id="nav-link-servicios" class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#c5c0b6] hover:text-[#d4af37] transition-colors">SERVICIOS</a>
            <a href="https://wa.me/573219897910" target="_blank" class="font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#f3e5ab] hover:text-[#d4af37] transition-colors link-editorial">WHATSAPP</a>
            <button type="button" id="btn-nav-store" class="font-sans-ui text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full border transition-all cursor-pointer ${state.activeView === 'store' ? 'bg-[#d4af37] text-[#0a0b0d] border-[#d4af37]' : 'bg-[#181c24] text-[#f3e5ab] border-[rgba(212,175,55,0.45)] hover:border-[#d4af37] hover:text-[#ffffff]'}">
              TIENDA
            </button>
          </nav>

          <!-- Far Right: Auth & Action Button -->
          <div class="flex items-center gap-2 sm:gap-3">
            <button type="button" id="btn-nav-store-mobile" class="md:hidden btn-stone-outline py-2 px-3 text-xs font-semibold text-[#f3e5ab] border-[#d4af37]/50 cursor-pointer">
              TIENDA
            </button>
            ${!isAuth ? `
              <button id="btn-login-trigger" class="btn-stone-outline py-2 px-3.5 text-xs">
                Acceder
              </button>
              <a href="#calendario" id="btn-cta-reservar" class="btn-clay py-2 px-4 text-xs font-medium">
                Reservar cita →
              </a>
            ` : `
              <span class="font-sans-ui text-xs font-semibold text-[#f3e5ab] px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)] hidden sm:inline-block">
                @${state.currentUser.username}
              </span>
              ${state.activeView !== 'home' ? `
                <button id="btn-nav-home" class="btn-stone-outline py-2 px-3.5 text-xs">Inicio</button>
              ` : ''}
              ${state.activeView !== 'dashboard' && state.activeView !== 'admin' ? `
                <button id="btn-nav-panel" class="btn-clay py-2 px-3.5 text-xs">Mi panel →</button>
              ` : ''}
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
      <div id="modal-client-booking" class="modal-backdrop-custom fixed inset-0 z-50 bg-[#0a0b0d]/85 backdrop-blur-sm flex items-center justify-center p-4 ${state.bookingModalOpen ? '' : 'hidden'}">
        <div class="modal-window-custom anthropic-card w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 relative">
          <button id="btn-close-client-booking" class="absolute top-4 right-4 text-[#c5c0b6] hover:text-[#ffffff] text-2xl font-light cursor-pointer">&times;</button>

          <div class="mb-6">
            <div class="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)] text-[#f3e5ab] text-xs font-semibold">
              <span class="w-2 h-2 rounded-full bg-[#d4af37]"></span>
              <span>02 / RESERVA DE TURNO</span>
            </div>
            <h3 class="font-serif-editorial text-[28px] sm:text-[34px] font-normal leading-tight text-[#ffffff] mb-1">Completar reserva de cita</h3>
            <div class="inline-block px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)] font-mono-tech text-xs text-[#f3e5ab] font-bold mt-1">
              ${formatDateFriendly(state.bookingForm.date)} · ${formatTime12h(state.bookingForm.startTime)} (30 MIN)
            </div>
          </div>

          <form id="form-client-booking" class="space-y-6">
            
            <!-- 1. SELECCIÓN DE BARBERO -->
            <div>
              <label class="block font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#d4af37] mb-2">1. Selecciona tu Barbero</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${publicBarbers.map((b) => {
                  const isSelected = state.bookingForm.barberId === b.id;
                  const slotEnd = computeEndTime(state.bookingForm.startTime, 30);
                  const isBarberBusy = !AvailabilityService.isSlotAvailable(
                    state.appointments || [],
                    b.id,
                    state.bookingForm.date,
                    state.bookingForm.startTime,
                    slotEnd
                  );
                  return `
                    <div 
                      data-modal-barber-id="${b.id}" 
                      data-busy="${isBarberBusy ? 'true' : 'false'}"
                      class="barber-modal-choice p-3.5 rounded-[12px] border cursor-pointer flex items-center gap-3 transition-all ${isBarberBusy ? 'opacity-50 border-red-500/30 bg-[#12151b]' : (isSelected ? 'selected border-[#d4af37] bg-[rgba(212,175,55,0.14)] shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'border-[rgba(212,175,55,0.22)] bg-[#161a22] hover:border-[#d4af37]')}">
                      <img src="${b.avatar || './logo_barberia_lopez_hd.jpg'}" alt="${escapeHtml(b.name)}" class="w-11 h-11 rounded-full object-cover border border-[rgba(212,175,55,0.35)]">
                      <div class="flex-1">
                        <div class="font-sans-ui font-semibold text-[#ffffff] text-[14px] flex items-center justify-between">
                          <span>${escapeHtml(b.name)}</span>
                          ${isBarberBusy ? '<span class="text-[10px] text-red-400 font-mono-tech font-bold uppercase tracking-wider">Ocupado a esta hora</span>' : ''}
                        </div>
                        <div class="font-sans-ui text-[#c5c0b6] text-[11px] mt-0.5">${escapeHtml(b.specialty)}</div>
                      </div>
                      <span class="w-4 h-4 rounded-full border flex items-center justify-center ${isSelected && !isBarberBusy ? 'border-[#d4af37] bg-[#d4af37]' : 'border-[rgba(212,175,55,0.35)]'}">
                        ${isSelected && !isBarberBusy ? '<span class="w-1.5 h-1.5 rounded-full bg-[#0a0b0d]"></span>' : ''}
                      </span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- 2. SELECCIÓN DE CORTE O COMBO BASE -->
            <div>
              <label class="block font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#d4af37] mb-2">2. Selecciona tu Corte o Combo</label>
              <div id="service-modal-list" class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                ${(Array.isArray(services) && services.length > 0 ? services : SEED_SERVICES).map((s, idx) => {
                  const isSelected = state.bookingForm.serviceId ? state.bookingForm.serviceId === s.id : idx === 0;
                  return `
                    <div 
                      data-modal-service-id="${s.id}" 
                      class="service-modal-choice p-3.5 rounded-[12px] border cursor-pointer flex flex-col justify-between transition-all ${isSelected ? 'selected border-[#d4af37] bg-[rgba(212,175,55,0.14)] shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'border-[rgba(212,175,55,0.22)] bg-[#161a22] hover:border-[#d4af37]'}">
                      <div class="flex items-center justify-between gap-1 mb-1">
                        <span class="font-sans-ui font-semibold text-[#ffffff] text-[14px]">${s.name}</span>
                        <span class="font-mono-tech font-bold text-[#d4af37] text-sm">$${s.priceCop.toLocaleString('es-CO')}</span>
                      </div>
                      <div class="font-sans-ui text-[#c5c0b6] text-[11px] leading-tight">
                        ${s.description || s.category}
                      </div>
                      <div class="font-mono-tech text-[10px] text-[#a39578] mt-2">
                        30 MIN · ${s.category.toUpperCase()}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- 3. SERVICIOS ADICIONALES (OPCIONALES) -->
            <div class="pt-4 border-t border-[rgba(212,175,55,0.22)]">
              <div class="flex items-center justify-between mb-2">
                <label class="block font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#d4af37]">3. Servicios Adicionales (Opcionales)</label>
                <span class="text-[11px] text-[#a39578] font-sans-ui">Personaliza tu servicio</span>
              </div>

              <!-- PIGMENTACION (OPCIONAL RADIO) -->
              <div class="mb-4">
                <span class="text-[11px] font-semibold text-[#f3e5ab] block mb-2 font-sans-ui">Pigmentación de Barba o Contornos:</span>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  ${OPTIONAL_EXTRAS.pigmentacion.map((p) => {
                    const isSelected = state.bookingForm.pigmentacion === p.id;
                    return `
                      <div 
                        data-modal-pig-id="${p.id}" 
                        class="pigmentacion-modal-choice extra-option-choice p-2.5 rounded-[10px] border cursor-pointer transition-all flex flex-col justify-between text-left ${isSelected ? 'selected border-[#d4af37] bg-[rgba(212,175,55,0.16)] shadow-[0_0_12px_rgba(212,175,55,0.2)]' : 'border-[rgba(212,175,55,0.22)] bg-[#161a22] hover:border-[#d4af37]'}">
                        <div>
                          <div class="font-sans-ui text-xs font-semibold text-white">${p.name}</div>
                          <div class="font-sans-ui text-[10px] text-[#c5c0b6] mt-0.5">${p.desc}</div>
                        </div>
                        <div class="font-mono-tech text-xs font-bold text-[#d4af37] mt-2">
                          ${p.priceCop > 0 ? '+$' + p.priceCop.toLocaleString('es-CO') : 'Incluido ($0)'}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- OTROS EXTRAS (CHECKBOXES) -->
              <div>
                <span class="text-[11px] font-semibold text-[#f3e5ab] block mb-2 font-sans-ui">Otros adicionales sugeridos:</span>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  ${OPTIONAL_EXTRAS.adicionales.map((extra) => {
                    const isChecked = state.bookingForm.extras.includes(extra.id);
                    return `
                      <div 
                        data-modal-extra-id="${extra.id}" 
                        class="extra-modal-choice extra-option-choice p-2.5 rounded-[10px] border cursor-pointer transition-all flex items-center justify-between ${isChecked ? 'selected border-[#d4af37] bg-[rgba(212,175,55,0.16)] shadow-[0_0_12px_rgba(212,175,55,0.2)]' : 'border-[rgba(212,175,55,0.22)] bg-[#161a22] hover:border-[#d4af37]'}">
                        <div>
                          <div class="font-sans-ui text-xs font-semibold text-white">${extra.name}</div>
                          <div class="font-mono-tech text-[11px] font-bold text-[#d4af37]">+$ ${extra.priceCop.toLocaleString('es-CO')}</div>
                        </div>
                        <span class="w-4 h-4 rounded border flex items-center justify-center ${isChecked ? 'border-[#d4af37] bg-[#d4af37]' : 'border-[rgba(212,175,55,0.35)]'}">
                          ${isChecked ? '<span class="text-[#0a0b0d] font-bold text-xs leading-none">V</span>' : ''}
                        </span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- RESUMEN DINAMICO DE PRECIO -->
              <div class="booking-price-summary bg-[#141820] border border-[rgba(212,175,55,0.35)] rounded-[12px] p-3.5 mt-4 space-y-1.5 font-sans-ui">
                <div class="flex justify-between items-center text-xs">
                  <span class="text-[#c5c0b6]">Servicio base seleccionado:</span>
                  <span id="booking-summary-base" class="text-white font-medium">$20.000 COP</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                  <span class="text-[#c5c0b6]">Adicionales opcionales:</span>
                  <span id="booking-summary-extras" class="text-[#f3e5ab] font-medium">$0 COP</span>
                </div>
                <div class="flex justify-between items-center text-sm pt-2 border-t border-[rgba(212,175,55,0.25)] font-bold">
                  <span class="text-[#f3e5ab]">Total a pagar en efectivo:</span>
                  <span id="booking-summary-total" class="text-[#d4af37] font-mono-tech text-base">$20.000 COP</span>
                </div>
              </div>
            </div>

            <!-- 4. DATOS PERSONALES NECESARIOS -->
            <div class="pt-4 border-t border-[rgba(212,175,55,0.22)]">
              <label class="block font-sans-ui text-xs font-semibold uppercase tracking-wider text-[#d4af37] mb-3">4. Tus Datos Personales</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label class="block font-sans-ui text-xs font-semibold text-[#c5c0b6] mb-1">Nombre completo *</label>
                  <input 
                    type="text" 
                    id="client-booking-name" 
                    required 
                    value="${escapeHtml(state.bookingForm.clientName)}" 
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
                    value="${escapeHtml(state.bookingForm.clientPhone)}" 
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
                    value="${escapeHtml(state.bookingForm.clientEmail || '')}" 
                    placeholder="Para invitación a calendario" 
                    class="input-parchment"
                  >
                </div>
                <div>
                  <label class="block font-sans-ui text-xs font-semibold text-[#c5c0b6] mb-1">Petición especial o estilo (opcional)</label>
                  <input 
                    type="text" 
                    id="client-booking-notes" 
                    value="${escapeHtml(state.bookingForm.clientNotes || '')}" 
                    placeholder="Ej. Degradado medio en punta" 
                    class="input-parchment"
                  >
                </div>
              </div>

              <!-- METODO DE PAGO EN EFECTIVO -->
              <div class="p-3.5 rounded-[10px] bg-[#161a22] border border-[rgba(212,175,55,0.25)] flex items-center gap-3">
                <span class="w-2.5 h-2.5 rounded-full bg-[#d4af37]"></span>
                <div class="flex-1">
                  <span class="font-sans-ui text-xs font-semibold text-white block">Pago en Efectivo Presencial</span>
                  <span class="font-sans-ui text-[11px] text-[#c5c0b6]">Pagas al finalizar tu corte directamente en la estación del barbero.</span>
                </div>
              </div>
            </div>

            <button type="submit" class="btn-clay w-full py-3.5 justify-center text-sm font-bold shadow-lg">
              Confirmar mi cita en agenda →
            </button>
          </form>
        </div>
      </div>

      <!-- CONTENEDOR MODAL DE CONFIRMACIÓN -->
      <div id="modal-confirmation-container"></div>
    `;

    bindEvents(users, barbers, services);
    if (state.confirmationModalData) {
      showConfirmationModal(state.confirmationModalData);
    }
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
          localStorage.setItem('blopez_current_user', JSON.stringify(user));
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
        localStorage.removeItem('blopez_token');
        localStorage.removeItem('blopez_current_user');
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

    const btnStoreBackHome = document.getElementById('btn-store-back-home');
    if (btnStoreBackHome) btnStoreBackHome.onclick = () => { state.activeView = 'home'; renderApp(); };

    const btnNavStore = document.getElementById('btn-nav-store');
    if (btnNavStore) {
      btnNavStore.onclick = () => {
        state.activeView = 'store';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        renderApp();
      };
    }

    const btnNavStoreMobile = document.getElementById('btn-nav-store-mobile');
    if (btnNavStoreMobile) {
      btnNavStoreMobile.onclick = () => {
        state.activeView = 'store';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        renderApp();
      };
    }

    const btnHeroOpenStore = document.getElementById('btn-hero-open-store');
    if (btnHeroOpenStore) {
      btnHeroOpenStore.onclick = () => {
        state.activeView = 'store';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        renderApp();
      };
    }

    const navBrand = document.getElementById('nav-brand');
    if (navBrand) {
      navBrand.onclick = (e) => {
        if (state.activeView !== 'home') {
          e.preventDefault();
          state.activeView = 'home';
          renderApp();
        }
      };
    }

    ['nav-link-inicio', 'nav-link-calendario', 'nav-link-servicios', 'btn-cta-reservar'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.onclick = () => {
          if (state.activeView !== 'home') {
            state.activeView = 'home';
            renderApp();
          }
        };
      }
    });

    // Filtros de categorías en Tienda
    document.querySelectorAll('.btn-store-cat').forEach((btn) => {
      btn.onclick = () => {
        state.storeCategoryFilter = btn.dataset.storeCat || 'ALL';
        renderApp();
      };
    });

    // Comprar producto en Tienda
    document.querySelectorAll('.btn-buy-store-product').forEach((btn) => {
      btn.onclick = () => {
        const prodId = btn.dataset.buyProductId;
        const prod = (state.products || []).find((p) => p.id === prodId);
        if (prod) {
          showStoreBuyModal(prod);
        }
      };
    });

    // Filtros de estado de pedidos en Dashboard
    document.querySelectorAll('.btn-order-status-filter').forEach((btn) => {
      btn.onclick = () => {
        state.storeOrderStatusFilter = btn.dataset.orderStatusFilter || 'ALL';
        renderApp();
      };
    });

    const inputStoreOrderSearch = document.getElementById('input-store-order-search');
    if (inputStoreOrderSearch) {
      inputStoreOrderSearch.oninput = (e) => {
        state.storeOrderSearch = e.target.value;
        const q = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.store-order-card').forEach((card) => {
          const text = card.innerText.toLowerCase();
          card.style.display = text.includes(q) ? '' : 'none';
        });
      };
    }

    // Confirmar cobro en efectivo y entregar pedido
    document.querySelectorAll('.btn-deliver-store-order').forEach((btn) => {
      btn.onclick = async () => {
        const orderId = btn.dataset.deliverOrderId;
        const refCode = btn.dataset.deliverRef;
        const ok = confirm(`¿Confirmas que recibiste el PAGO EN EFECTIVO de la referencia ${refCode} y entregaste el producto al cliente?`);
        if (!ok) return;
        try {
          await repo.deliverStoreOrder(orderId);
          await renderApp();
        } catch (err) {
          alert(err.message);
        }
      };
    });

    // Cancelar pedido y devolver unidades al stock
    document.querySelectorAll('.btn-cancel-store-order').forEach((btn) => {
      btn.onclick = async () => {
        const orderId = btn.dataset.cancelOrderId;
        const refCode = btn.dataset.cancelRef;
        const ok = confirm(`¿Deseas cancelar el pedido ${refCode} y devolver las unidades apartadas al inventario disponible?`);
        if (!ok) return;
        try {
          await repo.cancelStoreOrder(orderId);
          await renderApp();
        } catch (err) {
          alert(err.message);
        }
      };
    });

    // Crear nuevo producto desde el panel del Barbero Jefe
    const formCreateProduct = document.getElementById('form-create-product');
    if (formCreateProduct) {
      formCreateProduct.onsubmit = async (e) => {
        e.preventDefault();
        try {
          const name = document.getElementById('new-prod-name').value.trim();
          const category = document.getElementById('new-prod-category').value.trim() || 'Cuidado Personal';
          const stock = parseInt(document.getElementById('new-prod-stock').value, 10) || 0;
          const priceCop = parseInt(document.getElementById('new-prod-price').value, 10) || 0;
          const imageUrl = document.getElementById('new-prod-image').value.trim();
          const description = document.getElementById('new-prod-desc').value.trim();

          await repo.saveProduct({
            name,
            category,
            stock,
            priceCop,
            imageUrl: imageUrl || undefined,
            description
          });
          alert('Producto publicado exitosamente en el apartado TIENDA.');
          renderApp();
        } catch (err) {
          alert(err.message);
        }
      };
    }

    // Ajuste rápido de stock (+1 / -1)
    document.querySelectorAll('.btn-adjust-stock').forEach((btn) => {
      btn.onclick = async () => {
        const prodId = btn.dataset.stockProdId;
        const delta = parseInt(btn.dataset.stockDelta, 10) || 0;
        const prod = (state.products || []).find((p) => p.id === prodId);
        if (!prod) return;
        const nextStock = Math.max(0, (Number(prod.stock) || 0) + delta);
        try {
          await repo.updateProduct(prodId, { stock: nextStock });
          renderApp();
        } catch (err) {
          alert(err.message);
        }
      };
    });

    // Editar precio y stock de un producto
    document.querySelectorAll('.btn-edit-product').forEach((btn) => {
      btn.onclick = async () => {
        const prodId = btn.dataset.editProdId;
        const prod = (state.products || []).find((p) => p.id === prodId);
        if (!prod) return;
        const newPriceStr = prompt(`Nuevo precio en Efectivo (COP) para "${prod.name}":`, String(prod.priceCop));
        if (newPriceStr === null) return;
        const newStockStr = prompt(`Cantidad de unidades disponibles en Stock para "${prod.name}":`, String(prod.stock));
        if (newStockStr === null) return;

        const priceCop = Math.max(0, parseInt(newPriceStr.replace(/\D/g, ''), 10) || prod.priceCop);
        const stock = Math.max(0, parseInt(newStockStr, 10));
        try {
          await repo.updateProduct(prodId, {
            priceCop,
            stock: Number.isNaN(stock) ? prod.stock : stock
          });
          renderApp();
        } catch (err) {
          alert(err.message);
        }
      };
    });

    // Eliminar producto del catálogo
    document.querySelectorAll('.btn-delete-product').forEach((btn) => {
      btn.onclick = async () => {
        const prodId = btn.dataset.deleteProdId;
        const prodName = btn.dataset.deleteProdName;
        const ok = confirm(`¿Seguro que deseas quitar "${prodName}" del catálogo de la tienda?`);
        if (!ok) return;
        try {
          await repo.deleteProduct(prodId);
          renderApp();
        } catch (err) {
          alert(err.message);
        }
      };
    });

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

    // Función para recalcular el precio en vivo en el modal
    function updateLivePriceSummary() {
      const activeServiceId = state.bookingForm.serviceId;
      const allServices = (Array.isArray(state.services) && state.services.length > 0) ? state.services : SEED_SERVICES;
      const s = allServices.find((x) => x.id === activeServiceId) || allServices[0] || SEED_SERVICES[0];
      const basePrice = s ? s.priceCop : 20000;

      let extrasPrice = 0;
      if (state.bookingForm.pigmentacion === 'pig-aero') extrasPrice += 18000;
      if (state.bookingForm.pigmentacion === 'pig-manual') extrasPrice += 22000;
      if (state.bookingForm.extras.includes('extra-cejas')) extrasPrice += 3000;
      if (state.bookingForm.extras.includes('extra-barba')) extrasPrice += 10000;
      if (state.bookingForm.extras.includes('extra-afeitado')) extrasPrice += 6000;

      const total = basePrice + extrasPrice;

      const elBase = document.getElementById('booking-summary-base');
      const elExtras = document.getElementById('booking-summary-extras');
      const elTotal = document.getElementById('booking-summary-total');

      if (elBase) elBase.textContent = '$' + basePrice.toLocaleString('es-CO') + ' COP';
      if (elExtras) elExtras.textContent = extrasPrice > 0 ? '+$' + extrasPrice.toLocaleString('es-CO') + ' COP' : '$0 COP';
      if (elTotal) elTotal.textContent = '$' + total.toLocaleString('es-CO') + ' COP';
    }

    // Selección de barbero en el modal (in-place sin resetear scroll)
    document.querySelectorAll('.barber-modal-choice').forEach((card) => {
      card.onclick = () => {
        if (card.dataset.busy === 'true') {
          alert('Este barbero ya tiene una reserva en esta franja horaria. Por favor selecciona otro barbero o escoge otra hora en la agenda.');
          return;
        }
        const barberId = card.dataset.modalBarberId;
        state.bookingForm.barberId = barberId;
        document.querySelectorAll('.barber-modal-choice').forEach((c) => {
          const isSelected = c.dataset.modalBarberId === barberId;
          c.classList.toggle('selected', isSelected);
          c.className = `barber-modal-choice p-3.5 rounded-[12px] border cursor-pointer flex items-center gap-3 transition-all ${isSelected ? 'selected border-[#d4af37] bg-[rgba(212,175,55,0.14)] shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'border-[rgba(212,175,55,0.22)] bg-[#161a22] hover:border-[#d4af37]'}`;
          const indicator = c.querySelector('span.w-4');
          if (indicator) {
            indicator.className = `w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#d4af37] bg-[#d4af37]' : 'border-[rgba(212,175,55,0.35)]'}`;
            indicator.innerHTML = isSelected ? '<span class="w-1.5 h-1.5 rounded-full bg-[#0a0b0d]"></span>' : '';
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
          c.classList.toggle('selected', isSelected);
          c.className = `service-modal-choice p-3.5 rounded-[12px] border cursor-pointer flex flex-col justify-between transition-all ${isSelected ? 'selected border-[#d4af37] bg-[rgba(212,175,55,0.14)] shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'border-[rgba(212,175,55,0.22)] bg-[#161a22] hover:border-[#d4af37]'}`;
        });
        updateLivePriceSummary();
      };
    });

    // Selección de pigmentación opcional
    document.querySelectorAll('.pigmentacion-modal-choice').forEach((card) => {
      card.onclick = () => {
        const pigId = card.dataset.modalPigId;
        state.bookingForm.pigmentacion = pigId;
        document.querySelectorAll('.pigmentacion-modal-choice').forEach((c) => {
          const isSelected = c.dataset.modalPigId === pigId;
          c.classList.toggle('selected', isSelected);
          c.className = `pigmentacion-modal-choice extra-option-choice p-2.5 rounded-[10px] border cursor-pointer transition-all flex flex-col justify-between text-left ${isSelected ? 'selected border-[#d4af37] bg-[rgba(212,175,55,0.16)] shadow-[0_0_12px_rgba(212,175,55,0.2)]' : 'border-[rgba(212,175,55,0.22)] bg-[#161a22] hover:border-[#d4af37]'}`;
        });
        updateLivePriceSummary();
      };
    });

    // Selección de otros adicionales opcionales (Checkboxes)
    document.querySelectorAll('.extra-modal-choice').forEach((card) => {
      card.onclick = () => {
        const extraId = card.dataset.modalExtraId;
        const idx = state.bookingForm.extras.indexOf(extraId);
        if (idx !== -1) {
          state.bookingForm.extras.splice(idx, 1);
        } else {
          state.bookingForm.extras.push(extraId);
        }
        const isChecked = state.bookingForm.extras.includes(extraId);
        card.classList.toggle('selected', isChecked);
        card.className = `extra-modal-choice extra-option-choice p-2.5 rounded-[10px] border cursor-pointer transition-all flex items-center justify-between ${isChecked ? 'selected border-[#d4af37] bg-[rgba(212,175,55,0.16)] shadow-[0_0_12px_rgba(212,175,55,0.2)]' : 'border-[rgba(212,175,55,0.22)] bg-[#161a22] hover:border-[#d4af37]'}`;
        const checkBadge = card.querySelector('span.w-4');
        if (checkBadge) {
          checkBadge.className = `w-4 h-4 rounded border flex items-center justify-center ${isChecked ? 'border-[#d4af37] bg-[#d4af37]' : 'border-[rgba(212,175,55,0.35)]'}`;
          checkBadge.innerHTML = isChecked ? '<span class="text-[#0a0b0d] font-bold text-xs leading-none">V</span>' : '';
        }
        updateLivePriceSummary();
      };
    });

    // Inicializar cálculo de precios si el modal está abierto
    if (state.bookingModalOpen) {
      updateLivePriceSummary();
    }

    // Editar nombre de barbero (para Administrador o Barbero Jefe)
    document.querySelectorAll('.btn-edit-barber').forEach((btn) => {
      btn.onclick = async () => {
        const barberId = btn.dataset.editBarberId;
        const currentName = btn.dataset.barberName || '';
        const currentSpecialty = btn.dataset.barberSpecialty || '';
        const newName = prompt('Ingresa el nuevo nombre visible para este barbero (aparece en la agenda de los clientes):', currentName);
        if (!newName || !newName.trim()) return;
        const newSpecialty = prompt('Ingresa la especialidad o subtítulo (ej. Maestro Barbero, Barbero Profesional):', currentSpecialty);
        
        try {
          const barber = await repo.findBarberById(barberId);
          if (barber) {
            barber.name = newName.trim();
            if (newSpecialty !== null) barber.specialty = newSpecialty.trim();
            await repo.updateBarber(barber);
            alert(`Nombre actualizado con éxito a "${barber.name}".`);
            renderApp();
          }
        } catch (err) {
          alert('Error al actualizar el barbero: ' + err.message);
        }
      };
    });

    const btnOpenClientSync = document.getElementById('btn-open-client-sync');
    if (btnOpenClientSync) {
      btnOpenClientSync.onclick = () => {
        showClientSyncModal();
      };
    }

    let isSubmittingBooking = false;
    const formClientBooking = document.getElementById('form-client-booking');
    if (formClientBooking) {
      formClientBooking.onsubmit = async (e) => {
        e.preventDefault();
        if (isSubmittingBooking) return;

        const btnSubmit = formClientBooking.querySelector('button[type="submit"]');
        const originalBtnText = btnSubmit ? btnSubmit.textContent : '';
        if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.textContent = 'Agendando turno...';
          btnSubmit.style.opacity = '0.7';
          btnSubmit.style.cursor = 'not-allowed';
        }
        isSubmittingBooking = true;

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
            pigmentacion: state.bookingForm.pigmentacion,
            additionals: state.bookingForm.extras,
            date: state.bookingForm.date,
            startTime: state.bookingForm.startTime,
            paymentMethod: state.bookingForm.paymentMethod
          });

          state.bookingModalOpen = false;
          showConfirmationModal(result);
        } catch (err) {
          await repo.findAllAppointments();
          await renderApp();
          alert(err.message);
        } finally {
          isSubmittingBooking = false;
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalBtnText;
            btnSubmit.style.opacity = '';
            btnSubmit.style.cursor = '';
          }
        }
      };
    }

    document.querySelectorAll('.btn-complete-cut').forEach((btn) => {
      btn.onclick = async () => {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.textContent = 'Guardando corte en caja...';
        try {
          await completeCutUseCase.execute({
            appointmentId: btn.dataset.apptId,
            user: state.currentUser
          });
          await renderApp();
        } catch (err) {
          btn.disabled = false;
          btn.style.opacity = '';
          btn.textContent = 'Finalizar corte y guardar en historial ->';
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

    // Eliminar cita individual desde el Dashboard
    document.querySelectorAll('.btn-delete-appt').forEach((btn) => {
      btn.onclick = async () => {
        const apptId = btn.dataset.deleteApptId;
        const ok = confirm('¿Deseas cancelar y eliminar este turno de la agenda y del panel de control?');
        if (!ok) return;
        try {
          await repo.deleteAppointment(apptId);
          await renderApp();
        } catch (err) {
          alert('Error al eliminar el turno: ' + err.message);
        }
      };
    });

    // Eliminar registro individual del historial de cortes
    document.querySelectorAll('.btn-delete-history-item').forEach((btn) => {
      btn.onclick = async () => {
        const histId = btn.dataset.deleteHistoryId;
        const ok = confirm('¿Deseas eliminar este registro del historial de cortes?');
        if (!ok) return;
        try {
          await repo.deleteCutHistory(histId);
          await renderApp();
        } catch (err) {
          alert('Error al eliminar del historial: ' + err.message);
        }
      };
    });

    // Vaciar todas las solicitudes de prueba del historial de control
    const btnClearTests = document.getElementById('btn-clear-control-tests');
    if (btnClearTests) {
      btnClearTests.onclick = async () => {
        const ok = confirm('¿Deseas eliminar todas las solicitudes y citas de prueba registradas en el historial de control? Esta acción dejará los turnos e historial en cero.');
        if (!ok) return;
        try {
          await repo.clearControlTests();
          state.appointments = [];
          state.history = [];
          await renderApp();
          alert('Historial de control y solicitudes de prueba eliminadas exitosamente.');
        } catch (err) {
          alert('Error al limpiar solicitudes: ' + err.message);
        }
      };
    }

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

  function showStoreBuyModal(product) {
    const container = document.getElementById('modal-confirmation-container');
    if (!container) return;

    const savedPhone = localStorage.getItem('blopez_last_phone') || '';
    const maxQty = Math.min(10, Math.max(1, Number(product.stock) || 1));

    container.innerHTML = `
      <div id="modal-store-buy" class="fixed inset-0 z-50 bg-[#0a0b0d]/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="anthropic-card w-full max-w-lg p-6 sm:p-8 relative border border-[#d4af37]/40 shadow-2xl">
          <button id="btn-close-store-buy" class="absolute top-4 right-4 text-[#c5c0b6] hover:text-[#ffffff] text-xl font-light cursor-pointer">&times;</button>

          <div class="mb-5">
            <div class="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.35)] text-[#f3e5ab] text-xs font-semibold">
              <span class="w-2 h-2 rounded-full bg-[#d4af37]"></span>
              <span>COMPRA EN TIENDA · PAGO EN EFECTIVO</span>
            </div>
            <h3 class="font-serif-editorial text-[26px] sm:text-[30px] font-normal leading-tight text-[#ffffff]">
              ${escapeHtml(product.name)}
            </h3>
            <p class="font-sans-ui text-xs text-[#c5c0b6] mt-1">
              Completa tus datos para generar tu <strong>Referencia Única de Pago</strong> y apartar el producto en inventario.
            </p>
          </div>

          <form id="form-store-buy" class="space-y-4 font-sans-ui">
            <div class="bg-[#161a22] p-4 rounded-[12px] border border-[rgba(212,175,55,0.22)] flex items-center justify-between">
              <div>
                <span class="block text-[11px] text-[#8a8275] uppercase font-semibold">Valor unitario</span>
                <span class="font-mono-tech text-lg font-bold text-[#d4af37]">$${Number(product.priceCop || 0).toLocaleString('es-CO')} COP</span>
              </div>
              <div class="text-right">
                <span class="block text-[11px] text-[#8a8275] uppercase font-semibold">Disponibles</span>
                <span class="font-mono-tech text-sm font-bold text-[#f3e5ab]">${product.stock} unidades</span>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-semibold text-[#c5c0b6] mb-1">Cantidad *</label>
                <input type="number" id="store-buy-qty" required min="1" max="${maxQty}" value="1" class="input-parchment font-mono-tech text-sm">
              </div>
              <div class="sm:col-span-2">
                <label class="block text-xs font-semibold text-[#c5c0b6] mb-1">Método de pago autorizado</label>
                <div class="input-parchment bg-[#141720] text-[#d4af37] font-mono-tech text-xs font-bold flex items-center h-[42px] px-3 border border-[rgba(212,175,55,0.35)]">
                  EFECTIVO (Al reclamar en barbería)
                </div>
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-[#c5c0b6] mb-1">Tu nombre completo *</label>
              <input type="text" id="store-buy-name" required value="${escapeHtml(state.bookingForm.clientName || '')}" placeholder="Ej. Andrés Felipe Gómez" class="input-parchment text-sm">
            </div>

            <div>
              <label class="block text-xs font-semibold text-[#c5c0b6] mb-1">Tu número de celular / WhatsApp *</label>
              <input type="tel" id="store-buy-phone" required value="${escapeHtml(savedPhone)}" placeholder="Ej. 321 989 7910" class="input-parchment text-sm">
            </div>

            <div class="bg-[#12151b] p-4 rounded-[12px] border border-[rgba(212,175,55,0.28)] flex items-center justify-between">
              <span class="text-xs font-semibold text-[#c5c0b6] uppercase tracking-wider">Total a pagar en efectivo:</span>
              <span id="store-buy-total-display" class="font-mono-tech text-xl font-bold text-[#d4af37]">
                $${Number(product.priceCop || 0).toLocaleString('es-CO')} COP
              </span>
            </div>

            <div id="store-buy-error" class="hidden text-xs text-red-300 bg-red-950/60 border border-red-800 p-3 rounded-[8px]"></div>

            <button type="submit" class="btn-clay w-full py-3 justify-center text-sm font-semibold cursor-pointer">
              Confirmar pedido y generar Referencia de Pago →
            </button>
          </form>
        </div>
      </div>
    `;

    const qtyInput = document.getElementById('store-buy-qty');
    const totalDisplay = document.getElementById('store-buy-total-display');
    if (qtyInput && totalDisplay) {
      qtyInput.oninput = () => {
        const q = Math.max(1, Math.min(maxQty, parseInt(qtyInput.value, 10) || 1));
        totalDisplay.textContent = `$${(q * Number(product.priceCop || 0)).toLocaleString('es-CO')} COP`;
      };
    }

    document.getElementById('btn-close-store-buy')?.addEventListener('click', () => {
      container.innerHTML = '';
    });

    const form = document.getElementById('form-store-buy');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const quantity = Math.max(1, parseInt(document.getElementById('store-buy-qty').value, 10) || 1);
        const clientName = document.getElementById('store-buy-name').value.trim();
        const clientPhone = document.getElementById('store-buy-phone').value.trim();
        const errBox = document.getElementById('store-buy-error');

        if (clientPhone) {
          localStorage.setItem('blopez_last_phone', clientPhone);
        }
        state.bookingForm.clientName = clientName;
        state.bookingForm.clientPhone = clientPhone;

        try {
          const res = await repo.createStoreOrder({
            productId: product.id,
            quantity,
            clientName,
            clientPhone
          });
          await renderApp();
          showStoreVoucherModal(res.order);
        } catch (err) {
          if (errBox) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
          } else {
            alert(err.message);
          }
        }
      };
    }
  }

  function showStoreVoucherModal(order) {
    const container = document.getElementById('modal-confirmation-container');
    if (!container || !order) return;

    const waText = encodeURIComponent(
      `Hola Barberia Lopez, he apartado un producto en la Tienda Web:\n` +
      `Referencia de Pago: ${order.referenceCode}\n` +
      `Producto: ${order.productName} (x${order.quantity})\n` +
      `Total a pagar en efectivo: $${Number(order.totalCop || 0).toLocaleString('es-CO')} COP\n` +
      `Cliente: ${order.clientName} (${order.clientPhone})`
    );
    const whatsappUrl = `https://wa.me/573219897910?text=${waText}`;

    container.innerHTML = `
      <div id="modal-store-voucher" class="fixed inset-0 z-50 bg-[#0a0b0d]/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="anthropic-card w-full max-w-lg p-6 sm:p-8 relative border border-[#d4af37]/50 shadow-2xl">
          <div class="mb-5 text-center">
            <div class="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.4)] text-[#f3e5ab] text-xs font-semibold">
              <span class="w-2 h-2 rounded-full bg-[#d4af37]"></span>
              <span>PRODUCTO APARTADO · PAGO EN EFECTIVO</span>
            </div>
            <h3 class="font-serif-editorial text-[28px] sm:text-[32px] font-normal text-[#ffffff] leading-tight">
              Referencia de Pago Generada
            </h3>
            <p class="font-sans-ui text-xs text-[#c5c0b6] mt-1">
              Muestra este código al barbero cuando vayas a reclamar y pagar tu producto en la barbería.
            </p>
          </div>

          <!-- CAJA DESTACADA DEL CÓDIGO DE REFERENCIA ANTI-ROBO -->
          <div class="bg-[#0a0b0d] border-2 border-[#d4af37] rounded-[16px] p-5 text-center mb-5 shadow-[0_0_25px_rgba(212,175,55,0.2)]">
            <span class="block text-[11px] font-sans-ui font-semibold uppercase tracking-widest text-[#f3e5ab] mb-1">
              CÓDIGO ÚNICO DE RECLAMO Y VERIFICACIÓN
            </span>
            <div class="font-mono-tech text-3xl sm:text-4xl font-bold text-[#d4af37] tracking-widest select-all">
              ${escapeHtml(order.referenceCode)}
            </div>
            <button type="button" id="btn-copy-store-ref" class="mt-3 btn-stone-outline py-1 px-3 text-[11px] font-semibold text-[#f3e5ab] cursor-pointer">
              Copiar código de referencia
            </button>
          </div>

          <div class="bg-[#161a22] p-4 rounded-[12px] border border-[rgba(212,175,55,0.22)] space-y-2 mb-5 font-sans-ui text-xs sm:text-sm">
            <div class="flex justify-between"><span class="text-[#8a8275]">Producto</span><span class="text-[#ffffff] font-semibold">${escapeHtml(order.productName)}</span></div>
            <div class="flex justify-between"><span class="text-[#8a8275]">Cantidad apartada</span><span class="text-[#f3e5ab] font-mono-tech font-bold">${order.quantity} und</span></div>
            <div class="flex justify-between"><span class="text-[#8a8275]">Cliente titular</span><span class="text-[#ffffff]">${escapeHtml(order.clientName)}</span></div>
            <div class="flex justify-between"><span class="text-[#8a8275]">Modalidad de pago</span><span class="text-[#f3e5ab] font-semibold">EFECTIVO EN BARBERÍA</span></div>
            <div class="flex justify-between pt-2.5 border-t border-[rgba(212,175,55,0.2)]">
              <span class="text-[#8a8275] font-semibold">Total a pagar en efectivo</span>
              <span class="text-[#d4af37] font-mono-tech font-bold text-base">$${Number(order.totalCop || 0).toLocaleString('es-CO')} COP</span>
            </div>
          </div>

          <div class="space-y-2.5">
            <a href="${whatsappUrl}" target="_blank" class="btn-clay w-full py-3 justify-center text-xs sm:text-sm font-semibold text-center block cursor-pointer">
              Enviar mi referencia por WhatsApp a la Barbería →
            </a>
            <button type="button" id="btn-close-store-voucher" class="btn-stone-outline w-full py-2.5 justify-center text-xs text-[#c5c0b6] cursor-pointer">
              Listo, ya guardé mi número de referencia
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-copy-store-ref')?.addEventListener('click', () => {
      navigator.clipboard.writeText(order.referenceCode).then(() => {
        alert(`Referencia ${order.referenceCode} copiada al portapapeles.`);
      }).catch(() => {
        prompt('Copia tu código de referencia:', order.referenceCode);
      });
    });

    document.getElementById('btn-close-store-voucher')?.addEventListener('click', () => {
      container.innerHTML = '';
      renderApp();
    });
  }

  function showConfirmationModal({ appointment, barber, service, calendarPayload, totalPriceCop, serviceFullTitle, extraLabels = [] }) {
    state.confirmationModalData = { appointment, barber, service, calendarPayload, totalPriceCop, serviceFullTitle, extraLabels };
    const container = document.getElementById('modal-confirmation-container');
    if (!container) return;

    const displayPrice = totalPriceCop || appointment.totalPriceCop || service.priceCop || 20000;
    const displayService = serviceFullTitle || appointment.serviceName || service.name;

    container.innerHTML = `
      <div id="modal-confirm" class="modal-backdrop-custom fixed inset-0 z-50 bg-[#0a0b0d]/90 backdrop-blur-md flex items-center justify-center p-4">
        <div class="modal-window-custom anthropic-card w-full max-w-lg p-6 sm:p-8 relative">
          <button id="btn-close-confirm-x" class="absolute top-4 right-4 text-[#c5c0b6] hover:text-[#ffffff] text-2xl font-light cursor-pointer">&times;</button>

          <div class="mb-5">
            <div class="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-[#181c24] border border-[rgba(212,175,55,0.3)] text-[#f3e5ab] text-xs font-semibold">
              <span class="w-2 h-2 rounded-full bg-[#d4af37]"></span>
              <span>TURNO CONFIRMADO EN AGENDA</span>
            </div>
            <h3 class="font-serif-editorial text-[28px] sm:text-[32px] font-normal leading-tight text-[#ffffff] mb-1">¡Reserva completada!</h3>
            <p class="font-sans-ui text-[#c5c0b6] text-[14px]">
              ${escapeHtml(appointment.clientName)}, tu turno ha sido agendado exitosamente con ${escapeHtml(barber.name)}.
            </p>
          </div>

          <div class="bg-[#161a22] p-4 sm:p-5 rounded-[14px] border border-[rgba(212,175,55,0.22)] space-y-2 mb-5 font-sans-ui text-sm">
            <div class="flex justify-between"><span class="text-[#8a8275]">Barbero</span><span class="text-[#ffffff] font-semibold">${escapeHtml(barber.name)}</span></div>
            <div class="flex justify-between"><span class="text-[#8a8275]">Servicio</span><span class="text-[#ffffff] text-right font-medium">${escapeHtml(service.name)}</span></div>
            ${extraLabels.length > 0 ? `
              <div class="flex justify-between"><span class="text-[#8a8275]">Adicionales</span><span class="text-[#f3e5ab] text-right text-xs">${escapeHtml(extraLabels.join(', '))}</span></div>
            ` : ''}
            <div class="flex justify-between"><span class="text-[#8a8275]">Fecha y hora</span><span class="text-[#f3e5ab] font-mono-tech font-bold">${formatDateFriendly(appointment.date)} · ${formatTime12h(appointment.startTime)}</span></div>
            <div class="flex justify-between"><span class="text-[#8a8275]">Duración</span><span class="text-[#c5c0b6]">30 min</span></div>
            <div class="flex justify-between pt-2.5 border-t border-[rgba(212,175,55,0.22)]">
              <span class="text-[#8a8275]">Total a pagar en efectivo</span>
              <span class="text-[#d4af37] font-mono-tech font-bold text-base sm:text-lg">$${displayPrice.toLocaleString('es-CO')} COP</span>
            </div>
          </div>

          <div class="space-y-3 mb-5">
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
              <a href="${calendarPayload.clientWebcalUrl}" target="_blank" class="btn-clay w-full py-3 justify-center text-xs sm:text-sm font-bold text-center block cursor-pointer">
                Añadir a Apple Calendar en iPhone →
              </a>
            </div>

            <!-- OPCION GOOGLE CALENDAR -->
            <a href="${calendarPayload.googleUrl}" target="_blank" rel="noopener noreferrer" class="btn-stone-outline w-full py-2.5 justify-center text-xs font-semibold text-[#f3e5ab] text-center block">
              Conectar a Google Calendar (Android / Gmail) →
            </a>

            <!-- OPCION DESCARGA ARCHIVO .ICS MANUAL -->
            <div class="text-center pt-0.5">
              <a href="${calendarPayload.icsDownloadUrl}" download="Cita_${barber.name.replace(/\s+/g, '_')}.ics" class="text-[11px] text-[#8a8275] hover:text-[#d4af37] underline transition-colors">
                Descargar archivo .ics manual (Mac / Outlook / PC)
              </a>
            </div>

            <!-- CONFIRMACION POR WHATSAPP -->
            <a href="${calendarPayload.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-stone-outline w-full py-2.5 justify-center text-xs font-semibold text-[#f3e5ab] link-editorial text-center block">
              Enviar confirmación por WhatsApp (+57 321 989 7910)
            </a>
          </div>

          <button id="btn-close-confirm" class="btn-stone-outline w-full py-2.5 justify-center text-xs text-[#c5c0b6] border-[rgba(212,175,55,0.3)] hover:text-white">Listo / Volver a la agenda</button>
        </div>
      </div>
    `;

    const closeHandler = () => {
      state.confirmationModalData = null;
      container.innerHTML = '';
      renderApp();
    };

    document.getElementById('btn-close-confirm')?.addEventListener('click', closeHandler);
    document.getElementById('btn-close-confirm-x')?.addEventListener('click', closeHandler);
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
    if (state.activeView === 'home' && !state.bookingModalOpen && !state.confirmationModalData) {
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
    if (state.activeView === 'home' && !state.bookingModalOpen && !state.confirmationModalData) {
      renderApp();
    }
  });
})();
