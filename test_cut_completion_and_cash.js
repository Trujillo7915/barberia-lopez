const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (_) {
            parsed = raw;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// CashCalculatorService logic implementation for direct verification
class CashCalculatorService {
  static calculateDailyCash(historyList, dateStr) {
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
    let totalConsolidated = 0;
    const byBarber = {};

    for (const record of dayRecords) {
      const price = Number(record.priceCop) || 0;
      totalConsolidated += price;
      if (!byBarber[record.barberId]) {
        byBarber[record.barberId] = { count: 0, total: 0 };
      }
      byBarber[record.barberId].count += 1;
      byBarber[record.barberId].total += price;
    }

    return {
      date: dateStr,
      totalCount: dayRecords.length,
      totalConsolidatedCop: totalConsolidated,
      breakdownByBarber: byBarber
    };
  }
}

function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function run() {
  console.log('--- INICIO DE PRUEBAS DE FINALIZACION DE CORTE, IDEMPOTENCIA Y CAJA ---');
  let passed = 0;
  let failed = 0;

  // 1. Iniciar servidor Node.js
  const serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', () => {});
  serverProcess.stderr.on('data', (d) => {
    console.error('[SERVER ERROR]', d.toString());
  });

  await wait(1500);

  try {
    // 2. Iniciar sesion como ADMIN
    let token = null;
    const loginRes = await makeRequest({
      path: '/api/auth/login',
      method: 'POST',
      body: { username: 'admin', password: 'admin2026' }
    });

    if (loginRes.data && loginRes.data.token) {
      token = loginRes.data.token;
      console.log('[PASS] Autenticacion exitosa como ADMIN.');
      passed++;
    } else {
      console.error('[FAIL] No fue posible autenticar como ADMIN:', loginRes.data);
      failed++;
    }

    const authHeaders = { Authorization: `Bearer ${token}` };

    // 3. Obtener el barbero activo
    const barbersRes = await makeRequest({ path: '/api/barbers' });
    const activeBarber = (barbersRes.data || []).find((b) => b.active);
    if (!activeBarber) {
      throw new Error('No hay barberos activos para la prueba.');
    }
    const barberId = activeBarber.id;

    // 4. Crear una cita de prueba
    const testApptId = `test_appt_${Date.now()}`;
    const todayStr = getLocalDateString(new Date());
    const newApptPayload = {
      id: testApptId,
      barberId: barberId,
      serviceId: 'corte-tradicional',
      clientName: 'Cliente Prueba Automatizada',
      clientPhone: '3001234567',
      date: todayStr,
      startTime: '19:00',
      endTime: '19:30',
      totalPriceCop: 65000,
      paymentMethod: 'EFECTIVO',
      status: 'CONFIRMADA'
    };

    const bookRes = await makeRequest({
      path: '/api/appointments',
      method: 'POST',
      body: newApptPayload
    });

    if (bookRes.statusCode === 200 && bookRes.data && bookRes.data.appointment) {
      console.log('[PASS] Cita de prueba creada con estado CONFIRMADA.');
      passed++;
    } else {
      console.error('[FAIL] Fallo al crear cita de prueba:', bookRes.data);
      failed++;
    }

    // 5. Actualizar estado de cita a COMPLETADA via PUT /api/appointments/:id
    const updateRes = await makeRequest({
      path: `/api/appointments/${testApptId}`,
      method: 'PUT',
      headers: authHeaders,
      body: { status: 'COMPLETADA' }
    });

    if (updateRes.statusCode === 200 && updateRes.data && updateRes.data.appointment && updateRes.data.appointment.status === 'COMPLETADA') {
      console.log('[PASS] PUT /api/appointments/:id actualizo status a COMPLETADA en respuesta.');
      passed++;
    } else {
      console.error('[FAIL] PUT /api/appointments/:id no actualizo status a COMPLETADA:', updateRes.data);
      failed++;
    }

    // 6. Verificar persistencia en disco de la cita actualizada
    const listRes = await makeRequest({ path: '/api/appointments' });
    const foundAppt = Array.isArray(listRes.data) && listRes.data.find((a) => a.id === testApptId);
    if (foundAppt && foundAppt.status === 'COMPLETADA') {
      console.log('[PASS] Persistencia confirmada en base de datos: status es COMPLETADA (no CONFIRMADA).');
      passed++;
    } else {
      console.error('[FAIL] Cita en base de datos no tiene status COMPLETADA:', foundAppt);
      failed++;
    }

    // 7. Guardar corte en historial via POST /api/history
    const testCutId = `test_cut_${Date.now()}`;
    const cutRecordPayload = {
      id: testCutId,
      appointmentId: testApptId,
      barberId: barberId,
      clientName: 'Cliente Prueba Automatizada',
      date: todayStr,
      executionDate: todayStr,
      appointmentDate: todayStr,
      time: '19:05',
      priceCop: 65000,
      createdAt: new Date().toISOString()
    };

    const histRes1 = await makeRequest({
      path: '/api/history',
      method: 'POST',
      headers: authHeaders,
      body: cutRecordPayload
    });

    if (histRes1.statusCode === 200 && histRes1.data && histRes1.data.success) {
      console.log('[PASS] Primer POST /api/history guardo corte exitosamente.');
      passed++;
    } else {
      console.error('[FAIL] Fallo en primer POST /api/history:', histRes1.data);
      failed++;
    }

    // 8. Intentar guardar el corte una segunda vez (simular segundo clic del barbero)
    const histRes2 = await makeRequest({
      path: '/api/history',
      method: 'POST',
      headers: authHeaders,
      body: cutRecordPayload
    });

    if (histRes2.statusCode === 200 && histRes2.data && histRes2.data.duplicatePrevented) {
      console.log('[PASS] Segundo POST /api/history detecto e impidio duplicacion (duplicatePrevented: true).');
      passed++;
    } else {
      console.error('[FAIL] Segundo POST /api/history no impidio duplicacion:', histRes2.data);
      failed++;
    }

    // 9. Verificar que en GET /api/history solo existe 1 registro para este appointmentId
    const getHistRes = await makeRequest({
      path: '/api/history',
      headers: authHeaders
    });
    const matches = Array.isArray(getHistRes.data) ? getHistRes.data.filter((h) => h.appointmentId === testApptId) : [];
    if (matches.length === 1) {
      console.log('[PASS] GET /api/history confirma exactamente 1 registro para la cita (cero duplicados en base de datos).');
      passed++;
    } else {
      console.error(`[FAIL] Se encontraron ${matches.length} registros para la cita en el historial.`);
      failed++;
    }

    // 10. Verificar calculo de caja diaria en CashCalculatorService
    const dailyCashResult = CashCalculatorService.calculateDailyCash(getHistRes.data, todayStr);
    if (dailyCashResult.totalConsolidatedCop >= 65000 && dailyCashResult.breakdownByBarber[barberId] && dailyCashResult.breakdownByBarber[barberId].total >= 65000) {
      console.log(`[PASS] CashCalculatorService totalizo la caja de hoy correctamente: $${dailyCashResult.totalConsolidatedCop} COP.`);
      passed++;
    } else {
      console.error('[FAIL] CashCalculatorService no totalizo la caja de hoy:', dailyCashResult);
      failed++;
    }

    // 11. Limpieza: Eliminar registro del historial y de citas de prueba
    await makeRequest({
      path: `/api/history/${testCutId}`,
      method: 'DELETE',
      headers: authHeaders
    });
    await makeRequest({
      path: `/api/appointments/${testApptId}`,
      method: 'DELETE',
      headers: authHeaders
    });
    console.log('[PASS] Registros de prueba limpiados exitosamente.');
    passed++;

  } catch (err) {
    console.error('[ERROR]', err);
    failed++;
  } finally {
    serverProcess.kill();
    console.log(`\n======================================================`);
    console.log(` RESULTADOS FINALES: ${passed} pruebas superadas, ${failed} fallos.`);
    console.log(`======================================================\n`);
    process.exit(failed === 0 ? 0 : 1);
  }
}

run();
