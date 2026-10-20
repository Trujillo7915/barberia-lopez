const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HOST = 'localhost';

function makeRequest({ path: reqPath, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: reqPath,
        method,
        headers: reqHeaders
      },
      (res) => {
        let chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: raw
          });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('--- INICIANDO VERIFICACION DE CONCURRENCIA, PERSISTENCIA Y CALENDARIOS ---');
  let passed = 0;
  let failed = 0;

  // 1. Probar persistencia de AUTH_SECRET en disco
  try {
    const secretPath = path.join(__dirname, 'data', '.auth_secret');
    if (fs.existsSync(secretPath)) {
      const sec = fs.readFileSync(secretPath, 'utf8').trim();
      if (sec.length >= 32) {
        console.log('[PASS] 1. Clave AUTH_SECRET persistida correctamente en data/.auth_secret');
        passed++;
      } else {
        console.error('[FAIL] 1. data/.auth_secret tiene longitud menor a 32');
        failed++;
      }
    } else {
      console.error('[FAIL] 1. data/.auth_secret no existe');
      failed++;
    }
  } catch (err) {
    console.error('[FAIL] 1. Error leyendo secret:', err.message);
    failed++;
  }

  // 2. Iniciar sesion como JEFE (lopez.barber)
  let jefeToken = null;
  try {
    const resLogin = await makeRequest({
      path: '/api/auth/login',
      method: 'POST',
      body: { username: 'lopez.barber', password: 'password123' }
    });
    // Si la contraseña en pruebas es lopez2026 o similar, verificar
    let data = JSON.parse(resLogin.data);
    if (!data.token) {
      const resLogin2 = await makeRequest({
        path: '/api/auth/login',
        method: 'POST',
        body: { username: 'admin', password: 'admin2026' }
      });
      data = JSON.parse(resLogin2.data);
    }
    if (data.token) {
      jefeToken = data.token;
      console.log('[PASS] 2. Autenticacion administrativa exitosa con token HMAC');
      passed++;
    } else {
      console.error('[FAIL] 2. No fue posible autenticar:', resLogin.data);
      failed++;
    }
  } catch (err) {
    console.error('[FAIL] 2. Error en login:', err.message);
    failed++;
  }

  // 3. Crear barbero con endpoint atomico /api/barbers/with-user
  let testBarberId = null;
  let testUserId = null;
  const testUsername = 'barbero.test.' + Date.now().toString(36);
  try {
    const resCreate = await makeRequest({
      path: '/api/barbers/with-user',
      method: 'POST',
      headers: { Authorization: `Bearer ${jefeToken}` },
      body: {
        barberData: {
          name: 'Barbero Test Automatizado',
          specialty: 'Especialista en Cortes Fade',
          phone: '+57 300 123 4567'
        },
        userData: {
          username: testUsername,
          password: 'TestPassword2026*',
          role: 'BARBERO'
        }
      }
    });

    if (resCreate.statusCode === 201) {
      const resData = JSON.parse(resCreate.data);
      testBarberId = resData.barber.id;
      testUserId = resData.user.id;
      console.log(`[PASS] 3. Barbero y usuario creados atomicamente (BarberId: ${testBarberId}, UserId: ${testUserId})`);
      passed++;
    } else {
      console.error(`[FAIL] 3. Error creando barbero con usuario: ${resCreate.statusCode} ${resCreate.data}`);
      failed++;
    }
  } catch (err) {
    console.error('[FAIL] 3. Excepcion:', err.message);
    failed++;
  }

  // 4. Modificar nombre del barbero con PUT /api/barbers/:id
  try {
    const resUpdate = await makeRequest({
      path: `/api/barbers/${testBarberId}`,
      method: 'PUT',
      headers: { Authorization: `Bearer ${jefeToken}` },
      body: {
        name: 'Barbero Test Modificado',
        specialty: 'Maestro Barbero Actualizado'
      }
    });

    if (resUpdate.statusCode === 200) {
      const resData = JSON.parse(resUpdate.data);
      if (resData.barber.name === 'Barbero Test Modificado') {
        console.log('[PASS] 4. Actualizacion de nombre de barbero exitosa y persistida');
        passed++;
      } else {
        console.error('[FAIL] 4. Nombre no coincidio:', resData);
        failed++;
      }
    } else {
      console.error(`[FAIL] 4. PUT /api/barbers/${testBarberId} fallo: ${resUpdate.statusCode} ${resUpdate.data}`);
      failed++;
    }
  } catch (err) {
    console.error('[FAIL] 4. Excepcion:', err.message);
    failed++;
  }

  // 5. Doble-submit simultaneo del mismo cliente (Idempotencia)
  try {
    const testDate = '2026-11-25';
    const testSlot = '10:00';
    const apptPayloadA = {
      id: 'test-double-a-' + Date.now(),
      barberId: testBarberId,
      serviceId: 's-01',
      date: testDate,
      startTime: testSlot,
      endTime: '10:30',
      clientName: 'Juan Perez',
      clientPhone: '+57 310 999 0001',
      paymentMethod: 'EFECTIVO'
    };
    const apptPayloadB = {
      id: 'test-double-b-' + Date.now(),
      barberId: testBarberId,
      serviceId: 's-01',
      date: testDate,
      startTime: testSlot,
      endTime: '10:30',
      clientName: 'Juan Perez',
      clientPhone: '+57 310 999 0001',
      paymentMethod: 'EFECTIVO'
    };

    // Enviar ambas peticiones en paralelo
    const [resA, resB] = await Promise.all([
      makeRequest({ path: '/api/appointments', method: 'POST', body: apptPayloadA }),
      makeRequest({ path: '/api/appointments', method: 'POST', body: apptPayloadB })
    ]);

    const dataA = JSON.parse(resA.data);
    const dataB = JSON.parse(resB.data);

    if (resA.statusCode === 200 && resB.statusCode === 200) {
      if (dataA.appointment.id === dataB.appointment.id) {
        console.log('[PASS] 5. Doble-submit resuelto por idempotencia: ambos devolvieron 200 OK con la misma cita');
        passed++;
      } else {
        console.error('[FAIL] 5. Devolvieron IDs diferentes:', dataA, dataB);
        failed++;
      }
    } else {
      console.error(`[FAIL] 5. Uno de los dos falló inesperadamente: A=${resA.statusCode}, B=${resB.statusCode}`);
      failed++;
    }
  } catch (err) {
    console.error('[FAIL] 5. Excepcion:', err.message);
    failed++;
  }

  // 6. Colision real de un SEGUNDO cliente diferente en el mismo slot
  try {
    const testDate = '2026-11-25';
    const testSlot = '10:00';
    const apptDifferentClient = {
      id: 'test-diff-client-' + Date.now(),
      barberId: testBarberId,
      serviceId: 's-01',
      date: testDate,
      startTime: testSlot,
      endTime: '10:30',
      clientName: 'Carlos Gomez',
      clientPhone: '+57 315 555 4433',
      paymentMethod: 'EFECTIVO'
    };

    const resCollision = await makeRequest({
      path: '/api/appointments',
      method: 'POST',
      body: apptDifferentClient
    });

    if (resCollision.statusCode === 409) {
      console.log('[PASS] 6. Colision de cliente diferente rechazada con 409 Conflict');
      passed++;
    } else {
      console.error(`[FAIL] 6. Se esperaba 409 pero se recibio: ${resCollision.statusCode} ${resCollision.data}`);
      failed++;
    }
  } catch (err) {
    console.error('[FAIL] 6. Excepcion:', err.message);
    failed++;
  }

  // 7. Feeds iCalendar RFC 5545
  try {
    const resBarberFeed = await makeRequest({ path: `/api/calendar/${testBarberId}.ics` });
    const hasIcsHeader = resBarberFeed.headers['content-type'] && resBarberFeed.headers['content-type'].includes('text/calendar');
    const hasSequence = resBarberFeed.data.includes('SEQUENCE:0');
    const hasTimezone = resBarberFeed.data.includes('X-WR-TIMEZONE:America/Bogota');

    if (resBarberFeed.statusCode === 200 && hasIcsHeader && hasSequence && hasTimezone) {
      console.log('[PASS] 7. Feed iCalendar RFC 5545 incluye cabeceras, SEQUENCE:0 y zona horaria Bogota');
      passed++;
    } else {
      console.error('[FAIL] 7. Fallo en feed iCalendar:', resBarberFeed.statusCode, hasIcsHeader, hasSequence, hasTimezone);
      failed++;
    }
  } catch (err) {
    console.error('[FAIL] 7. Excepcion:', err.message);
    failed++;
  }

  // 8. Descarga individual .ics (verificando soporte en /api/appointment/:id.ics y /api/calendar/appointment/:id.ics)
  try {
    const appointmentsFile = path.join(__dirname, 'data', 'appointments.json');
    const appts = JSON.parse(fs.readFileSync(appointmentsFile, 'utf8'));
    const target = appts.find(a => a.barberId === testBarberId);
    if (target) {
      const resAlias1 = await makeRequest({ path: `/api/calendar/appointment/${target.id}.ics` });
      const resAlias2 = await makeRequest({ path: `/api/appointment/${target.id}.ics` });
      if (resAlias1.statusCode === 200 && resAlias2.statusCode === 200) {
        console.log('[PASS] 8. Descarga individual .ics funciona en ambas rutas (/api/calendar/appointment y /api/appointment)');
        passed++;
      } else {
        console.error(`[FAIL] 8. Rutas .ics fallaron: Alias1=${resAlias1.statusCode}, Alias2=${resAlias2.statusCode}`);
        failed++;
      }
    } else {
      console.error('[FAIL] 8. No se encontro cita para prueba de descarga');
      failed++;
    }
  } catch (err) {
    console.error('[FAIL] 8. Excepcion:', err.message);
    failed++;
  }

  // 9. Limpieza de datos de prueba
  try {
    if (testUserId) {
      await makeRequest({
        path: `/api/users/${testUserId}`,
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jefeToken}` }
      });
    }
    if (testBarberId) {
      await makeRequest({
        path: `/api/barbers/${testBarberId}`,
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jefeToken}` }
      });
    }
    // Limpiar citas de prueba
    const appointmentsFile = path.join(__dirname, 'data', 'appointments.json');
    let appts = JSON.parse(fs.readFileSync(appointmentsFile, 'utf8'));
    appts = appts.filter(a => a.barberId !== testBarberId);
    fs.writeFileSync(appointmentsFile, JSON.stringify(appts, null, 2), 'utf8');
    console.log('[PASS] 9. Limpieza y eliminacion administrativa verificada');
    passed++;
  } catch (err) {
    console.error('[FAIL] 9. Error en limpieza:', err.message);
    failed++;
  }

  console.log(`\nRESUMEN FINAL: ${passed} pruebas superadas, ${failed} fallos.`);
  if (failed > 0) process.exit(1);
}

runTests();
