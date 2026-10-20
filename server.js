const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const ROOT_DIR = path.resolve(__dirname);
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PUBLIC_SRC_DIR = path.join(ROOT_DIR, 'src');

// Asegurar directorio de datos persistente
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');
const BARBERS_FILE = path.join(DATA_DIR, 'barbers.json');
const SERVICES_FILE = path.join(DATA_DIR, 'services.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const STORE_ORDERS_FILE = path.join(DATA_DIR, 'store_orders.json');

// Clave secreta para tokens de sesion HMAC-SHA256 persistente
const AUTH_SECRET_FILE = path.join(DATA_DIR, '.auth_secret');
let AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  if (fs.existsSync(AUTH_SECRET_FILE)) {
    try {
      const savedSecret = fs.readFileSync(AUTH_SECRET_FILE, 'utf8').trim();
      if (savedSecret && savedSecret.length >= 32) {
        AUTH_SECRET = savedSecret;
      }
    } catch (e) {}
  }
  if (!AUTH_SECRET) {
    AUTH_SECRET = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(AUTH_SECRET_FILE, AUTH_SECRET, { encoding: 'utf8' });
    } catch (e) {}
  }
}

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
  { id: 's-01', name: 'Corte Básico', category: 'Corte + Masaje', durationMinutes: 30, priceCop: 20000, description: 'Corte tradicional o moderno + masaje capilar relajante.', active: true },
  { id: 's-02', name: 'Combo 1', category: 'Corte + Masaje Espalda + Mascarilla + Cejas', durationMinutes: 30, priceCop: 25000, description: 'Corte completo + masaje de espalda + mascarilla negra + perfilado de cejas.', active: true },
  { id: 's-03', name: 'Combo 2', category: 'Corte + Masaje + Mascarilla + Barba + Cejas', durationMinutes: 30, priceCop: 35000, description: 'Corte + masaje + mascarilla facial + ritual de barba con toalla caliente + cejas.', active: true },
  { id: 's-04', name: 'Combo 3', category: 'Corte + Spa + Lavado', durationMinutes: 30, priceCop: 40000, description: 'Corte + masaje + mascarilla + barba completa + cejas + lavado de cabello con shampoo refrescante.', active: true },
  { id: 's-05', name: 'Combi Completa VIP', category: 'Experiencia Total + Granizado', durationMinutes: 30, priceCop: 65000, description: 'Corte + masaje + mascarilla + barba spa + cejas + lavado de cabello + granizado artesanal de la casa.', active: true }
];

const DEFAULT_PRODUCTS = [
  {
    id: 'p-01',
    name: 'Cera Moldeadora Efecto Mate',
    category: 'Ceras & Fijacion',
    priceCop: 25000,
    stock: 12,
    description: 'Fijacion firme durante todo el dia con acabado seco y natural sin residuos grasos. Ideal para cortes texturizados y crop.',
    image: 'https://images.unsplash.com/photo-1621607512214-68297480165e?auto=format&fit=crop&w=600&q=80',
    active: true
  },
  {
    id: 'p-02',
    name: 'Pomada Clasica Brillo Imperial',
    category: 'Ceras & Fijacion',
    priceCop: 25000,
    stock: 10,
    description: 'Formula a base de agua de facil lavado. Perfecta para peinados clasicos, slick back y pompadour con brillo elegante.',
    image: 'https://images.unsplash.com/photo-1585751119414-ef2636f8aede?auto=format&fit=crop&w=600&q=80',
    active: true
  },
  {
    id: 'p-03',
    name: 'Aceite Hidratante para Barba',
    category: 'Cuidado de Barba',
    priceCop: 30000,
    stock: 8,
    description: 'Mezcla de aceites esenciales de argan, jojoba y eucalipto. Suaviza el vello facial, elimina la resequedad y aporta aroma masculino.',
    image: 'https://images.unsplash.com/photo-1608248597359-0e6d526a6c18?auto=format&fit=crop&w=600&q=80',
    active: true
  },
  {
    id: 'p-04',
    name: 'Tonico Activador Capilar 5%',
    category: 'Tratamiento Capilar',
    priceCop: 45000,
    stock: 6,
    description: 'Locion fortalecedora para estimular el crecimiento en zonas despobladas de barba y cuero cabelludo.',
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
    active: true
  },
  {
    id: 'p-05',
    name: 'Polvo Texturizador de Volumen',
    category: 'Ceras & Fijacion',
    priceCop: 28000,
    stock: 9,
    description: 'Polvo ultraligero que aporta volumen instantaneo desde la raiz y control mate de larga duracion sin apelmazar.',
    image: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=600&q=80',
    active: true
  },
  {
    id: 'p-06',
    name: 'Cepillo Fade Cerdas Naturales',
    category: 'Accesorios',
    priceCop: 18000,
    stock: 15,
    description: 'Cepillo ergonomico en madera con cerdas firmes para peinar degradados, limpiar contornos y distribuir aceites en la barba.',
    image: 'https://images.unsplash.com/photo-1590159763121-7c9fd312190d?auto=format&fit=crop&w=600&q=80',
    active: true
  }
];

const DEFAULT_APPOINTMENTS = [];
const DEFAULT_HISTORY = [];
const DEFAULT_STORE_ORDERS = [];

function readJsonFile(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      writeJsonFileAtomic(filePath, defaultValue);
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error leyendo ${filePath}:`, err.message);
    return defaultValue;
  }
}

function writeJsonFileAtomic(filePath, data) {
  try {
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    console.error(`Error escribiendo atomicamente en ${filePath}:`, err.message);
    return false;
  }
}

// Inicializar archivos si no existen
readJsonFile(USERS_FILE, DEFAULT_USERS);
readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
readJsonFile(SERVICES_FILE, DEFAULT_SERVICES);
readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
readJsonFile(HISTORY_FILE, DEFAULT_HISTORY);
readJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
readJsonFile(STORE_ORDERS_FILE, DEFAULT_STORE_ORDERS);

// ============================================================================
// CRIPTOGRAFIA Y AUTENTICACION SEGURA NATIVA (SCRYPT + HMAC TOKENS)
// ============================================================================

function hashPasswordScrypt(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(plainPassword).trim(), salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

function verifyPasswordSecure(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) return false;
  const cleanInput = String(plainPassword).trim();

  // Si esta hasheado con scrypt
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const key = parts[2];
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(cleanInput, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  }

  // Compatibilidad con contraseñas legadas en texto plano y tolerancia de teclado movil
  const cleanStored = String(storedHash).trim();
  const variations = [
    cleanInput,
    cleanInput.replace(/\.$/, ''),
    cleanInput.toLowerCase(),
    cleanInput.toLowerCase().replace(/\.$/, ''),
    cleanInput.replace(/^@/, ''),
    cleanInput.toLowerCase().replace(/^@/, '').replace(/\.$/, '')
  ];

  const storedVariations = [
    cleanStored,
    cleanStored.replace(/\.$/, ''),
    cleanStored.toLowerCase(),
    cleanStored.toLowerCase().replace(/\.$/, ''),
    cleanStored.replace(/^@/, ''),
    cleanStored.toLowerCase().replace(/^@/, '').replace(/\.$/, '')
  ];

  for (const sv of storedVariations) {
    for (const iv of variations) {
      if (sv === iv) return true;
    }
  }

  return false;
}

function generateSessionToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    username: user.username,
    role: user.role,
    barberId: user.barberId,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas de validez
  })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expBuffer)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return data;
  } catch (err) {
    return null;
  }
}

function getAuthenticatedUser(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifySessionToken(match[1]);
}

// ============================================================================
// RATE LIMITING NATIVO EN MEMORIA
// ============================================================================

const ipRequests = new Map();
const ipAuthAttempts = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, item] of ipRequests.entries()) {
    if (now > item.resetTime) ipRequests.delete(ip);
  }
  for (const [ip, item] of ipAuthAttempts.entries()) {
    if (now > item.resetTime) ipAuthAttempts.delete(ip);
  }
}, 120000);

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

function checkRateLimit(req, res, maxRequests = 120, windowMs = 60000) {
  const ip = getClientIp(req);
  const now = Date.now();
  let record = ipRequests.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    ipRequests.set(ip, record);
    return true;
  }
  record.count++;
  if (record.count > maxRequests) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
    res.end(JSON.stringify({ error: 'Limite de peticiones excedido. Intente nuevamente en un minuto.' }));
    return false;
  }
  return true;
}

function checkAuthRateLimit(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutos
  const maxAttempts = 10;
  let record = ipAuthAttempts.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    ipAuthAttempts.set(ip, record);
    return true;
  }
  record.count++;
  if (record.count > maxAttempts) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
    res.end(JSON.stringify({ error: 'Demasiados intentos fallidos de autenticacion. Bloqueado temporalmente.' }));
    return false;
  }
  return true;
}

// ============================================================================
// LECTURA DE CUERPO CON LIMITE MAXIMO (DOS DEFENSE)
// ============================================================================

function readJsonBody(req, maxSize = 65536) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        req.destroy();
        reject(new Error('PAYLOAD_TOO_LARGE'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw.trim()) {
          resolve({});
          return;
        }
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

// ============================================================================
// PREVENCION DE DOUBLE-BOOKING Y MUTEX TRANSACCIONAL
// ============================================================================

let appointmentLock = Promise.resolve();

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isTimeOverlapping(startA, endA, startB, endB) {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return !(eB <= sA || sB >= eA);
}

function validateAndSaveAppointment(newAppt) {
  return new Promise((resolve, reject) => {
    appointmentLock = appointmentLock.then(() => {
      try {
        if (!newAppt.barberId || !newAppt.date || !newAppt.startTime || !newAppt.endTime) {
          throw new Error('Parametros de cita incompletos: barbero, fecha y horarios son obligatorios.');
        }

        // Sanitizar campos basicos
        newAppt.clientName = String(newAppt.clientName || 'Cliente').trim().substring(0, 100);
        newAppt.clientPhone = String(newAppt.clientPhone || '').replace(/[^\d+ ]/g, '').trim().substring(0, 25);
        newAppt.date = String(newAppt.date).trim();
        newAppt.startTime = String(newAppt.startTime).trim();
        newAppt.endTime = String(newAppt.endTime).trim();

        const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
        const barber = barbers.find((b) => b.id === newAppt.barberId);
        if (!barber || !barber.active) {
          throw new Error('El barbero seleccionado no existe o no se encuentra activo.');
        }

        const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);

        // Validar colision con citas existentes no canceladas
        if (newAppt.status !== 'CANCELADA') {
          // Deteccion idempotente de reenvio/doble-tap del mismo cliente
          const duplicateSameClient = appointments.find((a) => {
            if (a.status === 'CANCELADA') return false;
            if (a.barberId !== newAppt.barberId) return false;
            if (a.date !== newAppt.date) return false;
            if (a.startTime !== newAppt.startTime) return false;
            const cleanPhoneA = String(a.clientPhone || '').replace(/\D/g, '');
            const cleanPhoneNew = String(newAppt.clientPhone || '').replace(/\D/g, '');
            const phoneMatch = cleanPhoneA && cleanPhoneNew && (cleanPhoneA === cleanPhoneNew);
            const nameMatch = a.clientName && newAppt.clientName && (String(a.clientName).trim().toLowerCase() === String(newAppt.clientName).trim().toLowerCase());
            return phoneMatch || nameMatch;
          });

          if (duplicateSameClient) {
            resolve(duplicateSameClient);
            return;
          }

          const collision = appointments.some((a) => {
            if (a.id === newAppt.id) return false;
            if (a.status === 'CANCELADA') return false;
            if (a.barberId !== newAppt.barberId) return false;
            if (a.date !== newAppt.date) return false;
            return isTimeOverlapping(a.startTime, a.endTime, newAppt.startTime, newAppt.endTime);
          });

          if (collision) {
            const err = new Error('El turno seleccionado ya no se encuentra disponible con este barbero.');
            err.code = 'SLOT_OCCUPIED';
            throw err;
          }
        }

        const existingIdx = appointments.findIndex((a) => a.id === newAppt.id);
        if (existingIdx !== -1) {
          appointments[existingIdx] = { ...appointments[existingIdx], ...newAppt };
        } else {
          appointments.push(newAppt);
        }

        writeJsonFileAtomic(APPOINTMENTS_FILE, appointments);
        resolve(newAppt);
      } catch (err) {
        reject(err);
      }
    });
  });
}

// ============================================================================
// FEEDS ICALENDAR RFC 5545 CON SANITIZACION ESTRICTA
// ============================================================================

function sanitizeIcsText(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

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

function generateIcsForBarber(barberId, host) {
  const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
  const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
  const services = readJsonFile(SERVICES_FILE, DEFAULT_SERVICES);

  const barbersMap = new Map(barbers.map((b) => [b.id, b]));
  const servicesMap = new Map(services.map((s) => [s.id, s]));

  const targetBarber = barbers.find((b) => b.id === barberId);
  const isAll = barberId === 'all' || !targetBarber;
  const calName = isAll ? 'Barbería López · Todos los Turnos' : `Barbería López · ${sanitizeIcsText(targetBarber.name)}`;

  const filteredAppts = isAll
    ? appointments
    : appointments.filter((a) => a.barberId === barberId);

  const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const events = filteredAppts.map((appt) => {
    const b = barbersMap.get(appt.barberId) || { name: 'Barbero' };
    const s = servicesMap.get(appt.serviceId) || { name: 'Corte Tradicional', priceCop: 0, durationMinutes: 30 };

    const dtStartUtc = localToUtcIso(appt.date, appt.startTime || '10:00');
    const dtEndUtc = localToUtcIso(appt.date, appt.endTime || '10:30');

    const uid = sanitizeIcsText(appt.calendarEventUid || `${appt.id || Date.now()}@barberialopez.co`);
    const summary = sanitizeIcsText(`Cita: ${appt.clientName} (${s.name})`);
    const description = sanitizeIcsText(
      `Cliente: ${appt.clientName}\\nTel: ${appt.clientPhone || 'No registrado'}\\nServicio: ${s.name}\\nEstación: ${b.name}\\nValor: $${(s.priceCop || 0).toLocaleString('es-CO')} COP\\nPago: ${appt.paymentMethod || 'EFECTIVO'}\\nEstado: ${appt.status || 'CONFIRMADA'}`
    );
    const location = sanitizeIcsText('Barbería López, Neiva, Huila');

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowUtc}`,
      `SEQUENCE:0`,
      `DTSTART:${dtStartUtc}`,
      `DTEND:${dtEndUtc}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      `STATUS:${appt.status === 'CANCELADA' ? 'CANCELLED' : 'CONFIRMED'}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${sanitizeIcsText(`Recordatorio Turno: ${appt.clientName}`)}`,
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
    `X-WR-CALDESC:Turnos en vivo de ${isAll ? 'todas las estaciones' : sanitizeIcsText(targetBarber.name)} en Barbería López`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
    events.join('\r\n'),
    'END:VCALENDAR'
  ];

  return calendarLines.join('\r\n');
}

function generateSingleAppointmentIcs(appt) {
  const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
  const services = readJsonFile(SERVICES_FILE, DEFAULT_SERVICES);
  const barber = barbers.find((b) => b.id === appt.barberId) || { name: 'Barbero' };
  const service = services.find((s) => s.id === appt.serviceId) || { name: 'Corte Tradicional', priceCop: 0, durationMinutes: 30 };

  const dtStartUtc = localToUtcIso(appt.date, appt.startTime || '10:00');
  const dtEndUtc = localToUtcIso(appt.date, appt.endTime || '10:30');
  const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = sanitizeIcsText(appt.calendarEventUid || `${appt.id || Date.now()}@barberialopez.co`);
  const summary = sanitizeIcsText(`Cita Barbería López - ${service.name}`);
  const description = sanitizeIcsText(
    `Cita agendada con ${barber.name}.\\nServicio: ${service.name}\\nValor: $${(service.priceCop || 0).toLocaleString('es-CO')} COP\\nLínea oficial: +57 321 989 7910`
  );

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
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'LOCATION:Barbería López, Neiva, Huila',
    `STATUS:${appt.status === 'CANCELADA' ? 'CANCELLED' : 'CONFIRMED'}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT60M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${sanitizeIcsText(`Recordatorio de Turno en Barbería López: ${service.name}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

function generateIcsForClient(clientPhone) {
  const cleanPhone = (clientPhone || '').replace(/\D/g, '');
  if (cleanPhone.length < 7) {
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Barberia Lopez//Citas Cliente//ES',
      'END:VCALENDAR'
    ].join('\r\n');
  }

  const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
  const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
  const services = readJsonFile(SERVICES_FILE, DEFAULT_SERVICES);

  const barbersMap = new Map(barbers.map((b) => [b.id, b]));
  const servicesMap = new Map(services.map((s) => [s.id, s]));

  const clientAppts = appointments.filter((a) => {
    const aPhone = (a.clientPhone || '').replace(/\D/g, '');
    if (!aPhone) return false;
    return aPhone.endsWith(cleanPhone) || cleanPhone.endsWith(aPhone);
  });

  const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const events = clientAppts.map((appt) => {
    const b = barbersMap.get(appt.barberId) || { name: 'Maestro Lopez' };
    const s = servicesMap.get(appt.serviceId) || { name: 'Corte Tradicional', priceCop: 0, durationMinutes: 30 };

    const dtStartUtc = localToUtcIso(appt.date, appt.startTime || '10:00');
    const dtEndUtc = localToUtcIso(appt.date, appt.endTime || '10:30');
    const uid = sanitizeIcsText(appt.calendarEventUid || `${appt.id || Date.now()}@barberialopez.co`);
    const summary = sanitizeIcsText(`Cita Barbería López - ${s.name}`);
    const description = sanitizeIcsText(
      `Barbero: ${b.name}\\nServicio: ${s.name}\\nValor: $${(s.priceCop || 0).toLocaleString('es-CO')} COP\\nLínea oficial: +57 321 989 7910`
    );

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowUtc}`,
      `SEQUENCE:0`,
      `DTSTART:${dtStartUtc}`,
      `DTEND:${dtEndUtc}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      'LOCATION:Barbería López, Neiva, Huila',
      `STATUS:${appt.status === 'CANCELADA' ? 'CANCELLED' : 'CONFIRMED'}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT60M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${sanitizeIcsText(`Recordatorio Turno en Barbería López: ${s.name}`)}`,
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

// ============================================================================
// CABECERAS DE SEGURIDAD HTTP
// ============================================================================

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.tailwindcss.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://images.unsplash.com https:",
    "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
    "frame-ancestors 'self'"
  ].join('; '));
}

// ============================================================================
// VALIDADOR ESTRICTO DE RUTAS ESTATICAS (ANTI DIRECTORY TRAVERSAL & LEAKS)
// ============================================================================

const ALLOWED_EXACT_ROOT_FILES = new Set([
  path.resolve(ROOT_DIR, 'index.html'),
  path.resolve(ROOT_DIR, 'logo_barberia_lopez_hd.jpg'),
  path.resolve(ROOT_DIR, 'dossier_barberia_lopez.html'),
  path.resolve(ROOT_DIR, 'Dossier_Plataforma_Barberia_Lopez.pdf'),
  path.resolve(ROOT_DIR, 'favicon.ico')
]);

function isPathSafeAndAllowed(targetPath) {
  const resolved = path.resolve(targetPath);

  // Prohibicion tajante de archivos de datos, servidor y configuracion
  if (resolved.includes(path.sep + 'data' + path.sep) || resolved.endsWith(path.sep + 'data')) return false;
  if (resolved.endsWith('server.js') || resolved.endsWith('package.json') || resolved.endsWith('package-lock.json')) return false;
  if (resolved.includes(path.sep + '.git')) return false;
  if (resolved.includes(path.sep + '.env')) return false;
  if (resolved.includes(path.sep + 'barberia-docs')) return false;
  if (resolved.includes(path.sep + 'REGLAS-IA')) return false;

  // Permitir todo lo contenido dentro de /src/
  if (resolved.startsWith(PUBLIC_SRC_DIR + path.sep) || resolved === PUBLIC_SRC_DIR) return true;

  // O archivos publicos autorizados en la raiz
  return ALLOWED_EXACT_ROOT_FILES.has(resolved);
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
  '.ics': 'text/calendar; charset=utf-8',
  '.pdf': 'application/pdf'
};

// ============================================================================
// SERVIDOR HTTP PRINCIPAL
// ============================================================================

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;

  // Aplicar cabeceras de seguridad globales
  applySecurityHeaders(res);

  // Limite de tasa global (Rate Limiter)
  if (!checkRateLimit(req, res)) return;

  // Sanitizar URL contra inyecciones de null bytes y decode
  let reqUrl;
  try {
    reqUrl = decodeURI(req.url.split('?')[0]);
  } catch (err) {
    res.statusCode = 400;
    res.end('URL invalida');
    return;
  }

  if (reqUrl.includes('\0') || reqUrl.includes('%00')) {
    res.statusCode = 400;
    res.end('Peticion maliciosa bloqueada');
    return;
  }

  // Headers CORS para APIs autorizadas
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // --------------------------------------------------------------------------
  // ENDPOINT DE AUTENTICACION CENTRALIZADA: POST /api/auth/login
  // --------------------------------------------------------------------------
  if (reqUrl === '/api/auth/login' && req.method === 'POST') {
    if (!checkAuthRateLimit(req, res)) return;

    try {
      const { username, password } = await readJsonBody(req);
      if (!username || !password) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Usuario y contrasena son obligatorios.' }));
        return;
      }

      const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
      const cleanUser = String(username).replace(/^@/, '').toLowerCase().trim();
      const targetUser = users.find((u) => {
        const uClean = (u.username || '').replace(/^@/, '').toLowerCase().trim();
        return uClean === cleanUser;
      });

      if (!targetUser || !targetUser.active) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Credenciales invalidas o usuario inactivo.' }));
        return;
      }

      const isValid = verifyPasswordSecure(password, targetUser.passwordHash);
      if (!isValid) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Credenciales invalidas.' }));
        return;
      }

      // Migracion automatica transparente a scrypt seguro si aun esta en texto plano
      if (!targetUser.passwordHash.startsWith('scrypt:')) {
        targetUser.passwordHash = hashPasswordScrypt(password);
        writeJsonFileAtomic(USERS_FILE, users);
      }

      const token = generateSessionToken(targetUser);
      const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
      const barber = targetUser.barberId ? barbers.find((b) => b.id === targetUser.barberId) || null : null;

      // Devolver objeto de usuario sin exponer el passwordHash
      const safeUser = {
        id: targetUser.id,
        username: targetUser.username,
        role: targetUser.role,
        barberId: targetUser.barberId,
        active: targetUser.active
      };

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, token, user: safeUser, barber }));
      return;
    } catch (err) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  // --------------------------------------------------------------------------
  // RUTAS ICALENDAR (FEEDS RFC 5545)
  // --------------------------------------------------------------------------

  // Feed iCalendar del cliente (todas sus citas por telefono)
  if (reqUrl.startsWith('/api/calendar/client/') && reqUrl.endsWith('.ics')) {
    const rawPhone = reqUrl.substring('/api/calendar/client/'.length).replace(/\.ics$/, '');
    const cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length < 7) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Numero de telefono invalido o incompleto');
      return;
    }
    const icsContent = generateIcsForClient(cleanPhone);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="mis_turnos.ics"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.end(icsContent);
    return;
  }

  // Descarga iCalendar para una cita individual (soporta ambas rutas)
  if ((reqUrl.startsWith('/api/calendar/appointment/') || reqUrl.startsWith('/api/appointment/')) && reqUrl.endsWith('.ics')) {
    const apptId = reqUrl.replace('/api/calendar/appointment/', '').replace('/api/appointment/', '').replace(/\.ics$/, '');
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
    res.setHeader('Content-Disposition', `inline; filename="cita_${sanitizeIcsText(apptId)}.ics"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.end(icsContent);
    return;
  }

  // Feed iCalendar en vivo para la estacion del barbero
  if (reqUrl.startsWith('/api/calendar/') && reqUrl.endsWith('.ics')) {
    const filename = reqUrl.substring('/api/calendar/'.length);
    const barberId = filename.replace(/\.ics$/, '');

    const icsContent = generateIcsForBarber(barberId, host);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="turnos_${sanitizeIcsText(barberId)}.ics"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.end(icsContent);
    return;
  }

  // --------------------------------------------------------------------------
  // API DE CITAS (/api/appointments) CON CONTROL DE COLISIONES
  // --------------------------------------------------------------------------
  if (reqUrl === '/api/appointments') {
    if (req.method === 'GET') {
      const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(appointments));
      return;
    }

    if (req.method === 'POST') {
      try {
        const newAppt = await readJsonBody(req);
        if (!newAppt || typeof newAppt !== 'object') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Datos de cita invalidos' }));
          return;
        }

        const saved = await validateAndSaveAppointment(newAppt);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, appointment: saved }));
        return;
      } catch (err) {
        res.statusCode = err.code === 'SLOT_OCCUPIED' ? 409 : 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message, code: err.code || 'BAD_REQUEST' }));
        return;
      }
    }
  }

  // Actualizar cita especifica (PUT /api/appointments/:id)
  if (reqUrl.startsWith('/api/appointments/') && req.method === 'PUT') {
    const apptId = reqUrl.substring('/api/appointments/'.length);
    try {
      const updateData = await readJsonBody(req);
      const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
      const idx = appointments.findIndex((a) => a.id === apptId);
      if (idx !== -1) {
        const updated = { ...appointments[idx], ...updateData, id: apptId };
        const saved = await validateAndSaveAppointment(updated);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, appointment: saved }));
      } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Cita no encontrada' }));
      }
      return;
    } catch (err) {
      res.statusCode = err.code === 'SLOT_OCCUPIED' ? 409 : 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message, code: err.code || 'BAD_REQUEST' }));
      return;
    }
  }

  // --------------------------------------------------------------------------
  // API DE SINCRONIZACION GENERAL: POST /api/sync (REQUIERE AUTENTICACION)
  // --------------------------------------------------------------------------
  if (reqUrl === '/api/sync' && req.method === 'POST') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'No autorizado para sincronizacion de sistema.' }));
      return;
    }

    try {
      const payload = await readJsonBody(req);
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
        writeJsonFileAtomic(APPOINTMENTS_FILE, Array.from(idMap.values()));
      }

      // Administradores y Barberos Jefes pueden sincronizar barberos y usuarios en masa
      if (authUser.role === 'ADMIN' || authUser.role === 'JEFE') {
        if (Array.isArray(payload.barbers)) {
          writeJsonFileAtomic(BARBERS_FILE, payload.barbers);
        }
        if (Array.isArray(payload.users)) {
          // Asegurar que las contraseñas esten protegidas
          const usersToSave = payload.users.map((u) => {
            if (u.passwordHash && !u.passwordHash.startsWith('scrypt:')) {
              u.passwordHash = hashPasswordScrypt(u.passwordHash);
            }
            return u;
          });
          writeJsonFileAtomic(USERS_FILE, usersToSave);
        }
      }

      const currentAppointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, appointments: currentAppointments }));
      return;
    } catch (err) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  // --------------------------------------------------------------------------
  // API ATOMICA: CREAR BARBERO Y USUARIO EN UNA SOLA TRANSACCION
  // --------------------------------------------------------------------------
  if (reqUrl === '/api/barbers/with-user' && req.method === 'POST') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'JEFE')) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Acceso denegado: se requieren permisos administrativos.' }));
      return;
    }

    try {
      const payload = await readJsonBody(req);
      const { barberData, userData } = payload || {};
      if (!barberData || !userData || !userData.username || !userData.password) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Faltan datos obligatorios para crear el barbero y sus credenciales.' }));
        return;
      }

      const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
      const cleanUsername = String(userData.username).replace(/^@/, '').toLowerCase().trim();
      const existingUser = users.find((u) => (u.username || '').replace(/^@/, '').toLowerCase().trim() === cleanUsername);
      if (existingUser) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: `El usuario '@${cleanUsername}' ya existe.` }));
        return;
      }

      const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
      const barberId = barberData.id || crypto.randomUUID();
      const userId = userData.id || crypto.randomUUID();

      const newBarber = {
        id: barberId,
        userId: userId,
        name: String(barberData.name || 'Barbero').trim(),
        specialty: String(barberData.specialty || 'Barbero Profesional').trim(),
        phone: String(barberData.phone || '+57 321 989 7910').trim(),
        avatar: barberData.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
        active: barberData.active !== false
      };

      const passwordHash = hashPasswordScrypt(userData.password);
      const targetRole = (authUser.role === 'JEFE' && userData.role === 'ADMIN') ? 'BARBERO' : (userData.role || 'BARBERO');
      const newUser = {
        id: userId,
        username: cleanUsername,
        passwordHash: passwordHash,
        role: targetRole,
        barberId: barberId,
        active: true,
        createdAt: new Date().toISOString()
      };

      barbers.push(newBarber);
      users.push(newUser);

      writeJsonFileAtomic(BARBERS_FILE, barbers);
      writeJsonFileAtomic(USERS_FILE, users);

      res.statusCode = 201;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        success: true,
        barber: newBarber,
        user: {
          id: newUser.id,
          username: newUser.username,
          role: newUser.role,
          barberId: newUser.barberId,
          active: newUser.active
        }
      }));
      return;
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Error interno al registrar barbero y usuario: ' + err.message }));
      return;
    }
  }

  // --------------------------------------------------------------------------
  // API DE BARBEROS: GET (PUBLICO) / POST, PUT, DELETE (REQUIERE ADMIN O JEFE)
  // --------------------------------------------------------------------------
  if (reqUrl === '/api/barbers') {
    if (req.method === 'GET') {
      const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(barbers));
      return;
    }

    if (req.method === 'POST') {
      const authUser = getAuthenticatedUser(req);
      if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'JEFE')) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Acceso denegado: se requieren privilegios de Administrador.' }));
        return;
      }

      try {
        const newBarber = await readJsonBody(req);
        const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
        const existingIdx = barbers.findIndex((b) => b.id === newBarber.id);
        if (existingIdx !== -1) {
          barbers[existingIdx] = { ...barbers[existingIdx], ...newBarber };
        } else {
          barbers.push(newBarber);
        }
        writeJsonFileAtomic(BARBERS_FILE, barbers);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, barber: newBarber }));
        return;
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }
  }

  if (reqUrl.startsWith('/api/barbers/') && req.method === 'PUT') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'JEFE')) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Acceso denegado: se requieren permisos administrativos.' }));
      return;
    }

    const barberId = reqUrl.substring('/api/barbers/'.length);
    try {
      const updateData = await readJsonBody(req);
      const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
      const idx = barbers.findIndex((b) => b.id === barberId);
      if (idx !== -1) {
        barbers[idx] = { ...barbers[idx], ...updateData };
        writeJsonFileAtomic(BARBERS_FILE, barbers);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, barber: barbers[idx] }));
      } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Barbero no encontrado' }));
      }
      return;
    } catch (err) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  if (reqUrl.startsWith('/api/barbers/') && req.method === 'DELETE') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'JEFE')) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Acceso denegado: se requieren permisos administrativos.' }));
      return;
    }

    const barberId = reqUrl.substring('/api/barbers/'.length);
    const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
    const filtered = barbers.filter((b) => b.id !== barberId);
    writeJsonFileAtomic(BARBERS_FILE, filtered);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --------------------------------------------------------------------------
  // API DE USUARIOS: GET (SANITIZADO) / POST, PUT, DELETE (REQUIERE ADMIN)
  // --------------------------------------------------------------------------
  if (reqUrl === '/api/users') {
    if (req.method === 'GET') {
      const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
      // Sanitizar: NUNCA devolver passwordHash sobre la red
      const sanitizedUsers = users.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        barberId: u.barberId,
        active: u.active
      }));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(sanitizedUsers));
      return;
    }

    if (req.method === 'POST') {
      const authUser = getAuthenticatedUser(req);
      if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'JEFE')) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Acceso denegado: se requieren permisos administrativos.' }));
        return;
      }

      try {
        const newUser = await readJsonBody(req);
        if (!newUser.username || !newUser.role) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Faltan campos obligatorios para el usuario.' }));
          return;
        }

        if (authUser.role === 'JEFE' && newUser.role === 'ADMIN') {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Un Barbero Jefe no puede crear usuarios Administradores.' }));
          return;
        }

        const rawPassword = newUser.passwordHash || newUser.password || 'Lopez2026*';
        newUser.passwordHash = hashPasswordScrypt(rawPassword);
        delete newUser.password;

        const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
        const existingIdx = users.findIndex((u) => u.id === newUser.id);
        if (existingIdx !== -1) {
          users[existingIdx] = { ...users[existingIdx], ...newUser };
        } else {
          users.push(newUser);
        }
        writeJsonFileAtomic(USERS_FILE, users);

        const safeResponse = {
          id: newUser.id,
          username: newUser.username,
          role: newUser.role,
          barberId: newUser.barberId,
          active: newUser.active
        };

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, user: safeResponse }));
        return;
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }
  }

  if (reqUrl.startsWith('/api/users/') && req.method === 'PUT') {
    const authUser = getAuthenticatedUser(req);
    const userId = reqUrl.substring('/api/users/'.length);

    // Solo admin, jefe o el propio usuario modificandose
    if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'JEFE' && authUser.sub !== userId)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Acceso denegado.' }));
      return;
    }

    try {
      const updateData = await readJsonBody(req);
      const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
      const idx = users.findIndex((u) => u.id === userId);
      if (idx !== -1) {
        if (updateData.passwordHash) {
          updateData.passwordHash = hashPasswordScrypt(updateData.passwordHash);
        }
        if (updateData.password) {
          updateData.passwordHash = hashPasswordScrypt(updateData.password);
          delete updateData.password;
        }

        users[idx] = { ...users[idx], ...updateData };
        writeJsonFileAtomic(USERS_FILE, users);

        const safeUser = {
          id: users[idx].id,
          username: users[idx].username,
          role: users[idx].role,
          barberId: users[idx].barberId,
          active: users[idx].active
        };

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, user: safeUser }));
      } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Usuario no encontrado' }));
      }
      return;
    } catch (err) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  if (reqUrl.startsWith('/api/users/') && req.method === 'DELETE') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'JEFE')) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Acceso denegado: se requieren permisos administrativos.' }));
      return;
    }

    const userId = reqUrl.substring('/api/users/'.length);
    const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
    const target = users.find((u) => u.id === userId);
    if (target && target.role === 'ADMIN') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'No se permite eliminar al usuario Administrador.' }));
      return;
    }

    const filtered = users.filter((u) => u.id !== userId);
    writeJsonFileAtomic(USERS_FILE, filtered);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --------------------------------------------------------------------------
  // API DE HISTORIAL: GET (AUTENTICADO) / POST (AUTENTICADO)
  // --------------------------------------------------------------------------
  if (reqUrl === '/api/history') {
    if (req.method === 'GET') {
      const history = readJsonFile(HISTORY_FILE, DEFAULT_HISTORY);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(history));
      return;
    }

    if (req.method === 'POST') {
      const authUser = getAuthenticatedUser(req);
      if (!authUser) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Debe iniciar sesion para registrar un corte en el historial.' }));
        return;
      }

      try {
        const newRecord = await readJsonBody(req);
        const history = readJsonFile(HISTORY_FILE, DEFAULT_HISTORY);
        history.push(newRecord);
        writeJsonFileAtomic(HISTORY_FILE, history);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, record: newRecord }));
        return;
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }
  }

  if (reqUrl === '/api/services' && req.method === 'GET') {
    const services = readJsonFile(SERVICES_FILE, DEFAULT_SERVICES);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(services));
    return;
  }

  // --------------------------------------------------------------------------
  // API DE TIENDA E INVENTARIO DE PRODUCTOS (/api/products y /api/store/orders)
  // --------------------------------------------------------------------------
  if (reqUrl === '/api/products') {
    if (req.method === 'GET') {
      const products = readJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(products));
      return;
    }

    if (req.method === 'POST') {
      const authUser = getAuthenticatedUser(req);
      if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'JEFE')) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Acceso denegado: solo el Barbero Jefe o Administrador puede agregar productos.' }));
        return;
      }

      try {
        const body = await readJsonBody(req);
        const name = String(body.name || '').trim();
        const category = String(body.category || 'Cuidado Personal').trim();
        const description = String(body.description || '').trim();
        const priceCop = Math.max(0, Number(body.priceCop) || 0);
        const stock = Math.max(0, Math.floor(Number(body.stock) || 0));
        const imageUrl = String(body.imageUrl || 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=600&auto=format&fit=crop&q=80').trim();

        if (!name || priceCop <= 0) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Nombre del producto y precio mayor a cero son obligatorios.' }));
          return;
        }

        const products = readJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
        const newProduct = {
          id: body.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name,
          category,
          description: description || 'Producto oficial de cuidado masculino Barberia Lopez.',
          priceCop,
          stock,
          imageUrl,
          active: true,
          createdAt: new Date().toISOString()
        };

        products.push(newProduct);
        writeJsonFileAtomic(PRODUCTS_FILE, products);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, product: newProduct, products }));
        return;
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }
  }

  if (reqUrl.startsWith('/api/products/') && req.method === 'PUT') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'JEFE')) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Acceso denegado: solo el Barbero Jefe o Administrador puede editar el inventario.' }));
      return;
    }

    try {
      const productId = decodeURIComponent(reqUrl.substring('/api/products/'.length));
      const updates = await readJsonBody(req);
      const products = readJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
      const idx = products.findIndex((p) => p.id === productId);

      if (idx === -1) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Producto no encontrado.' }));
        return;
      }

      if (updates.name !== undefined) products[idx].name = String(updates.name).trim();
      if (updates.category !== undefined) products[idx].category = String(updates.category).trim();
      if (updates.description !== undefined) products[idx].description = String(updates.description).trim();
      if (updates.priceCop !== undefined) products[idx].priceCop = Math.max(0, Number(updates.priceCop) || 0);
      if (updates.stock !== undefined) products[idx].stock = Math.max(0, Math.floor(Number(updates.stock) || 0));
      if (updates.imageUrl !== undefined && String(updates.imageUrl).trim()) {
        products[idx].imageUrl = String(updates.imageUrl).trim();
      }
      if (updates.active !== undefined) products[idx].active = Boolean(updates.active);

      writeJsonFileAtomic(PRODUCTS_FILE, products);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, product: products[idx], products }));
      return;
    } catch (err) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  if (reqUrl.startsWith('/api/products/') && req.method === 'DELETE') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'JEFE')) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Acceso denegado: solo el Barbero Jefe o Administrador puede eliminar productos.' }));
      return;
    }

    const productId = decodeURIComponent(reqUrl.substring('/api/products/'.length));
    const products = readJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
    const filtered = products.filter((p) => p.id !== productId);
    writeJsonFileAtomic(PRODUCTS_FILE, filtered);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: true, products: filtered }));
    return;
  }

  // Pedidos de Tienda con Referencia Unica Anti-Robo y Pago Solo en Efectivo
  if (reqUrl === '/api/store/orders') {
    if (req.method === 'GET') {
      const orders = readJsonFile(STORE_ORDERS_FILE, DEFAULT_STORE_ORDERS);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(orders));
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const productId = String(body.productId || '').trim();
        const clientName = String(body.clientName || '').trim();
        const clientPhone = String(body.clientPhone || '').trim();
        const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1));

        if (!productId || !clientName || !clientPhone) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Debes indicar producto, tu nombre completo y tu numero de WhatsApp.' }));
          return;
        }

        const products = readJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
        const prodIdx = products.findIndex((p) => p.id === productId);
        if (prodIdx === -1) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'El producto seleccionado no existe.' }));
          return;
        }

        const product = products[prodIdx];
        if (product.stock < quantity) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            error: product.stock === 0
              ? 'Lo sentimos, este producto se encuentra agotado en este momento.'
              : `Solo quedan ${product.stock} unidades disponibles de ${product.name}.`
          }));
          return;
        }

        const orders = readJsonFile(STORE_ORDERS_FILE, DEFAULT_STORE_ORDERS);

        // Generar codigo de referencia unico e irrepetible formato REF-BL-XXXX
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let referenceCode = '';
        let exists = true;
        while (exists) {
          let suffix = '';
          for (let i = 0; i < 4; i++) {
            suffix += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          referenceCode = `REF-BL-${suffix}`;
          exists = orders.some((o) => o.referenceCode === referenceCode);
        }

        // Descontar del stock inmediatamente para reservar el producto al cliente
        products[prodIdx].stock -= quantity;
        writeJsonFileAtomic(PRODUCTS_FILE, products);

        // Fecha actual en zona horaria de Colombia (UTC-5)
        const nowCol = new Date(Date.now() - (5 * 60 * 60 * 1000));
        const dateStr = nowCol.toISOString().split('T')[0];

        const newOrder = {
          id: `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          referenceCode,
          productId: product.id,
          productName: product.name,
          productCategory: product.category,
          unitPriceCop: product.priceCop,
          quantity,
          totalCop: product.priceCop * quantity,
          clientName,
          clientPhone,
          paymentMethod: 'EFECTIVO',
          status: 'PENDIENTE', // PENDIENTE | ENTREGADO | CANCELADO
          date: dateStr,
          createdAt: new Date().toISOString(),
          deliveredAt: null,
          deliveredDate: null,
          deliveredBy: null
        };

        orders.unshift(newOrder);
        writeJsonFileAtomic(STORE_ORDERS_FILE, orders);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          order: newOrder,
          product: products[prodIdx]
        }));
        return;
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }
  }

  if (reqUrl.startsWith('/api/store/orders/') && reqUrl.endsWith('/deliver') && req.method === 'PUT') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Debes iniciar sesion como barbero o administrador para verificar y entregar pedidos.' }));
      return;
    }

    const orderId = decodeURIComponent(reqUrl.slice('/api/store/orders/'.length, -'/deliver'.length));
    const orders = readJsonFile(STORE_ORDERS_FILE, DEFAULT_STORE_ORDERS);
    const idx = orders.findIndex((o) => o.id === orderId || o.referenceCode === orderId);

    if (idx === -1) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Pedido o referencia no encontrada.' }));
      return;
    }

    if (orders[idx].status === 'ENTREGADO') {
      res.statusCode = 409;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'ALERTA: Esta referencia ya fue cobrada y entregada anteriormente.' }));
      return;
    }

    if (orders[idx].status === 'CANCELADO') {
      res.statusCode = 409;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Este pedido fue cancelado y su stock ya fue devuelto.' }));
      return;
    }

    const nowCol = new Date(Date.now() - (5 * 60 * 60 * 1000));
    const deliveredDate = nowCol.toISOString().split('T')[0];

    orders[idx].status = 'ENTREGADO';
    orders[idx].deliveredAt = new Date().toISOString();
    orders[idx].deliveredDate = deliveredDate;
    orders[idx].deliveredBy = authUser.username;

    writeJsonFileAtomic(STORE_ORDERS_FILE, orders);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: true, order: orders[idx], orders }));
    return;
  }

  if (reqUrl.startsWith('/api/store/orders/') && reqUrl.endsWith('/cancel') && req.method === 'PUT') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Debes iniciar sesion para cancelar un pedido y restaurar el stock.' }));
      return;
    }

    const orderId = decodeURIComponent(reqUrl.slice('/api/store/orders/'.length, -'/cancel'.length));
    const orders = readJsonFile(STORE_ORDERS_FILE, DEFAULT_STORE_ORDERS);
    const idx = orders.findIndex((o) => o.id === orderId || o.referenceCode === orderId);

    if (idx === -1) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Pedido o referencia no encontrada.' }));
      return;
    }

    if (orders[idx].status === 'CANCELADO') {
      res.statusCode = 409;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Este pedido ya se encuentra cancelado.' }));
      return;
    }

    if (orders[idx].status === 'ENTREGADO') {
      res.statusCode = 409;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'No se puede cancelar un pedido que ya fue cobrado y entregado.' }));
      return;
    }

    // Restaurar las unidades al inventario del producto
    const products = readJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
    const prodIdx = products.findIndex((p) => p.id === orders[idx].productId);
    if (prodIdx !== -1) {
      products[prodIdx].stock += Number(orders[idx].quantity) || 1;
      writeJsonFileAtomic(PRODUCTS_FILE, products);
    }

    orders[idx].status = 'CANCELADO';
    orders[idx].cancelledAt = new Date().toISOString();
    orders[idx].cancelledBy = authUser.username;

    writeJsonFileAtomic(STORE_ORDERS_FILE, orders);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: true, order: orders[idx], orders, products }));
    return;
  }

  // --------------------------------------------------------------------------
  // ARCHIVOS ESTATICOS CON AISLAMIENTO ESTRICTO DE CARPETAS Y SEGURIDAD
  // --------------------------------------------------------------------------
  if (reqUrl === '/' || reqUrl === '') {
    reqUrl = '/src/index.html';
  } else if (reqUrl.startsWith('/ui/')) {
    reqUrl = `/src${reqUrl}`;
  } else if (reqUrl === '/theme.css' || reqUrl === '/animations.css') {
    reqUrl = `/src/ui/styles${reqUrl}`;
  } else if (reqUrl === '/bundle.js') {
    reqUrl = '/src/bundle.js';
  } else if (reqUrl === '/logo_barberia_lopez_hd.jpg') {
    reqUrl = '/src/logo_barberia_lopez_hd.jpg';
  }

  const rawPath = path.join(ROOT_DIR, reqUrl);
  const safePath = path.normalize(rawPath);

  // Comprobar que no salga del ROOT_DIR y que cumpla la lista de rutas autorizadas
  if (!safePath.startsWith(ROOT_DIR) || !isPathSafeAndAllowed(safePath)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<h1>403 Prohibido</h1><p>Acceso denegado a recurso restringido o protegido.</p>');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<h1>404 No Encontrado</h1><p>El recurso solicitado no existe.</p>`);
      return;
    }

    let filePath = safePath;
    if (stats.isDirectory()) {
      filePath = path.join(safePath, 'index.html');
      if (!isPathSafeAndAllowed(filePath)) {
        res.statusCode = 403;
        res.end('Acceso denegado');
        return;
      }
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Error interno al leer el archivo solicitado');
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
  console.log(` Barberia Lopez - Servidor Seguro y Blindado`);
  console.log(`======================================================`);
  console.log(` Puerto activo:          http://localhost:${PORT}`);
  console.log(` Politica de Seguridad:  Autenticacion HMAC / Anti-XSS / Rate Limit`);
  console.log(` Directorio protegido:   Acceso restringido a data/ y backend`);
  console.log(`======================================================\n`);
});
