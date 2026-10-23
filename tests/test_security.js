const fs = require('fs');
const path = require('path');
const http = require('http');

function makeRequest({ path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- INICIO DE PRUEBAS DE PENETRACION DEFENSIVA ---');
  let passed = 0;
  let failed = 0;

  // 1. Probar acceso estatico a /data/users.json
  try {
    const r1 = await makeRequest({ path: '/data/users.json' });
    if (r1.statusCode === 403) {
      console.log('[PASS] Bloqueo de acceso estatico a /data/users.json (Status 403)');
      passed++;
    } else {
      console.log(`[FAIL] /data/users.json devolvio status ${r1.statusCode}`);
      failed++;
    }
  } catch (err) {
    console.log('[FAIL] Error en prueba 1:', err.message);
    failed++;
  }

  // 2. Probar acceso estatico a /server.js
  try {
    const r2 = await makeRequest({ path: '/server.js' });
    if (r2.statusCode === 403) {
      console.log('[PASS] Bloqueo de descarga de codigo fuente /server.js (Status 403)');
      passed++;
    } else {
      console.log(`[FAIL] /server.js devolvio status ${r2.statusCode}`);
      failed++;
    }
  } catch (err) {
    console.log('[FAIL] Error en prueba 2:', err.message);
    failed++;
  }

  // 3. Probar GET /api/users para verificar que no expone passwordHash
  try {
    const r3 = await makeRequest({ path: '/api/users' });
    const users = JSON.parse(r3.data);
    const hasHash = users.some(u => 'passwordHash' in u || 'password' in u);
    if (!hasHash) {
      console.log('[PASS] GET /api/users sanitizado (passwordHash no expuesto)');
      passed++;
    } else {
      console.log('[FAIL] GET /api/users sigue exponiendo contrasenas');
      failed++;
    }
  } catch (err) {
    console.log('[FAIL] Error en prueba 3:', err.message);
    failed++;
  }

  // 4. Probar mutacion no autorizada en /api/users sin token
  try {
    const r4 = await makeRequest({
      path: '/api/users',
      method: 'POST',
      body: { username: 'hacker', role: 'ADMIN' }
    });
    if (r4.statusCode === 403) {
      console.log('[PASS] Bloqueo de creacion de usuario sin token ADMIN (Status 403)');
      passed++;
    } else {
      console.log(`[FAIL] POST /api/users no autorizado devolvio ${r4.statusCode}`);
      failed++;
    }
  } catch (err) {
    console.log('[FAIL] Error en prueba 4:', err.message);
    failed++;
  }

  // 5. Probar autenticacion valida en /api/auth/login
  let adminToken = null;
  try {
    const r5 = await makeRequest({
      path: '/api/auth/login',
      method: 'POST',
      body: { username: 'admin', password: 'admin2026' }
    });
    const authData = JSON.parse(r5.data);
    if (r5.statusCode === 200 && authData.token) {
      adminToken = authData.token;
      console.log('[PASS] Autenticacion /api/auth/login exitosa con token HMAC');
      passed++;
    } else {
      console.log(`[FAIL] Login admin fallo: ${r5.statusCode} ${r5.data}`);
      failed++;
    }
  } catch (err) {
    console.log('[FAIL] Error en prueba 5:', err.message);
    failed++;
  }

  // 6. Probar prevencion de doble agendamiento (Double Booking)
  try {
    const barbersRes = await makeRequest({ path: '/api/barbers' });
    const barbersList = JSON.parse(barbersRes.data);
    const activeBarber = barbersList.find(b => b.active) || { id: 'test-barber' };

    const apptA = {
      id: 'test-collision-01',
      barberId: activeBarber.id,
      serviceId: 's-01',
      date: '2026-11-20',
      startTime: '14:00',
      endTime: '14:30',
      clientName: 'Cliente Test A',
      clientPhone: '3210001122',
      status: 'CONFIRMADA'
    };
    const r6A = await makeRequest({
      path: '/api/appointments',
      method: 'POST',
      body: apptA
    });

    const apptB = {
      id: 'test-collision-02',
      barberId: activeBarber.id,
      serviceId: 's-01',
      date: '2026-11-20',
      startTime: '14:15', // Solapa con 14:00 - 14:30
      endTime: '14:45',
      clientName: 'Cliente Test B',
      clientPhone: '3219998877',
      status: 'CONFIRMADA'
    };
    const r6B = await makeRequest({
      path: '/api/appointments',
      method: 'POST',
      body: apptB
    });

    if (r6A.statusCode === 200 && r6B.statusCode === 409) {
      console.log('[PASS] Deteccion de colision horaria y rechazo de doble agendamiento (Status 409 Conflict)');
      passed++;
    } else {
      console.log(`[FAIL] Double booking no detectado: Cita A status ${r6A.statusCode} (${r6A.data}), Cita B status ${r6B.statusCode} (${r6B.data})`);
      failed++;
    }

    // Limpiar cita de prueba eliminandola de la persistencia
    try {
      const apptPath = require('path').resolve(__dirname, '..', 'data', 'appointments.json');
      if (fs.existsSync(apptPath)) {
        const list = JSON.parse(fs.readFileSync(apptPath, 'utf8'));
        const filtered = list.filter((a) => a.id !== 'test-collision-01');
        fs.writeFileSync(apptPath, JSON.stringify(filtered, null, 2), 'utf8');
      }
    } catch (e) {}
  } catch (err) {
    console.log('[FAIL] Error en prueba 6:', err.message);
    failed++;
  }

  // 7. Probar cabeceras de seguridad HTTP
  try {
    const r7 = await makeRequest({ path: '/index.html' });
    const hasNosniff = r7.headers['x-content-type-options'] === 'nosniff';
    const hasFrameOptions = !!r7.headers['x-frame-options'];
    const hasCsp = !!r7.headers['content-security-policy'];
    if (hasNosniff && hasFrameOptions && hasCsp) {
      console.log('[PASS] Cabeceras de seguridad HTTP presentes (nosniff, X-Frame-Options, CSP)');
      passed++;
    } else {
      console.log('[FAIL] Faltan cabeceras de seguridad HTTP');
      failed++;
    }
  } catch (err) {
    console.log('[FAIL] Error en prueba 7:', err.message);
    failed++;
  }

  console.log(`\nRESULTADOS: ${passed} pruebas superadas, ${failed} fallos.`);
  if (failed > 0) process.exit(1);
}

runTests();
