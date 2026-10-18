const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');

// Asegurar directorio de datos persistente
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');
const BARBERS_FILE = path.join(DATA_DIR, 'barbers.json');
const SERVICES_FILE = path.join(DATA_DIR, 'services.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// Semillas por defecto si los archivos no existen aún
const DEFAULT_USERS = [
  {
    id: 'u-admin-01',
    username: 'admin',
    passwordHash: 'admin2026',
    role: 'ADMIN',
    barberId: null,
    active: true
  },
  {
    id: 'u-jefe-01',
    username: 'maestro.lopez',
    passwordHash: 'lopez2026',
    role: 'JEFE',
    barberId: 'b-jefe-01',
    active: true
  },
  {
    id: 'u-junior-01',
    username: 'carlos.junior',
    passwordHash: 'junior2026',
    role: 'PRACTICANTE',
    barberId: 'b-junior-01',
    active: true
  }
];

const DEFAULT_BARBERS = [
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

const DEFAULT_SERVICES = [
  { id: 's-01', name: 'Corte Básico', category: 'Tradicional', durationMinutes: 30, priceCop: 20000, description: 'Corte clásico o degradado a máquina y tijera.', active: true },
  { id: 's-02', name: 'Combo 1', category: 'Corte + Barba', durationMinutes: 45, priceCop: 25000, description: 'Corte de cabello completo + perfilado de barba.', active: true },
  { id: 's-03', name: 'Combo 2', category: 'Corte + Barba + Cejas', durationMinutes: 50, priceCop: 35000, description: 'Corte + ritual de toalla caliente + cejas.', active: true },
  { id: 's-04', name: 'Combo 3', category: 'Ritual Facial', durationMinutes: 60, priceCop: 40000, description: 'Corte + barba + limpieza con mascarilla negra.', active: true },
  { id: 's-05', name: 'Combi Completa VIP', category: 'Experiencia Integral', durationMinutes: 75, priceCop: 65000, description: 'Servicio VIP integral con pigmentación.', active: true },
  { id: 's-06', name: 'Pigmentación Aerógrafo', category: 'Acabado Capilar', durationMinutes: 30, priceCop: 18000, description: 'Definición de contornos con aerógrafo.', active: true },
  { id: 's-07', name: 'Pigmentación Manual', category: 'Acabado Artesanal', durationMinutes: 35, priceCop: 22000, description: 'Pigmentación artesanal para densidad capilar.', active: true }
];

const DEFAULT_APPOINTMENTS = [];
const DEFAULT_HISTORY = [];

function readJsonFile(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error leyendo ${filePath}:`, err.message);
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error escribiendo en ${filePath}:`, err.message);
    return false;
  }
}

// Inicializar archivos si no existen
readJsonFile(USERS_FILE, DEFAULT_USERS);
readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
readJsonFile(SERVICES_FILE, DEFAULT_SERVICES);
readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);

// Conversión de hora local de Colombia (UTC-5) a estándar UTC universal sin dependencias de zona
function localToUtcIso(dateStr, timeStr) {
  const parts = (dateStr || '').split('-').map(Number);
  const t = (timeStr || '10:00').split(':').map(Number);
  const utcDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], t[0] + 5, t[1], 0));
  const uy = utcDate.getUTCFullYear();
  const um = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const ud = String(utcDate.getUTCDate()).padStart(2, '0');
  const uh = String(utcDate.getUTCHours()).padStart(2, '0');
  const umin = String(utcDate.getUTCMinutes()).padStart(2, '0');
  return `${uy}${um}${ud}T${uh}${umin}00Z`;
}

// Generador de feed iCalendar RFC 5545 para el barbero
function generateIcsForBarber(barberId, host) {
  const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
  const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
  const services = readJsonFile(SERVICES_FILE, DEFAULT_SERVICES);

  const barbersMap = new Map(barbers.map((b) => [b.id, b]));
  const servicesMap = new Map(services.map((s) => [s.id, s]));

  const targetBarber = barbers.find((b) => b.id === barberId);
  const isAll = barberId === 'all' || !targetBarber;
  const calName = isAll ? 'Barbería López · Todos los Turnos' : `Barbería López · ${targetBarber.name}`;

  const filteredAppts = isAll
    ? appointments
    : appointments.filter((a) => a.barberId === barberId);

  const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const events = filteredAppts.map((appt) => {
    const b = barbersMap.get(appt.barberId) || { name: 'Barbero' };
    const s = servicesMap.get(appt.serviceId) || { name: 'Corte Tradicional', priceCop: 0, durationMinutes: 30 };

    const dtStartUtc = localToUtcIso(appt.date, appt.startTime || '10:00');
    const dtEndUtc = localToUtcIso(appt.date, appt.endTime || '10:30');

    const uid = appt.calendarEventUid || `${appt.id || Date.now()}@barberialopez.co`;
    const summary = `Cita: ${appt.clientName} (${s.name})`;
    const description = `Cliente: ${appt.clientName}\\nTel: ${appt.clientPhone || 'No registrado'}\\nServicio: ${s.name}\\nEstación: ${b.name}\\nValor: $${(s.priceCop || 0).toLocaleString('es-CO')} COP\\nPago: ${appt.paymentMethod || 'EFECTIVO'}\\nEstado: ${appt.status || 'CONFIRMADA'}`;
    const location = `Barbería López, Neiva, Huila`;

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowUtc}`,
      `DTSTART:${dtStartUtc}`,
      `DTEND:${dtEndUtc}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      `STATUS:${appt.status === 'CANCELADA' ? 'CANCELLED' : 'CONFIRMED'}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      `DESCRIPTION:Recordatorio Turno Barbería: ${appt.clientName}`,
      'END:VALARM',
      'END:VEVENT'
    ].join('\r\n');
  }).filter(Boolean);

  const calendarLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Barberia Lopez//Agenda Turnos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    'X-WR-TIMEZONE:America/Bogota',
    `X-WR-CALDESC:Turnos en vivo de ${isAll ? 'todas las estaciones' : targetBarber.name} en Barbería López`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
    events.join('\r\n'),
    'END:VCALENDAR'
  ];

  return calendarLines.join('\r\n');
}

// Generador de archivo iCalendar RFC 5545 para descarga individual de una cita (cliente)
function generateSingleAppointmentIcs(appt) {
  const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
  const services = readJsonFile(SERVICES_FILE, DEFAULT_SERVICES);
  const barber = barbers.find((b) => b.id === appt.barberId) || { name: 'Barbero' };
  const service = services.find((s) => s.id === appt.serviceId) || { name: 'Corte Tradicional', priceCop: 0, durationMinutes: 30 };

  const dtStartUtc = localToUtcIso(appt.date, appt.startTime || '10:00');
  const dtEndUtc = localToUtcIso(appt.date, appt.endTime || '10:30');
  const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = appt.calendarEventUid || `${appt.id || Date.now()}@barberialopez.co`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Barberia Lopez//Cita Cliente//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Barbería López · Mi Turno',
    'X-WR-TIMEZONE:America/Bogota',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${dtStartUtc}`,
    `DTEND:${dtEndUtc}`,
    `SUMMARY:Cita Barbería López - ${service.name}`,
    `DESCRIPTION:Cita agendada con ${barber.name}.\\nServicio: ${service.name}\\nValor: $${(service.priceCop || 0).toLocaleString('es-CO')} COP\\nLínea oficial: +57 321 989 7910`,
    'LOCATION:Barbería López, Neiva, Huila',
    `STATUS:${appt.status === 'CANCELADA' ? 'CANCELLED' : 'CONFIRMED'}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT60M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Recordatorio de Turno en Barbería López: ${service.name}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

// Generador de feed iCalendar RFC 5545 para las citas de un cliente
function generateIcsForClient(clientPhone) {
  const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
  const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
  const services = readJsonFile(SERVICES_FILE, DEFAULT_SERVICES);

  const cleanPhone = (clientPhone || '').replace(/\D/g, '');
  const barbersMap = new Map(barbers.map((b) => [b.id, b]));
  const servicesMap = new Map(services.map((s) => [s.id, s]));

  const clientAppts = appointments.filter((a) => {
    const aPhone = (a.clientPhone || '').replace(/\D/g, '');
    if (!aPhone || !cleanPhone) return false;
    return aPhone.endsWith(cleanPhone) || cleanPhone.endsWith(aPhone);
  });

  const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const events = clientAppts.map((appt) => {
    const b = barbersMap.get(appt.barberId) || { name: 'Maestro Lopez' };
    const s = servicesMap.get(appt.serviceId) || { name: 'Corte Tradicional', priceCop: 0, durationMinutes: 30 };

    const dtStartUtc = localToUtcIso(appt.date, appt.startTime || '10:00');
    const dtEndUtc = localToUtcIso(appt.date, appt.endTime || '10:30');
    const uid = appt.calendarEventUid || `${appt.id || Date.now()}@barberialopez.co`;
    const summary = `Cita Barbería López - ${s.name}`;
    const description = `Barbero: ${b.name}\\nServicio: ${s.name}\\nValor: $${(s.priceCop || 0).toLocaleString('es-CO')} COP\\nLínea oficial: +57 321 989 7910`;
    const location = `Barbería López, Neiva, Huila`;

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowUtc}`,
      `DTSTART:${dtStartUtc}`,
      `DTEND:${dtEndUtc}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      `STATUS:${appt.status === 'CANCELADA' ? 'CANCELLED' : 'CONFIRMED'}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT60M',
      'ACTION:DISPLAY',
      `DESCRIPTION:Recordatorio Turno en Barbería López: ${s.name}`,
      'END:VALARM',
      'END:VEVENT'
    ].join('\r\n');
  }).filter(Boolean);

  const calendarLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Barberia Lopez//Citas Cliente//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Barbería López · Mis Turnos',
    'X-WR-TIMEZONE:America/Bogota',
    'X-WR-CALDESC:Tus turnos reservados en Barbería López',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
    events.join('\r\n'),
    'END:VCALENDAR'
  ];

  return calendarLines.join('\r\n');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ics': 'text/calendar; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  let reqUrl = decodeURI(req.url.split('?')[0]);

  // Headers CORS para APIs
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // --- RUTA 1A: FEED ICALENDAR PARA EL CLIENTE (TODAS SUS CITAS POR TELÉFONO) ---
  if (reqUrl.startsWith('/api/calendar/client/') && reqUrl.endsWith('.ics')) {
    const rawPhone = reqUrl.substring('/api/calendar/client/'.length).replace(/\.ics$/, '');
    const icsContent = generateIcsForClient(rawPhone);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="mis_turnos.ics"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.end(icsContent);
    return;
  }

  // --- RUTA 1B: FEED ICALENDAR PARA CITA INDIVIDUAL (SUSCRIPCIÓN WEBCAL) ---
  if (reqUrl.startsWith('/api/calendar/appointment/') && reqUrl.endsWith('.ics')) {
    const apptId = reqUrl.substring('/api/calendar/appointment/'.length).replace(/\.ics$/, '');
    const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
    const targetAppt = appointments.find((a) => a.id === apptId);
    if (!targetAppt) {
      res.statusCode = 404;
      res.end('Cita no encontrada');
      return;
    }
    const icsContent = generateSingleAppointmentIcs(targetAppt);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="cita_${apptId}.ics"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.end(icsContent);
    return;
  }

  // --- RUTA 1C: FEED ICALENDAR VIVO PARA EL CELULAR DEL BARBERO ---
  if (reqUrl.startsWith('/api/calendar/') && reqUrl.endsWith('.ics')) {
    const filename = reqUrl.substring('/api/calendar/'.length);
    const barberId = filename.replace(/\.ics$/, '');

    const icsContent = generateIcsForBarber(barberId, host);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="turnos_${barberId}.ics"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.end(icsContent);
    return;
  }

  // --- RUTA 2: API DE CITAS (GET / POST) ---
  if (reqUrl === '/api/appointments') {
    if (req.method === 'GET') {
      const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(appointments));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const newAppt = JSON.parse(body);
          const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
          const existingIdx = appointments.findIndex((a) => a.id === newAppt.id);
          if (existingIdx !== -1) {
            appointments[existingIdx] = { ...appointments[existingIdx], ...newAppt };
          } else {
            appointments.push(newAppt);
          }
          writeJsonFile(APPOINTMENTS_FILE, appointments);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, appointment: newAppt }));
        } catch (err) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // --- RUTA 3: ACTUALIZAR CITA ESPECÍFICA (PUT /api/appointments/:id) ---
  if (reqUrl.startsWith('/api/appointments/') && req.method === 'PUT') {
    const apptId = reqUrl.substring('/api/appointments/'.length);
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const updateData = JSON.parse(body);
        const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
        const idx = appointments.findIndex((a) => a.id === apptId);
        if (idx !== -1) {
          appointments[idx] = { ...appointments[idx], ...updateData };
          writeJsonFile(APPOINTMENTS_FILE, appointments);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, appointment: appointments[idx] }));
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Cita no encontrada' }));
        }
      } catch (err) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // --- RUTA 4: SINCRONIZACIÓN GENERAL BIDIRECCIONAL (POST /api/sync) ---
  if (reqUrl === '/api/sync' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const storedAppointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);

        if (Array.isArray(payload.appointments)) {
          const idMap = new Map(storedAppointments.map((a) => [a.id, a]));
          payload.appointments.forEach((a) => {
            if (idMap.has(a.id)) {
              idMap.set(a.id, { ...idMap.get(a.id), ...a });
            } else {
              idMap.set(a.id, a);
            }
          });
          const merged = Array.from(idMap.values());
          writeJsonFile(APPOINTMENTS_FILE, merged);
        }

        if (Array.isArray(payload.barbers)) {
          writeJsonFile(BARBERS_FILE, payload.barbers);
        }

        if (Array.isArray(payload.users)) {
          writeJsonFile(USERS_FILE, payload.users);
        }

        const currentAppointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, appointments: currentAppointments }));
      } catch (err) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // --- RUTA 5: DESCARGA INDIVIDUAL DE CITA (.ICS) PARA CLIENTE ---
  if (reqUrl.startsWith('/api/appointment/') && reqUrl.endsWith('.ics')) {
    const apptId = reqUrl.substring('/api/appointment/'.length).replace(/\.ics$/, '');
    const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
    const targetAppt = appointments.find((a) => a.id === apptId);
    if (!targetAppt) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Cita no encontrada');
      return;
    }
    const icsContent = generateSingleAppointmentIcs(targetAppt);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Cita_${targetAppt.date}_${(targetAppt.startTime || '').replace(':', '')}.ics"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.end(icsContent);
    return;
  }

  // --- RUTA 6: API DE BARBEROS (GET / POST / PUT / DELETE) ---
  if (reqUrl === '/api/barbers') {
    if (req.method === 'GET') {
      const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(barbers));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const newBarber = JSON.parse(body);
          const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
          const existingIdx = barbers.findIndex((b) => b.id === newBarber.id);
          if (existingIdx !== -1) {
            barbers[existingIdx] = { ...barbers[existingIdx], ...newBarber };
          } else {
            barbers.push(newBarber);
          }
          writeJsonFile(BARBERS_FILE, barbers);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, barber: newBarber }));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  if (reqUrl.startsWith('/api/barbers/') && req.method === 'PUT') {
    const barberId = reqUrl.substring('/api/barbers/'.length);
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const updateData = JSON.parse(body);
        const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
        const idx = barbers.findIndex((b) => b.id === barberId);
        if (idx !== -1) {
          barbers[idx] = { ...barbers[idx], ...updateData };
          writeJsonFile(BARBERS_FILE, barbers);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, barber: barbers[idx] }));
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Barbero no encontrado' }));
        }
      } catch (err) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (reqUrl.startsWith('/api/barbers/') && req.method === 'DELETE') {
    const barberId = reqUrl.substring('/api/barbers/'.length);
    const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
    const filtered = barbers.filter((b) => b.id !== barberId);
    writeJsonFile(BARBERS_FILE, filtered);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --- RUTA 7: API DE USUARIOS (GET / POST / PUT / DELETE) ---
  if (reqUrl === '/api/users') {
    if (req.method === 'GET') {
      const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(users));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const newUser = JSON.parse(body);
          const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
          const existingIdx = users.findIndex((u) => u.id === newUser.id);
          if (existingIdx !== -1) {
            users[existingIdx] = { ...users[existingIdx], ...newUser };
          } else {
            users.push(newUser);
          }
          writeJsonFile(USERS_FILE, users);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, user: newUser }));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  if (reqUrl.startsWith('/api/users/') && req.method === 'PUT') {
    const userId = reqUrl.substring('/api/users/'.length);
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const updateData = JSON.parse(body);
        const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
        const idx = users.findIndex((u) => u.id === userId);
        if (idx !== -1) {
          users[idx] = { ...users[idx], ...updateData };
          writeJsonFile(USERS_FILE, users);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, user: users[idx] }));
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Usuario no encontrado' }));
        }
      } catch (err) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (reqUrl.startsWith('/api/users/') && req.method === 'DELETE') {
    const userId = reqUrl.substring('/api/users/'.length);
    const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
    const filtered = users.filter((u) => u.id !== userId);
    writeJsonFile(USERS_FILE, filtered);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --- RUTA 8: API DE HISTORIAL DE CORTES (GET / POST) ---
  if (reqUrl === '/api/history') {
    if (req.method === 'GET') {
      const history = readJsonFile(HISTORY_FILE, DEFAULT_HISTORY);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(history));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const newRecord = JSON.parse(body);
          const history = readJsonFile(HISTORY_FILE, DEFAULT_HISTORY);
          history.push(newRecord);
          writeJsonFile(HISTORY_FILE, history);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, record: newRecord }));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // --- ARCHIVOS ESTÁTICOS ---
  if (reqUrl === '/' || reqUrl === '') {
    reqUrl = '/index.html';
  }

  const safePath = path.normalize(path.join(ROOT_DIR, reqUrl));

  if (!safePath.startsWith(ROOT_DIR)) {
    res.statusCode = 403;
    res.end('Acceso denegado');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<h1>404 no encontrado</h1><p>${reqUrl}</p>`);
      return;
    }

    let filePath = safePath;
    if (stats.isDirectory()) {
      filePath = path.join(safePath, 'index.html');
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.statusCode = 500;
        res.end('Error al leer el archivo');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.end(data);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n======================================================`);
  console.log(` Barberia Lopez — Servidor con Feed de Calendario iCal`);
  console.log(`======================================================`);
  console.log(` En tu PC (Local):       http://localhost:${PORT}`);
  console.log(` En tu Celular (Wi-Fi):  http://192.168.1.12:${PORT}`);
  console.log(` Feeds iCalendar (.ics): http://192.168.1.12:${PORT}/api/calendar/b-jefe-01.ics`);
  console.log(`======================================================\n`);
});
