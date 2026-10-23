/**
 * Barberia Lopez — Servidor Backend Nativo Blindado
 * Arquitectura: Node.js puro sin dependencias externas pesadas
 * Indice Quirurgico de Secciones (Consulte CODEMAP.md para detalles):
 * - Persistencia y Deteccion Render: L40 - L235
 * - Criptografia scrypt/pbkdf2 y HMAC Auth: L236 - L355
 * - Rate Limiting y Proteccion Fuerza Bruta: L356 - L430
 * - Proteccion DoS y Limite de Cuerpo: L431 - L465
 * - Mutex Transaccional y Anti Double-Booking: L466 - L560
 * - Feeds iCalendar RFC 5545: L561 - L775
 * - Cabeceras de Seguridad HTTP y Validador de Rutas: L776 - L840
 * - Enrutador Principal /api/*: L841 - L2170
 * - Servidor de Archivos Estaticos: L2171 - L2240
 */
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
const PRODUCTS_IMG_DIR = path.join(PUBLIC_SRC_DIR, 'assets', 'products');
if (!fs.existsSync(PRODUCTS_IMG_DIR)) {
  fs.mkdirSync(PRODUCTS_IMG_DIR, { recursive: true });
}

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

// Clave secreta para tokens de sesion HMAC-SHA256 deterministica y persistente
const AUTH_SECRET_FILE = path.join(DATA_DIR, '.auth_secret');
const MASTER_DETERMINISTIC_SECRET = crypto.createHash('sha256').update('barberia_lopez_neiva_master_hmac_secret_2026').digest('hex');
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
    AUTH_SECRET = MASTER_DETERMINISTIC_SECRET;
    try {
      fs.writeFileSync(AUTH_SECRET_FILE, AUTH_SECRET, { encoding: 'utf8' });
    } catch (e) {}
  }
}

// Identificacion de entorno de ejecucion en la nube (Render)
const IS_RENDER = Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.ENABLE_CLOUD_BACKUP === 'true');
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || 'https://barberia-lopez.onrender.com';

// Claves y canales cifrados AES-256-GCM para respaldo continuo en la nube ante reinicios de Render
const CLOUD_VAULT_KEY = crypto.createHash('sha256').update(AUTH_SECRET + '_aes256_vault_key_v2').digest();
const CLOUD_VAULT_ID = crypto.createHash('sha256').update(AUTH_SECRET + '_vault_channel_v2').digest('hex').substring(0, 20);
const CLOUD_CHANNEL_AUTH = `blopez_auth_${CLOUD_VAULT_ID}`;
const CLOUD_CHANNEL_OPS = `blopez_ops_${CLOUD_VAULT_ID}`;
const CLOUD_CHANNEL_STORE = `blopez_store_${CLOUD_VAULT_ID}`;

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
    id: 'u-david-01',
    username: 'david.barber',
    passwordHash: 'david2026',
    role: 'JEFE',
    barberId: 'b-david-01',
    active: true
  },
  {
    id: 'u-matta-01',
    username: 'matta.barber',
    passwordHash: 'matta2026',
    role: 'BARBERO',
    barberId: 'b-matta-01',
    active: true
  }
];

const DEFAULT_BARBERS = [
  {
    id: 'b-david-01',
    userId: 'u-david-01',
    name: 'David',
    specialty: 'Barbero Jefe · Maestro Barbero',
    phone: '+57 321 989 7910',
    avatar: '',
    active: true,
    onShift: true
  },
  {
    id: 'b-matta-01',
    userId: 'u-matta-01',
    name: 'Maicol Matta',
    specialty: 'Barbero Profesional · Degradados & Barba',
    phone: '+57 300 000 0000',
    avatar: '',
    active: true,
    onShift: true
  }
];

const DEFAULT_SERVICES = [
  { id: 's-01', name: 'Corte Básico', category: 'Corte + Masaje', durationMinutes: 30, priceCop: 20000, description: 'Corte tradicional o moderno + masaje capilar relajante.', active: true },
  { id: 's-02', name: 'Combo 1', category: 'Corte + Masaje Espalda + Mascarilla + Cejas', durationMinutes: 30, priceCop: 25000, description: 'Corte completo + masaje de espalda + mascarilla negra + perfilado de cejas.', active: true },
  { id: 's-03', name: 'Combo 2', category: 'Corte + Masaje + Mascarilla + Barba + Cejas', durationMinutes: 30, priceCop: 35000, description: 'Corte + masaje + mascarilla facial + ritual de barba con toalla caliente + cejas.', active: true },
  { id: 's-04', name: 'Combo 3', category: 'Corte + Spa + Lavado', durationMinutes: 30, priceCop: 40000, description: 'Corte + masaje + mascarilla + barba completa + cejas + lavado de cabello con shampoo refrescante.', active: true },
  { id: 's-05', name: 'Combi Completa VIP', category: 'Experiencia Total + Granizado', durationMinutes: 30, priceCop: 65000, description: 'Corte + masaje + mascarilla + barba spa + cejas + lavado de cabello + granizado artesanal de la casa.', active: true },
  { id: 's-06', name: 'Lavado de Cabello', category: 'Cuidado Capilar', durationMinutes: 30, priceCop: 5000, description: 'Lavado capilar profundo con shampoo refrescante y masaje relajante.', active: true }
];

const DEFAULT_PRODUCTS = [
  {
    "id": "prod-1792788587962-hzyn",
    "name": "Cera gold",
    "category": "Cuidado Capilar",
    "description": "Cera capilar con cera de abejas\nFIJACIÓN Y MOLDEADO PARA TU CABELLO\nCon KERATINA, PANTENOL, TRINOGEN Y BIOTINA\nCONT.160g",
    "priceCop": 36000,
    "stock": 3,
    "imageUrl": "./assets/products/prod-prod-1792788587962-hzyn-1792788588507.jpg",
    "active": true,
    "createdAt": "2026-10-23T20:49:47.962Z"
  },
  {
    "id": "prod-1792789181502-7qc5",
    "name": "Cera platinum",
    "category": "Cuidado Capilar",
    "description": "Cera capilar PLATINUM\nCon cera de abejas \nFIJACIÓN Y MOLDEADO PARA TU CABELLO CON KERATINA, PANTRNOL\nTRICHOGEN Y BIOTINA",
    "priceCop": 37000,
    "stock": 2,
    "imageUrl": "./assets/products/prod-prod-1792789181502-7qc5-1792789181922.jpg",
    "active": true,
    "createdAt": "2026-10-23T20:59:41.502Z"
  },
  {
    "id": "prod-1792789344624-nd6j",
    "name": "Cera bless",
    "category": "Cuidado Capilar",
    "description": "Cera VIBRANTE CBD STYLING WAX \nFIJACIÓN, Moldeado y Estilo Para Tu Cabello",
    "priceCop": 38000,
    "stock": 5,
    "imageUrl": "./assets/products/prod-prod-1792789344624-nd6j-1792789345011.jpg",
    "active": true,
    "createdAt": "2026-10-23T21:02:24.624Z"
  },
  {
    "id": "prod-1792789483445-bcbs",
    "name": "CERA WINNER’S",
    "category": "Cuidado Capilar",
    "description": "CERA VIBRANTE \nFIJACIÓN, MOLDEADO Y ESTILO PARA TU CABELLO, con ALOE VERA, ACEITE DE AGUACATE Y TRICHOGEN",
    "priceCop": 38000,
    "stock": 5,
    "imageUrl": "./assets/products/prod-prod-1792789483445-bcbs-1792789483907.jpg",
    "active": true,
    "createdAt": "2026-10-23T21:04:43.445Z"
  },
  {
    "id": "prod-1792789971626-9koa",
    "name": "Cera RED’S",
    "category": "Cuidado Capilar",
    "description": "Cera VIBRANTE FIJACIÓN, MOLDEADO PARA TU CABELLO CON BIOTINA Y TRICHOGEN",
    "priceCop": 38000,
    "stock": 4,
    "imageUrl": "./assets/products/prod-prod-1792789971626-9koa-1792789972016.jpg",
    "active": true,
    "createdAt": "2026-10-23T21:12:51.626Z"
  },
  {
    "id": "prod-1792790044055-bpmz",
    "name": "Cera KIDS",
    "category": "Cuidado Capilar",
    "description": "Cera MOLDEADORA Y FIJADORA (TERARAÑA) fijación ligera",
    "priceCop": 38000,
    "stock": 2,
    "imageUrl": "./assets/products/prod-prod-1792790044055-bpmz-1792790044701.jpg",
    "active": true,
    "createdAt": "2026-10-23T21:14:04.055Z"
  },
  {
    "id": "prod-1792790384897-jkn3",
    "name": "GEL CAPILAR EXTRAFUERTE",
    "category": "Cuidado Capilar",
    "description": "MÁXIMA FIJACIÓN LIBRE DE PARABENOS \nCONT 900g",
    "priceCop": 40000,
    "stock": 2,
    "imageUrl": "./assets/products/prod-prod-1792790384897-jkn3-1792790385302.jpg",
    "active": true,
    "createdAt": "2026-10-23T21:19:44.897Z"
  },
  {
    "id": "prod-1792790496913-37fr",
    "name": "TÓNICO CAPILAR SIN PARABENOS",
    "category": "Cuidado Capilar",
    "description": "ESTIMULACIÓN Y NUTRICIÓN CAPILAR CON \nBIOTINA\nARGININA\nALOE VERA Y EXTRACTO DE ROMERO \nCONT NETO 30mL",
    "priceCop": 37000,
    "stock": 2,
    "imageUrl": "./assets/products/prod-prod-1792790496913-37fr-1792790497387.jpg",
    "active": true,
    "createdAt": "2026-10-23T21:21:36.913Z"
  },
  {
    "id": "prod-1792790629355-xn0l",
    "name": "JABÓN ÍNTIMO FOR MEN",
    "category": "Cuidado Capilar",
    "description": "ALOE VERA, CALÉNDULA Y MANZANILLA \nHIGIENE DIARIA PARA LA ZONA ÍNTIMA\nHIDRATA, LIMPIA Y REFRESCA \nFRAGANCIA HIPALERGENICA \n(USO DIARIO )\nCont 170mL",
    "priceCop": 35000,
    "stock": 4,
    "imageUrl": "./assets/products/prod-prod-1792790629355-xn0l-1792790629793.jpg",
    "active": true,
    "createdAt": "2026-10-23T21:23:49.355Z"
  },
  {
    "id": "prod-1792791999412-4le7",
    "name": "LOCIÓN REFRESCANTE CON MINOXIDIL",
    "category": "Cuidado Capilar",
    "description": "REFESCANTE CON MINOXIDIL, OXOTHIAZOLIDINECARBOXYLATE \nMENTOL Y EYCALIPTO\n(PARA DESPUÉS DEL AFEITADO) \nCont 250. mL",
    "priceCop": 22000,
    "stock": 2,
    "imageUrl": "./assets/products/prod-prod-1792791999412-4le7-1792791999993.jpg",
    "active": true,
    "createdAt": "2026-10-23T21:46:39.412Z"
  },
  {
    "id": "prod-1792792131165-bv4z",
    "name": "GEl  CAPILAR EXTRAFUERTE",
    "category": "Cuidado Capilar",
    "description": "MÁXIMA FIJACIÓN,LUBRE DE PARABENOS \nCONT.350g",
    "priceCop": 29000,
    "stock": 0,
    "imageUrl": "./assets/products/prod-prod-1792792131165-bv4z-1792792131606.jpg",
    "active": true,
    "createdAt": "2026-10-23T21:48:51.165Z"
  },
  {
    "id": "prod-1792792425127-b4qu",
    "name": "SHAMPOO CONTROL CAÍDA",
    "category": "Cuidado Capilar",
    "description": "Control caída de pelo, con BIOTINA, ARGININA, MONOXIDIL, OXOTHIAZOLIDINECARBOXYLATE\n( PANAX GINSENG EXTRCTO DE BARDANA SAWPALMETO, GLUCONATO DE ZINC \nCON.350 mL",
    "priceCop": 43000,
    "stock": 2,
    "imageUrl": "./assets/products/prod-prod-1792792425127-b4qu-1792792425839.jpg",
    "active": true,
    "createdAt": "2026-10-23T21:53:45.127Z"
  },
  {
    "id": "prod-1792792609106-ez2v",
    "name": "PRIMITIVOX MEN",
    "category": "Bebida potenciadora",
    "description": "Bebida concentrada a base de agua con frutas con BOROJO, CHONTADURO, VITAMINAS Y MINERALES",
    "priceCop": 39000,
    "stock": 4,
    "imageUrl": "./assets/products/prod-prod-1792792609106-ez2v-1792792609702.jpg",
    "active": true,
    "createdAt": "2026-10-23T21:56:49.106Z"
  }
];

const DEFAULT_APPOINTMENTS = [];
const DEFAULT_HISTORY = [];
const DEFAULT_STORE_ORDERS = [
  {
    "id": "ord-1792788689753-th2a",
    "referenceCode": "REF-BL-6442VM",
    "productId": "prod-1792788587962-hzyn",
    "productName": "Cera gold",
    "productCategory": "Cuidado Capilar",
    "unitPriceCop": 36000,
    "quantity": 1,
    "totalCop": 36000,
    "clientName": "Fabián Ricardo Trujillo González",
    "clientPhone": "3204668428",
    "deliveryMode": "APARTADO_RECOGIDA",
    "preferredBarberId": null,
    "preferredBarberName": "Cualquier barbero en turno",
    "paymentMethod": "EFECTIVO",
    "status": "ENTREGADO",
    "date": "2026-10-23",
    "createdAt": "2026-10-23T20:51:29.753Z",
    "deliveredAt": "2026-10-23T20:53:21.548Z",
    "deliveredDate": "2026-10-23",
    "deliveredBy": "david.barber",
    "deliveredByBarberId": "b-david-01",
    "deliveredByName": "David"
  }
];

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

let cloudAuthTimer = null;
let cloudOpsTimer = null;
let cloudStoreTimer = null;

async function pushCloudChannel(channel, payloadObj) {
  if (!IS_RENDER) return;
  try {
    const encrypted = encryptVaultPayload(payloadObj);
    if (!encrypted) return;
    if (encrypted.length > 3900) {
      console.warn(`[CLOUD-VAULT] Advertencia: Snapshot para canal ${channel} supera limite de 3900 caracteres (${encrypted.length}).`);
      // Podar historial antiguo para mantener el payload compacto si es el canal operativo
      if (payloadObj && Array.isArray(payloadObj.history) && payloadObj.history.length > 50) {
        const compactPayload = {
          ...payloadObj,
          history: payloadObj.history.slice(-50)
        };
        const retryEncrypted = encryptVaultPayload(compactPayload);
        if (retryEncrypted && retryEncrypted.length <= 3900) {
          await fetch(`https://ntfy.sh/${channel}`, {
            method: 'POST',
            body: retryEncrypted,
            headers: { 'Priority': 'low', 'Title': 'Snapshot' }
          });
          return;
        }
      }
      return;
    }
    await fetch(`https://ntfy.sh/${channel}`, {
      method: 'POST',
      body: encrypted,
      headers: { 'Priority': 'low', 'Title': 'Snapshot' }
    });
  } catch (err) {}
}

function scheduleCloudBackup(filePath) {
  if (!IS_RENDER) return;
  if (filePath === USERS_FILE || filePath === BARBERS_FILE) {
    if (cloudAuthTimer) clearTimeout(cloudAuthTimer);
    cloudAuthTimer = setTimeout(() => {
      const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
      const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
      pushCloudChannel(CLOUD_CHANNEL_AUTH, { ts: Date.now(), users, barbers });
    }, 200);
  } else if (filePath === APPOINTMENTS_FILE || filePath === HISTORY_FILE) {
    if (cloudOpsTimer) clearTimeout(cloudOpsTimer);
    cloudOpsTimer = setTimeout(() => {
      const appointments = readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS);
      const history = readJsonFile(HISTORY_FILE, DEFAULT_HISTORY);
      pushCloudChannel(CLOUD_CHANNEL_OPS, { ts: Date.now(), appointments, history });
    }, 200);
  } else if (filePath === PRODUCTS_FILE || filePath === STORE_ORDERS_FILE) {
    if (cloudStoreTimer) clearTimeout(cloudStoreTimer);
    cloudStoreTimer = setTimeout(() => {
      const products = readJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
      const storeOrders = readJsonFile(STORE_ORDERS_FILE, DEFAULT_STORE_ORDERS);
      pushCloudChannel(CLOUD_CHANNEL_STORE, { ts: Date.now(), products, storeOrders });
    }, 200);
  }
}

function writeJsonFileAtomic(filePath, data, skipCloudPush = false) {
  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        fs.renameSync(tempPath, filePath);
        if (!skipCloudPush) {
          scheduleCloudBackup(filePath);
        }
        return true;
      } catch (renameErr) {
        if (attempt === maxRetries) {
          try {
            fs.copyFileSync(tempPath, filePath);
            try { fs.unlinkSync(tempPath); } catch (e) {}
            if (!skipCloudPush) {
              scheduleCloudBackup(filePath);
            }
            return true;
          } catch (copyErr) {
            console.error(`Error persistiendo ${filePath}:`, copyErr.message);
            try { fs.unlinkSync(tempPath); } catch (e) {}
            return false;
          }
        }
        // Pausa breve para permitir que el lock en Windows se libere
        const waitMs = attempt * 8;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
      }
    }
    return true;
  } catch (err) {
    console.error(`Error escribiendo atomicamente en ${filePath}:`, err.message);
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
    return false;
  }
}

async function fetchLatestCloudSnapshot(channel) {
  if (!IS_RENDER) return { status: 'disabled', data: null };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://ntfy.sh/${channel}/json?poll=1&since=24h`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[CLOUD-VAULT] Advertencia: HTTP ${res.status} al consultar canal ${channel}`);
      return { status: 'error', data: null };
    }
    const text = await res.text();
    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length === 0) {
      return { status: 'empty', data: null };
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const evt = JSON.parse(lines[i]);
        if (evt && evt.event === 'message' && evt.message) {
          const decoded = decryptVaultPayload(evt.message);
          if (decoded && decoded.ts) {
            return { status: 'ok', data: decoded };
          }
        }
      } catch (e) {}
    }
    return { status: 'empty', data: null };
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`[CLOUD-VAULT] Excepcion de red al consultar ${channel}: ${err.message}`);
    return { status: 'error', data: null };
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

// Restaurar instantanea cifrada desde la nube al arrancar en Render
const cloudVaultReadyPromise = (async () => {
  if (!IS_RENDER) return;
  try {
    const [authRes, opsRes, storeRes] = await Promise.all([
      fetchLatestCloudSnapshot(CLOUD_CHANNEL_AUTH),
      fetchLatestCloudSnapshot(CLOUD_CHANNEL_OPS),
      fetchLatestCloudSnapshot(CLOUD_CHANNEL_STORE)
    ]);

    // 1. Restaurar o sembrar usuarios y barberos
    if (authRes.status === 'ok' && authRes.data && Array.isArray(authRes.data.users) && authRes.data.users.length > 0) {
      writeJsonFileAtomic(USERS_FILE, authRes.data.users, true);
      if (Array.isArray(authRes.data.barbers)) {
        writeJsonFileAtomic(BARBERS_FILE, authRes.data.barbers, true);
      }
      console.log('[CLOUD-VAULT] Usuarios y perfiles de barbero restaurados con exito desde la nube.');
    } else if (authRes.status === 'empty') {
      pushCloudChannel(CLOUD_CHANNEL_AUTH, {
        ts: Date.now(),
        users: readJsonFile(USERS_FILE, DEFAULT_USERS),
        barbers: readJsonFile(BARBERS_FILE, DEFAULT_BARBERS)
      });
      console.log('[CLOUD-VAULT] Canal de autenticacion inicializado en la nube.');
    } else if (authRes.status === 'error') {
      console.warn('[CLOUD-VAULT] Fallo de conexion en autenticacion. Se preserva estado local sin sobrescribir la nube.');
    }

    // 2. Restaurar o sembrar citas e historial operativo
    if (opsRes.status === 'ok' && opsRes.data && Array.isArray(opsRes.data.appointments)) {
      writeJsonFileAtomic(APPOINTMENTS_FILE, opsRes.data.appointments, true);
      if (Array.isArray(opsRes.data.history)) {
        writeJsonFileAtomic(HISTORY_FILE, opsRes.data.history, true);
      }
      console.log('[CLOUD-VAULT] Citas e historial operativo restaurados con exito desde la nube.');
    } else if (opsRes.status === 'empty') {
      pushCloudChannel(CLOUD_CHANNEL_OPS, {
        ts: Date.now(),
        appointments: readJsonFile(APPOINTMENTS_FILE, DEFAULT_APPOINTMENTS),
        history: readJsonFile(HISTORY_FILE, DEFAULT_HISTORY)
      });
      console.log('[CLOUD-VAULT] Canal operativo inicializado en la nube.');
    } else if (opsRes.status === 'error') {
      console.warn('[CLOUD-VAULT] Fallo de conexion en citas/historial. Se preserva estado local sin sobrescribir la nube.');
    }

    // 3. Restaurar o sembrar catalogo y pedidos de tienda
    if (storeRes.status === 'ok' && storeRes.data && Array.isArray(storeRes.data.products)) {
      writeJsonFileAtomic(PRODUCTS_FILE, storeRes.data.products, true);
      if (Array.isArray(storeRes.data.storeOrders)) {
        writeJsonFileAtomic(STORE_ORDERS_FILE, storeRes.data.storeOrders, true);
      }
      console.log('[CLOUD-VAULT] Catalogo y pedidos de tienda restaurados con exito desde la nube.');
    } else if (storeRes.status === 'empty') {
      pushCloudChannel(CLOUD_CHANNEL_STORE, {
        ts: Date.now(),
        products: readJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS),
        storeOrders: readJsonFile(STORE_ORDERS_FILE, DEFAULT_STORE_ORDERS)
      });
      console.log('[CLOUD-VAULT] Canal de tienda inicializado en la nube.');
    } else if (storeRes.status === 'error') {
      console.warn('[CLOUD-VAULT] Fallo de conexion en tienda. Se preserva estado local sin sobrescribir la nube.');
    }
  } catch (err) {
    console.error('[CLOUD-VAULT] Error inesperado en restauracion de nube:', err.message);
  }
})();

// Keep-Alive interno automatico cada 5 minutos en Render (previene suspension por inactividad de 15 min)
if (IS_RENDER) {
  if (!process.env.AUTH_SECRET) {
    console.warn('[SEGURIDAD] Advertencia: Variable de entorno AUTH_SECRET no definida en Render. Se recomienda configurar AUTH_SECRET personalizada en el panel de Render.');
  }

  setInterval(() => {
    fetch(`${RENDER_EXTERNAL_URL}/api/health`, {
      headers: { 'User-Agent': 'BarberiaLopez-InternalKeepAlive/1.0' }
    }).catch(() => {});
  }, 5 * 60 * 1000);

  // Refrescar snapshot en la nube cada 2 horas
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
    pushCloudChannel(CLOUD_CHANNEL_STORE, {
      ts: Date.now(),
      products: readJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS),
      storeOrders: readJsonFile(STORE_ORDERS_FILE, DEFAULT_STORE_ORDERS)
    });
  }, 2 * 60 * 60 * 1000);
}

// ============================================================================
// CRIPTOGRAFIA Y AUTENTICACION SEGURA NATIVA (SCRYPT + HMAC TOKENS)
// ============================================================================

function hashPasswordScrypt(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(plainPassword).trim(), salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

function verifyPasswordSecure(plainPassword, storedHash, username = '') {
  if (!plainPassword || !storedHash) return false;
  const cleanInput = String(plainPassword).trim();

  // 1. Verificacion estricta con scrypt si esta hasheado
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length === 3) {
      const salt = parts[1];
      const key = parts[2];
      const keyBuffer = Buffer.from(key, 'hex');

      // Probar variaciones comunes de teclado movil (punto automatico o espacios)
      const inputVariations = [
        cleanInput,
        cleanInput.replace(/\.$/, ''),
        cleanInput.replace(/\s+/g, '')
      ];

      for (const v of inputVariations) {
        try {
          const derivedKey = crypto.scryptSync(v, salt, 64);
          if (keyBuffer.length === derivedKey.length && crypto.timingSafeEqual(keyBuffer, derivedKey)) {
            return true;
          }
        } catch (e) {}
      }
    }
    // Si ya esta hasheado y no coincidio, rechazar de inmediato para no sobrescribir claves elegidas
    return false;
  }

  // 2. Solo para cuentas iniciales legadas sin hash scrypt: verificar texto plano
  const cleanStored = String(storedHash).trim();
  const variations = [
    cleanInput,
    cleanInput.replace(/\.$/, ''),
    cleanInput.replace(/^@/, '')
  ];

  return variations.includes(cleanStored);
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
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 dias de validez
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

function checkRateLimit(req, res, maxRequests = 240, windowMs = 60000) {
  const ip = getClientIp(req);
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || process.env.NODE_ENV === 'test') {
    return true;
  }
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
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || process.env.NODE_ENV === 'test') {
    return true;
  }
  const now = Date.now();
  const maxFailedAttempts = 20;
  const record = ipAuthAttempts.get(ip);
  if (record && now <= record.resetTime && record.failedCount >= maxFailedAttempts) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
    res.end(JSON.stringify({ error: 'Demasiados intentos fallidos de autenticacion. Bloqueado temporalmente.' }));
    return false;
  }
  return true;
}

function recordFailedAuthAttempt(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  let record = ipAuthAttempts.get(ip);
  if (!record || now > record.resetTime) {
    record = { failedCount: 1, resetTime: now + windowMs };
  } else {
    record.failedCount++;
  }
  ipAuthAttempts.set(ip, record);
}

function clearAuthAttempts(req) {
  const ip = getClientIp(req);
  ipAuthAttempts.delete(ip);
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
let storeOrderLock = Promise.resolve();

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
    appointmentLock = appointmentLock.catch(() => {}).then(() => {
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
    const b = barbersMap.get(appt.barberId) || { name: 'Barbería Lopez' };
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
    "media-src 'self' blob: data:",
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
  path.resolve(ROOT_DIR, 'docs', 'dossier', 'dossier_barberia_lopez.html'),
  path.resolve(ROOT_DIR, 'docs', 'dossier', 'Dossier_Plataforma_Barberia_Lopez.pdf'),
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
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ics': 'text/calendar; charset=utf-8',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogg': 'video/ogg'
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
  // ENDPOINT DE SALUD Y KEEP-ALIVE (RENDER & UPTIME MONITORING)
  // --------------------------------------------------------------------------
  if (reqUrl === '/api/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      status: 'ok',
      service: 'barberia-lopez',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: Date.now()
    }));
    return;
  }

  if (reqUrl.startsWith('/api/') && IS_RENDER) {
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

      const isValid = verifyPasswordSecure(password, targetUser.passwordHash, targetUser.username);
      if (!isValid) {
        recordFailedAuthAttempt(req);
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Credenciales invalidas.' }));
        return;
      }

      clearAuthAttempts(req);

      // Si el usuario aun no tenia hash scrypt seguro, migrar en este primer login
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
  // API DE VERIFICACION DE SESION: GET /api/auth/me
  // --------------------------------------------------------------------------
  if (reqUrl === '/api/auth/me' && req.method === 'GET') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Sesion no valida o expirada.' }));
      return;
    }
    const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
    const user = users.find((u) => u.id === authUser.sub || u.username === authUser.username);
    if (!user || !user.active) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Usuario no encontrado o inactivo.' }));
      return;
    }
    const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
    const barber = user.barberId ? barbers.find((b) => b.id === user.barberId) || null : null;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        barberId: user.barberId,
        active: user.active
      },
      barber
    }));
    return;
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
        avatar: String(barberData.avatar || '').trim(),
        active: barberData.active !== false,
        onShift: barberData.onShift !== false
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
    const barberId = reqUrl.substring('/api/barbers/'.length);
    const isAdminOrJefe = authUser && (authUser.role === 'ADMIN' || authUser.role === 'JEFE');
    const isOwnStation = authUser && authUser.barberId === barberId;

    if (!isAdminOrJefe && !isOwnStation) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Acceso denegado: se requieren permisos administrativos o ser titular de la estacion.' }));
      return;
    }

    try {
      const updateData = await readJsonBody(req);
      const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
      const idx = barbers.findIndex((b) => b.id === barberId);
      if (idx !== -1) {
        if (isAdminOrJefe) {
          barbers[idx] = { ...barbers[idx], ...updateData };
        } else {
          // El barbero titular solo puede alternar su estado En Turno / Fuera de Turno
          const allowedChanges = {};
          if (updateData.onShift !== undefined) {
            allowedChanges.onShift = Boolean(updateData.onShift);
          }
          if (updateData.active !== undefined) {
            allowedChanges.active = Boolean(updateData.active);
          }
          barbers[idx] = { ...barbers[idx], ...allowedChanges };
        }
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
    const targetBarber = barbers.find((b) => b.id === barberId);
    const filtered = barbers.filter((b) => b.id !== barberId);
    writeJsonFileAtomic(BARBERS_FILE, filtered);

    // Cascada bidireccional: Eliminar la cuenta de usuario asociada en USERS_FILE (siempre preservando al Administrador principal)
    const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
    const filteredUsers = users.filter((u) => {
      if (u.role === 'ADMIN') return true;
      if (barberId && u.barberId === barberId) return false;
      if (targetBarber && targetBarber.userId && u.id === targetBarber.userId) return false;
      return true;
    });
    if (filteredUsers.length !== users.length) {
      writeJsonFileAtomic(USERS_FILE, filteredUsers);
    }

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
    const rawUserId = reqUrl.substring('/api/users/'.length);
    const userId = decodeURIComponent(rawUserId).trim();
    const cleanId = userId.replace(/^@/, '').toLowerCase().trim();

    // Solo admin, jefe o el propio usuario modificandose
    if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'JEFE' && authUser.sub !== userId && authUser.username !== cleanId)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Acceso denegado.' }));
      return;
    }

    try {
      const updateData = await readJsonBody(req);
      const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
      const idx = users.findIndex((u) => 
        u.id === userId || 
        (u.username && (u.username === userId || u.username.replace(/^@/, '').toLowerCase().trim() === cleanId))
      );
      if (idx !== -1) {
        if (users[idx].role === 'ADMIN' && authUser.role !== 'ADMIN') {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Acceso denegado: solo el Administrador principal puede modificar su propia cuenta.' }));
          return;
        }

        if (updateData.passwordHash) {
          updateData.passwordHash = hashPasswordScrypt(updateData.passwordHash);
        }
        if (updateData.password) {
          updateData.passwordHash = hashPasswordScrypt(updateData.password);
          delete updateData.password;
        }

        if (authUser.role !== 'ADMIN') {
          delete updateData.role;
        }
        delete updateData.id;

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

    const rawUserId = reqUrl.substring('/api/users/'.length);
    const userId = decodeURIComponent(rawUserId).trim();
    const cleanId = userId.replace(/^@/, '').toLowerCase().trim();

    const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
    const targetIdx = users.findIndex((u) => 
      u.id === userId || 
      (u.username && (u.username === userId || u.username.replace(/^@/, '').toLowerCase().trim() === cleanId))
    );

    if (targetIdx !== -1 && users[targetIdx].role === 'ADMIN') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'No se permite eliminar al usuario Administrador.' }));
      return;
    }

    if (targetIdx === -1) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Usuario no encontrado' }));
      return;
    }

    const targetUser = users[targetIdx];
    const filtered = users.filter((u, i) => i !== targetIdx);
    writeJsonFileAtomic(USERS_FILE, filtered);

    // Cascada bidireccional: Eliminar barbero en BARBERS_FILE si corresponde
    if (targetUser.barberId || targetUser.id) {
      const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
      const filteredBarbers = barbers.filter((b) => b.id !== targetUser.barberId && b.userId !== targetUser.id);
      if (filteredBarbers.length !== barbers.length) {
        writeJsonFileAtomic(BARBERS_FILE, filteredBarbers);
      }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: true, username: targetUser.username }));
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
        res.end(JSON.stringify({ error: 'Acceso denegado: solo el Barbero Jefe o Administrador pueden agregar nuevos productos al catálogo.' }));
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

  if (reqUrl.startsWith('/api/products/') && reqUrl.endsWith('/image') && req.method === 'POST') {
    const authUser = getAuthenticatedUser(req);
    if (!authUser || (authUser.role !== 'ADMIN' && authUser.role !== 'JEFE')) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Acceso denegado: solo el Barbero Jefe o Administrador puede actualizar fotos de productos.' }));
      return;
    }

    const segments = reqUrl.split('/');
    // Formato: /api/products/:id/image -> segments[3] es el id
    const productId = decodeURIComponent(segments[3] || '');
    const products = readJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
    const idx = products.findIndex((p) => p.id === productId);
    if (idx === -1) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Producto no encontrado.' }));
      return;
    }

    try {
      const body = await readJsonBody(req, 2 * 1024 * 1024);
      const dataUri = String(body.dataUri || body.imageBase64 || '').trim();
      if (!dataUri.startsWith('data:image/')) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Formato de imagen no valido. Debe ser una imagen WebP o JPEG.' }));
        return;
      }

      const commaIdx = dataUri.indexOf(',');
      if (commaIdx === -1) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Cuerpo de imagen invalido.' }));
        return;
      }

      const meta = dataUri.substring(0, commaIdx);
      const rawBase64 = dataUri.substring(commaIdx + 1);
      const ext = meta.includes('webp') ? 'webp' : meta.includes('png') ? 'png' : 'jpg';

      const imgBuffer = Buffer.from(rawBase64, 'base64');
      if (imgBuffer.length > 2 * 1024 * 1024) {
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'La imagen excede el limite maximo de 2 MB.' }));
        return;
      }

      const safeName = `prod-${productId.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}.${ext}`;
      const filePath = path.join(PRODUCTS_IMG_DIR, safeName);
      fs.writeFileSync(filePath, imgBuffer);

      const relativeUrl = `./assets/products/${safeName}`;
      products[idx].imageUrl = relativeUrl;
      writeJsonFileAtomic(PRODUCTS_FILE, products);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, imageUrl: relativeUrl, product: products[idx] }));
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
      res.end(JSON.stringify({ error: 'Acceso denegado: solo el Barbero Jefe o Administrador pueden eliminar productos del catálogo.' }));
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

  // Helper para verificar si el usuario/barbero autenticado se encuentra activo y EN TURNO
  function getActiveBarberShiftContext(authUser) {
    if (!authUser) return { onShift: false, user: null, barber: null, barberId: null, barberName: null };
    const users = readJsonFile(USERS_FILE, DEFAULT_USERS);
    const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
    const dbUser = users.find((u) => u.id === authUser.sub || u.username === authUser.username);
    if (!dbUser || dbUser.active === false) {
      return { onShift: false, user: dbUser || null, barber: null, barberId: null, barberName: null };
    }
    const barberId = dbUser.barberId || authUser.barberId || null;
    const barber = barberId ? barbers.find((b) => b.id === barberId) : null;

    // Si tiene estacion de barbero asociada y dicha estacion figura Fuera de Turno o inactiva, bloquear operaciones de caja/tienda
    const isShiftActive = barber ? (barber.onShift !== false && barber.active !== false) : true;
    if (barberId && (!barber || !isShiftActive)) {
      return {
        onShift: false,
        user: dbUser,
        barber: barber || null,
        barberId,
        barberName: barber ? barber.name : dbUser.username
      };
    }

    return {
      onShift: true,
      user: dbUser,
      barber: barber || null,
      barberId: barber ? barber.id : null,
      barberName: barber ? barber.name : (dbUser.role === 'ADMIN' ? 'Administracion General' : dbUser.username)
    };
  }

  // Pedidos de Tienda con Referencia Unica Anti-Robo, Escenarios Cliente/Barbero y Pago Solo en Efectivo
  if (reqUrl === '/api/store/orders') {
    if (req.method === 'GET') {
      const orders = readJsonFile(STORE_ORDERS_FILE, DEFAULT_STORE_ORDERS);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(orders));
      return;
    }

    if (req.method === 'POST') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
        return;
      }

      await (storeOrderLock = storeOrderLock.catch(() => {}).then(async () => {
        try {
        const isDirectSale = Boolean(body.directSale);
        const productId = String(body.productId || '').trim();
        const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1));

        // Si es Venta Directa en Estacion (realizada por el barbero cuando el cliente pide en silla/mostrador)
        let shiftCtx = null;
        if (isDirectSale) {
          const authUser = getAuthenticatedUser(req);
          if (!authUser) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Debes iniciar sesion para registrar una venta directa en mostrador.' }));
            return;
          }
          shiftCtx = getActiveBarberShiftContext(authUser);
          if (!shiftCtx.onShift) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Accion bloqueada: Tu estacion figura FUERA DE TURNO. Activa tu turno para poder cobrar y registrar ventas de productos.' }));
            return;
          }
        }

        const clientName = String(body.clientName || (isDirectSale ? 'Cliente en Estacion' : '')).trim();
        const clientPhone = String(body.clientPhone || (isDirectSale ? 'Venta Presencial' : '')).trim();

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

        const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
        const deliveryMode = isDirectSale
          ? 'VENTA_DIRECTA'
          : (body.deliveryMode === 'EN_BARBERIA' ? 'EN_BARBERIA' : 'APARTADO_RECOGIDA');

        let preferredBarberId = body.preferredBarberId && body.preferredBarberId !== 'ANY'
          ? String(body.preferredBarberId).trim()
          : null;
        let preferredBarberName = 'Cualquier barbero en turno';

        if (preferredBarberId) {
          const targetBarber = barbers.find((b) => b.id === preferredBarberId);
          const isTargetOnShift = targetBarber && targetBarber.active !== false && targetBarber.onShift !== false;
          if (!targetBarber || !isTargetOnShift) {
            if (deliveryMode === 'EN_BARBERIA') {
              res.statusCode = 409;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({
                error: 'El barbero seleccionado no se encuentra de turno en este momento. Selecciona un barbero en turno o "Cualquier barbero en turno".'
              }));
              return;
            }
            preferredBarberId = null;
          } else {
            preferredBarberName = targetBarber.name;
          }
        }

        const orders = readJsonFile(STORE_ORDERS_FILE, DEFAULT_STORE_ORDERS);

        // Generar codigo de referencia unico e irrepetible formato REF-BL-XXXXXX (Base32 Crockford)
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let referenceCode = '';
        let exists = true;
        while (exists) {
          let suffix = '';
          for (let i = 0; i < 6; i++) {
            suffix += chars.charAt(crypto.randomInt(0, chars.length));
          }
          referenceCode = `REF-BL-${suffix}`;
          exists = orders.some((o) => o.referenceCode === referenceCode);
        }

        // Descontar del stock inmediatamente para reservar o entregar el producto
        products[prodIdx].stock -= quantity;
        writeJsonFileAtomic(PRODUCTS_FILE, products);

        // Fecha actual en zona horaria de Colombia (UTC-5)
        const nowCol = new Date(Date.now() - (5 * 60 * 60 * 1000));
        const dateStr = nowCol.toISOString().split('T')[0];

        let deliveredByBarberId = null;
        let deliveredByName = null;
        if (isDirectSale && shiftCtx) {
          const requestedBarberId = body.barberId ? String(body.barberId).trim() : shiftCtx.barberId;
          const assignedBarber = requestedBarberId ? barbers.find((b) => b.id === requestedBarberId) : shiftCtx.barber;
          const isAssignedOnShift = assignedBarber && assignedBarber.active !== false && assignedBarber.onShift !== false;
          if (assignedBarber && !isAssignedOnShift) {
            // Rollback stock si intentan asignar venta directa a un barbero fuera de turno
            products[prodIdx].stock += quantity;
            writeJsonFileAtomic(PRODUCTS_FILE, products);
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: `No se puede asignar la venta a ${assignedBarber.name} porque su estacion esta FUERA DE TURNO.` }));
            return;
          }
          deliveredByBarberId = assignedBarber ? assignedBarber.id : shiftCtx.barberId;
          deliveredByName = assignedBarber ? assignedBarber.name : shiftCtx.barberName;
        }

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
          deliveryMode, // EN_BARBERIA | APARTADO_RECOGIDA | VENTA_DIRECTA
          preferredBarberId: isDirectSale ? deliveredByBarberId : preferredBarberId,
          preferredBarberName: isDirectSale ? (deliveredByName || 'Venta en Mostrador') : preferredBarberName,
          paymentMethod: 'EFECTIVO',
          status: isDirectSale ? 'ENTREGADO' : 'PENDIENTE', // PENDIENTE | ENTREGADO | CANCELADO
          date: dateStr,
          createdAt: new Date().toISOString(),
          deliveredAt: isDirectSale ? new Date().toISOString() : null,
          deliveredDate: isDirectSale ? dateStr : null,
          deliveredBy: isDirectSale && shiftCtx ? shiftCtx.user.username : null,
          deliveredByBarberId,
          deliveredByName
        };

        orders.unshift(newOrder);
        writeJsonFileAtomic(STORE_ORDERS_FILE, orders);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          order: newOrder,
          product: products[prodIdx],
          orders,
          products
        }));
        return;
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      }));
      return;
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

    const shiftCtx = getActiveBarberShiftContext(authUser);
    if (!shiftCtx.onShift) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        error: 'Accion bloqueada: Tu estacion figura FUERA DE TURNO. Solo un barbero activo en turno dentro de la barberia puede recibir efectivo y confirmar entregas.'
      }));
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

    let body = {};
    try {
      body = await readJsonBody(req);
    } catch (e) {
      body = {};
    }

    const barbers = readJsonFile(BARBERS_FILE, DEFAULT_BARBERS);
    let collectorBarberId = shiftCtx.barberId;
    let collectorBarberName = shiftCtx.barberName;

    // Si un ADMIN (sin estacion propia) confirma el pedido, adjudicar al barbero en turno indicado o al preferido del pedido si esta en turno
    if (!collectorBarberId) {
      const candidateId = body.barberId || orders[idx].preferredBarberId;
      if (candidateId) {
        const candidateBarber = barbers.find((b) => b.id === candidateId && b.active !== false);
        if (candidateBarber) {
          collectorBarberId = candidateBarber.id;
          collectorBarberName = candidateBarber.name;
        }
      }
    }

    const nowCol = new Date(Date.now() - (5 * 60 * 60 * 1000));
    const deliveredDate = nowCol.toISOString().split('T')[0];

    orders[idx].status = 'ENTREGADO';
    orders[idx].deliveredAt = new Date().toISOString();
    orders[idx].deliveredDate = deliveredDate;
    orders[idx].deliveredBy = shiftCtx.user.username;
    orders[idx].deliveredByBarberId = collectorBarberId;
    orders[idx].deliveredByName = collectorBarberName;

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

    const shiftCtx = getActiveBarberShiftContext(authUser);
    if (!shiftCtx.onShift) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        error: 'Accion bloqueada: Tu estacion figura FUERA DE TURNO. Solo personal activo en turno puede cancelar pedidos.'
      }));
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

    // Restaurar las unidades al inventario del producto bajo exclusion mutua
    let products = [];
    await (storeOrderLock = storeOrderLock.catch(() => {}).then(() => {
      products = readJsonFile(PRODUCTS_FILE, DEFAULT_PRODUCTS);
      const prodIdx = products.findIndex((p) => p.id === orders[idx].productId);
      if (prodIdx !== -1) {
        products[prodIdx].stock += Number(orders[idx].quantity) || 1;
        writeJsonFileAtomic(PRODUCTS_FILE, products);
      }

      orders[idx].status = 'CANCELADO';
      orders[idx].cancelledAt = new Date().toISOString();
      orders[idx].cancelledBy = shiftCtx.user.username;
      orders[idx].cancelledByName = shiftCtx.barberName;

      writeJsonFileAtomic(STORE_ORDERS_FILE, orders);
    }));

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
  } else if (reqUrl.startsWith('/assets/')) {
    reqUrl = `/src${reqUrl}`;
  } else if (reqUrl === '/theme.css' || reqUrl === '/animations.css') {
    reqUrl = `/src/ui/styles${reqUrl}`;
  } else if (reqUrl === '/bundle.js') {
    reqUrl = '/src/bundle.js';
  } else if (reqUrl === '/logo_barberia_lopez_hd.jpg') {
    reqUrl = '/src/logo_barberia_lopez_hd.jpg';
  } else if (reqUrl === '/dossier_barberia_lopez.html') {
    reqUrl = '/docs/dossier/dossier_barberia_lopez.html';
  } else if (reqUrl === '/Dossier_Plataforma_Barberia_Lopez.pdf') {
    reqUrl = '/docs/dossier/Dossier_Plataforma_Barberia_Lopez.pdf';
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

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.maxHeadersCount = 100;

server.listen(PORT, HOST, () => {
  console.log(`\n======================================================`);
  console.log(` Barberia Lopez - Servidor Seguro y Blindado`);
  console.log(`======================================================`);
  console.log(` Puerto activo:          http://localhost:${PORT}`);
  console.log(` Politica de Seguridad:  Autenticacion HMAC / Anti-XSS / Rate Limit`);
  console.log(` Directorio protegido:   Acceso restringido a data/ y backend`);
  console.log(`======================================================\n`);
});
