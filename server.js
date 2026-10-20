const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled rejection at:', promise, 'reason:', reason);
});

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

// Clave secreta para tokens de sesion HMAC-SHA256 deterministica (evita invalidar sesiones al reiniciar Render)
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.createHash('sha256').update('barberia_lopez_neiva_master_hmac_secret_2026').digest('hex');

// Claves y canales cifrados AES-256-GCM para respaldo continuo en la nube ante reinicios de Render
const CLOUD_VAULT_KEY = crypto.createHash('sha256').update(AUTH_SECRET + '_aes256_vault_key').digest();
const CLOUD_VAULT_ID = crypto.createHash('sha256').update(AUTH_SECRET + '_vault_channel_v1').digest('hex').substring(0, 20);
const CLOUD_CHANNEL_AUTH = `blopez_auth_${CLOUD_VAULT_ID}`;
const CLOUD_CHANNEL_OPS = `blopez_ops_${CLOUD_VAULT_ID}`;

function encryptVaultPayload(obj) {
  try {
    const iv = crypto.randomBytes(12);
    const compressed = zlib.deflateRawSync(Buffer.from(JSON.stringify(obj), 'utf8'));
    const cipher = crypto.createCipheriv('aes-256-gcm', CLOUD_VAULT_KEY, iv);
    const enc = Buffer.concat([cipher.update(compressed), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  } catch (err) {
    return null;
  }
}

function decryptVaultPayload(b64) {
  try {
    if (!b64 || typeof b64 !== 'string') return null;
    const raw = Buffer.from(b64.trim(), 'base64');
    if (raw.length < 29) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', CLOUD_VAULT_KEY, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    const jsonStr = zlib.inflateRawSync(dec).toString('utf8');
    return JSON.parse(jsonStr);
  } catch (err) {
    return null;
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
    id: '3c7e0bc2-c1f7-438c-8ef8-355fcf2f2b62',
    username: 'lopez.barber',
    passwordHash: 'lopez2026',
    role: 'JEFE',
    barberId: '87f4c9b4-5564-4964-8593-d02c8ee125ce',
    active: true
  },
  {
    id: '3fe4f419-2825-406e-8165-b6e944c083a0',
    username: 'matta.barber',
    passwordHash: 'matta2026',
    role: 'BARBERO',
    barberId: '3f8f88d7-6582-4607-9d9a-07275f8e618c',
    active: true
  }
];

const DEFAULT_BARBERS = [
  {
    id: '87f4c9b4-5564-4964-8593-d02c8ee125ce',
    userId: '3c7e0bc2-c1f7-438c-8ef8-355fcf2f2b62',
    name: 'David',
    specialty: 'Barbero Profesional',
    phone: '321 9897910',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    active: true
  },
  {
    id: '3f8f88d7-6582-4607-9d9a-07275f8e618c',
    userId: '3fe4f419-2825-406e-8165-b6e944c083a0',
    name: 'Maicol Matta',
    specialty: 'Barbero Profesional',
    phone: '3203181496',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
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

const DEFAULT_APPOINTMENTS = [];
const DEFAULT_HISTORY = [];

function readJsonFile(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      writeJsonFileAtomic(filePath, defaultValue, true);
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error leyendo ${filePath}:`, err.message);
    return defaultValue;
  }
}

let cloudAuthTimer = null;
let cloudOpsTimer = null;

async function pushCloudChannel(channel, payloadObj) {
  try {
    const encrypted = encryptVaultPayload(payloadObj);
    if (!encrypted || encrypted.length > 3900) return;
    await fetch(`https://ntfy.sh/${channel}`, {
      method: 'POST',
      body: encrypted
    });
  } catch (err) {}
}

function scheduleCloudBackup(filePath) {
  if (filePath === USERS_FILE || filePath === BARBERS_FILE) {
    if (cloudAuthTimer) clearTimeout(cloudAuthTimer);
    cloudAuthTimer = setTimeout(() => {
      const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
      const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
      pushCloudChannel(CLOUD_CHANNEL_AUTH, { ts: Date.now(), users, barbers });
    }, 150);
  } else if (filePath === APPOINTMENTS_FILE || filePath === HISTORY_FILE) {
    if (cloudOpsTimer) clearTimeout(cloudOpsTimer);
    cloudOpsTimer = setTimeout(() => {
      const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
      const history = readJsonFile(HISTORY_FILE, DEFAULT_HISTORY);
      pushCloudChannel(CLOUD_CHANNEL_OPS, { ts: Date.now(), appointments, history });
    }, 150);
  }
}

function writeJsonFileAtomic(filePath, data, skipCloudPush = false) {
  try {
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
    if (!skipCloudPush) {
      scheduleCloudBackup(filePath);
    }
    return true;
  } catch (err) {
    console.error(`Error escribiendo atomicamente en ${filePath}:`, err.message);
    return false;
  }
}

async function fetchLatestCloudSnapshot(channel) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(`https://ntfy.sh/${channel}/json?poll=1&since=12h`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const evt = JSON.parse(lines[i]);
        if (evt && evt.event === 'message' && evt.message) {
          const decoded = decryptVaultPayload(evt.message);
          if (decoded && decoded.ts) return decoded;
        }
      } catch (e) {}
    }
  } catch (err) {
    clearTimeout(timeout);
  }
  return null;
}

// Inicializar archivos locales si no existen
readJsonFile(USERS_FILE, DEFAULT_USERS);
readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
readJsonFile(SERVICES_FILE, DEFAULT_SERVICES);
readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
readJsonFile(HISTORY_FILE, DEFAULT_HISTORY);

// Restaurar instantanea cifrada desde la nube al arrancar (protege contra reinicios efimeros de Render)
const cloudVaultReadyPromise = (async () => {
  try {
    const [authSnap, opsSnap] = await Promise.all([
      fetchLatestCloudSnapshot(CLOUD_CHANNEL_AUTH),
      fetchLatestCloudSnapshot(CLOUD_CHANNEL_OPS)
    ]);

    if (authSnap && Array.isArray(authSnap.users) && authSnap.users.length > 0 && Array.isArray(authSnap.barbers)) {
      writeJsonFileAtomic(USERS_FILE, authSnap.users, true);
      writeJsonFileAtomic(BARBERS_FILE, authSnap.barbers, true);
    } else {
      pushCloudChannel(CLOUD_CHANNEL_AUTH, {
        ts: Date.now(),
        users: readJsonFile(USERS_FILE, DEFAULT_USERS),
        barbers: readJsonFile(BARBERS_FILE, DEFAULT_BARBERS)
      });
    }

    if (opsSnap && Array.isArray(opsSnap.appointments) && Array.isArray(opsSnap.history)) {
      writeJsonFileAtomic(APPOINTMENTS_FILE, opsSnap.appointments, true);
      writeJsonFileAtomic(HISTORY_FILE, opsSnap.history, true);
    } else {
      pushCloudChannel(CLOUD_CHANNEL_OPS, {
        ts: Date.now(),
        appointments: readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS),
        history: readJsonFile(HISTORY_FILE, DEFAULT_HISTORY)
      });
    }
  } catch (err) {}
})();

// Keep-Alive automatico cada 8 minutos para mantener Render activo y refrescar respaldo cifrado
setInterval(() => {
  const targetUrl = process.env.RENDER_EXTERNAL_URL || 'https://barberia-lopez.onrender.com';
  fetch(`${targetUrl}/api/health`).catch(() => {});
}, 8 * 60 * 1000);

setInterval(() => {
  pushCloudChannel(CLOUD_CHANNEL_AUTH, {
    ts: Date.now(),
    users: readJsonFile(USERS_FILE, DEFAULT_USERS),
    barbers: readJsonFile(BARBERS_FILE, DEFAULT_BARBERS)
  });
  pushCloudChannel(CLOUD_CHANNEL_OPS, {
    ts: Date.now(),
    appointments: readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS),
    history: readJsonFile(HISTORY_FILE, DEFAULT_HISTORY)
  });
}, 3 * 60 * 60 * 1000);

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

function generateUuid() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateSessionToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    username: user.username,
    role: user.role,
    barberId: user.barberId,
    exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 365 dias de validez para persistencia de boveda
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
  const maxAttempts = 50;
  const record = ipAuthAttempts.get(ip);
  if (record && now <= record.resetTime && record.count >= maxAttempts) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
    res.end(JSON.stringify({ error: 'Demasiados intentos fallidos de autenticacion. Intenta de nuevo en unos minutos.' }));
    return false;
  }
  return true;
}

function recordFailedAuthAttempt(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutos
  let record = ipAuthAttempts.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
  } else {
    record.count++;
  }
  ipAuthAttempts.set(ip, record);
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
            if (newAppt.id && a.id === newAppt.id) return false;
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
    const b = barbersMap.get(appt.barberId) || { name: 'Barbero' };
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

  if (reqUrl === '/api/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ status: 'ok', ts: Date.now() }));
    return;
  }

  if (reqUrl.startsWith('/api/')) {
    await cloudVaultReadyPromise;
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
        recordFailedAuthAttempt(req);
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Credenciales invalidas o usuario inactivo.' }));
        return;
      }

      const isValid = verifyPasswordSecure(String(password).trim(), targetUser.passwordHash) ||
                      verifyPasswordSecure(String(password), targetUser.passwordHash);
      if (!isValid) {
        recordFailedAuthAttempt(req);
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Credenciales invalidas.' }));
        return;
      }

      // Login exitoso: limpiar contador de intentos fallidos para esta IP
      ipAuthAttempts.delete(getClientIp(req));

      // Migracion automatica transparente a scrypt seguro si aun esta en texto plano
      if (!targetUser.passwordHash.startsWith('scrypt:')) {
        targetUser.passwordHash = hashPasswordScrypt(String(password).trim());
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
        const current = appointments[idx];
        const dateChanged = updateData.date && updateData.date !== current.date;
        const timeChanged = (updateData.startTime && updateData.startTime !== current.startTime) ||
                            (updateData.endTime && updateData.endTime !== current.endTime);
        const barberChanged = updateData.barberId && updateData.barberId !== current.barberId;
        const updated = { ...current, ...updateData, id: apptId };
        if (dateChanged || timeChanged || barberChanged) {
          const saved = await validateAndSaveAppointment(updated);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, appointment: saved }));
        } else {
          appointments[idx] = updated;
          writeJsonFileAtomic(APPOINTMENTS_FILE, appointments);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, appointment: updated }));
        }
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

  // Eliminar o cancelar cita (DELETE /api/appointments/:id)
  if (reqUrl.startsWith('/api/appointments/') && req.method === 'DELETE') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Debes iniciar sesion para gestionar o eliminar citas.' }));
      return;
    }

    const apptId = reqUrl.substring('/api/appointments/'.length);
    const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
    const filtered = appointments.filter((a) => a.id !== apptId);
    writeJsonFileAtomic(APPOINTMENTS_FILE, filtered);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: true, message: 'Turno eliminado correctamente.' }));
    return;
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

      if (Array.isArray(payload.history)) {
        const storedHistory = readJsonFile(HISTORY_FILE, DEFAULT_HISTORY);
        const histMap = new Map();
        storedHistory.forEach((h) => histMap.set(h.id || h.appointmentId, h));
        payload.history.forEach((h) => {
          const key = h.id || h.appointmentId;
          if (key && !histMap.has(key)) {
            histMap.set(key, h);
          }
        });
        writeJsonFileAtomic(HISTORY_FILE, Array.from(histMap.values()));
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
      const barberId = barberData.id || generateUuid();
      const userId = userData.id || generateUuid();

      const newBarber = {
        id: barberId,
        userId: userId,
        name: String(barberData.name || 'Barbero').trim(),
        specialty: String(barberData.specialty || 'Barbero Profesional').trim(),
        phone: String(barberData.phone || '+57 321 989 7910').trim(),
        avatar: barberData.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
        active: barberData.active !== false
      };

      const passwordHash = hashPasswordScrypt(String(userData.password).trim());
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

      // Desbloquear cualquier limite de intentos de autenticacion al crear barbero
      ipAuthAttempts.clear();

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

    const barberId = decodeURIComponent(reqUrl.substring('/api/barbers/'.length));
    const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
    const filtered = barbers.filter((b) => b.id !== barberId);
    writeJsonFileAtomic(BARBERS_FILE, filtered);

    const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
    const filteredUsers = users.filter((u) => u.role === 'ADMIN' || u.barberId !== barberId);
    writeJsonFileAtomic(USERS_FILE, filteredUsers);

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

        const rawPassword = String(newUser.passwordHash || newUser.password || 'Lopez2026*').trim();
        newUser.passwordHash = rawPassword.startsWith('scrypt:') ? rawPassword : hashPasswordScrypt(rawPassword);
        delete newUser.password;

        const cleanUsername = String(newUser.username).replace(/^@/, '').toLowerCase().trim();
        newUser.username = cleanUsername;
        if (!newUser.id) {
          newUser.id = generateUuid();
        }

        const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
        const existingIdx = users.findIndex((u) =>
          u.id === newUser.id ||
          (u.username || '').replace(/^@/, '').toLowerCase().trim() === cleanUsername
        );
        if (existingIdx !== -1) {
          users[existingIdx] = { ...users[existingIdx], ...newUser };
        } else {
          users.push(newUser);
        }
        writeJsonFileAtomic(USERS_FILE, users);

        ipAuthAttempts.clear();

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
    const userId = decodeURIComponent(reqUrl.substring('/api/users/'.length));

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
      const cleanIdOrUser = String(userId).replace(/^@/, '').toLowerCase().trim();
      const cleanBodyUser = updateData.username ? String(updateData.username).replace(/^@/, '').toLowerCase().trim() : '';

      let idx = users.findIndex((u) =>
        u.id === userId ||
        (u.username || '').replace(/^@/, '').toLowerCase().trim() === cleanIdOrUser ||
        (cleanBodyUser && (u.username || '').replace(/^@/, '').toLowerCase().trim() === cleanBodyUser)
      );

      // Si el usuario se desincronizo tras un reinicio de servidor pero un ADMIN o JEFE lo esta actualizando, reconstruirlo
      if (idx === -1 && (authUser.role === 'ADMIN' || authUser.role === 'JEFE') && (updateData.password || updateData.passwordHash)) {
        const rawPwd = String(updateData.password || updateData.passwordHash).trim();
        const recoveredUser = {
          id: userId,
          username: cleanBodyUser || cleanIdOrUser,
          passwordHash: rawPwd.startsWith('scrypt:') ? rawPwd : hashPasswordScrypt(rawPwd),
          role: updateData.role || 'BARBERO',
          barberId: updateData.barberId || null,
          active: updateData.active !== false,
          createdAt: new Date().toISOString()
        };
        users.push(recoveredUser);
        idx = users.length - 1;
      }

      if (idx !== -1) {
        if (authUser.role !== 'ADMIN') {
          if (users[idx].role === 'ADMIN') {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'No tiene permisos para modificar al Administrador.' }));
            return;
          }
          delete updateData.role;
        }

        if (updateData.passwordHash && !updateData.passwordHash.startsWith('scrypt:')) {
          updateData.passwordHash = hashPasswordScrypt(String(updateData.passwordHash).trim());
        }
        if (updateData.password) {
          const cleanPwd = String(updateData.password).trim();
          updateData.passwordHash = cleanPwd.startsWith('scrypt:') ? cleanPwd : hashPasswordScrypt(cleanPwd);
          delete updateData.password;
        }

        users[idx] = { ...users[idx], ...updateData };
        writeJsonFileAtomic(USERS_FILE, users);

        // Desbloquear posibles limites de intentos tras cambio de contrasena
        ipAuthAttempts.clear();

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

    const userId = decodeURIComponent(reqUrl.substring('/api/users/'.length));
    const cleanIdOrUser = String(userId).replace(/^@/, '').toLowerCase().trim();
    const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
    const target = users.find((u) =>
      u.id === userId ||
      (u.username || '').replace(/^@/, '').toLowerCase().trim() === cleanIdOrUser
    );
    if (target && target.role === 'ADMIN') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'No se permite eliminar al usuario Administrador.' }));
      return;
    }

    const filtered = users.filter((u) =>
      u.id !== userId &&
      (u.username || '').replace(/^@/, '').toLowerCase().trim() !== cleanIdOrUser
    );
    writeJsonFileAtomic(USERS_FILE, filtered);

    if (target && target.barberId) {
      const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
      const filteredBarbers = barbers.filter((b) => b.id !== target.barberId);
      writeJsonFileAtomic(BARBERS_FILE, filteredBarbers);
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --------------------------------------------------------------------------
  // API DE HISTORIAL: GET (AUTENTICADO) / POST (AUTENTICADO) / DELETE (ADMIN O JEFE)
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
        if (newRecord.appointmentId) {
          const existing = history.find((h) => h.appointmentId === newRecord.appointmentId);
          if (existing) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, record: existing, duplicatePrevented: true }));
            return;
          }
        }
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

  if (reqUrl.startsWith('/api/history/') && req.method === 'DELETE') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'JEFE')) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Acceso denegado: se requieren permisos administrativos para eliminar del historial.' }));
      return;
    }

    const historyId = reqUrl.substring('/api/history/'.length);
    const history = readJsonFile(HISTORY_FILE, DEFAULT_HISTORY);
    const filtered = history.filter((h) => h.id !== historyId);
    writeJsonFileAtomic(HISTORY_FILE, filtered);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: true, message: 'Registro de corte eliminado del historial.' }));
    return;
  }

  // --------------------------------------------------------------------------
  // API DE CONTROL: VACIAR CITAS E HISTORIAL DE PRUEBA
  // --------------------------------------------------------------------------
  if (reqUrl === '/api/control/clear-tests' && req.method === 'POST') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'JEFE')) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Acceso denegado: se requieren privilegios administrativos.' }));
      return;
    }

    writeJsonFileAtomic(APPOINTMENTS_FILE, []);
    writeJsonFileAtomic(HISTORY_FILE, []);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      success: true,
      message: 'Historial de control y citas de prueba eliminadas correctamente del servidor.',
      appointments: [],
      history: []
    }));
    return;
  }

  if (reqUrl === '/api/services' && req.method === 'GET') {
    const services = readJsonFile(SERVICES_FILE, DEFAULT_SERVICES);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(services));
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
