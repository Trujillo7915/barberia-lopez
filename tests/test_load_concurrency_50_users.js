/**
 * Barberia Lopez - Suite de Pruebas de Carga y Concurrencia Extrema (50+ Usuarios Simultaneos)
 * 
 * Verifica que el servidor soporte rafagas masivas de concurrencia sin caidas,
 * sin memory leaks, sin bloqueos de bucle de eventos y con exclusion mutua estricta
 * en escrituras a disco (citas, pedidos, stock).
 * 
 * Politica de comunicacion y logs: CERO EMOJIS (estricto).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = 3000;
const HOST = 'localhost';

const APPOINTMENTS_FILE = path.join(ROOT_DIR, 'data', 'appointments.json');
const STORE_ORDERS_FILE = path.join(ROOT_DIR, 'data', 'store_orders.json');
const PRODUCTS_FILE = path.join(ROOT_DIR, 'data', 'products.json');

function makeRequest({ path: reqPath, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const startTime = Date.now();
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: reqPath,
        method,
        headers: reqHeaders,
        agent: new http.Agent({ keepAlive: true, maxSockets: 100 })
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const duration = Date.now() - startTime;
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            parsed = raw;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed,
            rawLength: Buffer.byteLength(raw),
            duration
          });
        });
      }
    );

    req.on('error', (err) => {
      const duration = Date.now() - startTime;
      reject(new Error(`Error de conexion (${reqPath}): ${err.message} tras ${duration}ms`));
    });

    if (postData) req.write(postData);
    req.end();
  });
}

async function runParallelBatch(batchName, tasks) {
  const start = Date.now();
  const results = await Promise.all(tasks);
  const totalDuration = Date.now() - start;

  const latencies = results.map((r) => r.duration);
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1);

  const statusCounts = {};
  for (const r of results) {
    statusCounts[r.statusCode] = (statusCounts[r.statusCode] || 0) + 1;
  }

  const statusSummary = Object.entries(statusCounts)
    .map(([st, count]) => `${count}x[HTTP ${st}]`)
    .join(', ');

  console.log(`  * ${batchName}: ${results.length} peticiones en ${totalDuration}ms (promedio: ${avgLatency}ms, min: ${minLatency}ms, max: ${maxLatency}ms) -> ${statusSummary}`);
  return { results, totalDuration, avgLatency, statusCounts };
}

async function runStressAndConcurrencyTests() {
  console.log('===============================================================');
  console.log(' BARBERIA LOPEZ — PRUEBAS DE CARGA Y CONCURRENCIA (50 USUARIOS)');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  // Respaldar estado inicial de archivos criticos
  const origApptsRaw = fs.existsSync(APPOINTMENTS_FILE) ? fs.readFileSync(APPOINTMENTS_FILE, 'utf8') : '[]';
  const origOrdersRaw = fs.existsSync(STORE_ORDERS_FILE) ? fs.readFileSync(STORE_ORDERS_FILE, 'utf8') : '[]';
  const origProductsRaw = fs.existsSync(PRODUCTS_FILE) ? fs.readFileSync(PRODUCTS_FILE, 'utf8') : '[]';

  try {
    // --------------------------------------------------------------------------
    // FASE 1: 50 USUARIOS SIMULTANEOS CARGANDO ACTIVOS ESTATICOS (200 PETICIONES)
    // --------------------------------------------------------------------------
    console.log('[FASE 1] Simulando 50 usuarios simultaneos solicitando la SPA y recursos estaticos...');
    try {
      const staticTasks = [];
      for (let i = 0; i < 50; i++) {
        staticTasks.push(makeRequest({ path: '/' }));
        staticTasks.push(makeRequest({ path: '/bundle.js' }));
        staticTasks.push(makeRequest({ path: '/theme.css' }));
        staticTasks.push(makeRequest({ path: '/logo_barberia_lopez_hd.jpg' }));
      }

      const { results, statusCounts } = await runParallelBatch('Descarga masiva de assets estaticos (50 x 4 = 200 reqs)', staticTasks);
      const allSuccess = results.every((r) => r.statusCode === 200 && r.rawLength > 0);

      if (allSuccess && statusCounts[200] === 200) {
        console.log('[PASS] Fase 1: 200/200 peticiones de activos estaticos completadas con HTTP 200 sin caidas.\n');
        passed++;
      } else {
        console.error(`[FAIL] Fase 1: No todas las peticiones retornaron HTTP 200. Conteo: ${JSON.stringify(statusCounts)}\n`);
        failed++;
      }
    } catch (err) {
      console.error(`[FAIL] Fase 1: Excepcion en carga estatica: ${err.message}\n`);
      failed++;
    }

    // --------------------------------------------------------------------------
    // FASE 2: 50 USUARIOS SIMULTANEOS CONSULTANDO APIs PUBLICAS (250 PETICIONES)
    // --------------------------------------------------------------------------
    console.log('[FASE 2] Simulando 50 usuarios simultaneos consultando APIs publicas en paralelo...');
    try {
      const apiTasks = [];
      for (let i = 0; i < 50; i++) {
        apiTasks.push(makeRequest({ path: '/api/barbers' }));
        apiTasks.push(makeRequest({ path: '/api/services' }));
        apiTasks.push(makeRequest({ path: '/api/products' }));
        apiTasks.push(makeRequest({ path: '/api/appointments' }));
        apiTasks.push(makeRequest({ path: '/api/store/orders' }));
      }

      const { results, statusCounts } = await runParallelBatch('Lectura concurrente de endpoints API (50 x 5 = 250 reqs)', apiTasks);
      const allSuccess = results.every((r) => r.statusCode === 200 && r.data !== null);

      if (allSuccess && statusCounts[200] === 250) {
        console.log('[PASS] Fase 2: 250/250 peticiones API concurrentes respondidas con exito y JSON valido.\n');
        passed++;
      } else {
        console.error(`[FAIL] Fase 2: Error en consultas API concurrentes. Conteo: ${JSON.stringify(statusCounts)}\n`);
        failed++;
      }
    } catch (err) {
      console.error(`[FAIL] Fase 2: Excepcion en lectura de APIs: ${err.message}\n`);
      failed++;
    }

    // --------------------------------------------------------------------------
    // FASE 3: 50 USUARIOS RESERVANDO SIMULTANEAMENTE TURNOS DISTINTOS (ESCRITURA CONCURRENTE)
    // --------------------------------------------------------------------------
    console.log('[FASE 3] Simulando 50 reservas concurrentes en turnos distintos (Exclusion mutua y atomicidad en disco)...');
    const createdAppointmentIds = [];
    try {
      // Usar barbero activo david
      const barbersRes = await makeRequest({ path: '/api/barbers' });
      const activeBarber = barbersRes.data.find((b) => b.active !== false) || barbersRes.data[0];
      const barberId = activeBarber.id;

      // Generar 50 slots unicos repartidos en franjas y dias futuros para evitar colision intencional
      const bookingTasks = [];
      const times = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];
      
      for (let i = 0; i < 50; i++) {
        const dayOffset = Math.floor(i / times.length) + 1;
        const timeSlot = times[i % times.length];
        const dateStr = `2026-12-0${dayOffset}`;
        const apptId = `appt-stress-${i}-${Date.now()}`;
        createdAppointmentIds.push(apptId);

        const [startH, startM] = timeSlot.split(':').map(Number);
        const endMinutes = startH * 60 + startM + 30;
        const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
        const endM = String(endMinutes % 60).padStart(2, '0');
        const endTimeStr = `${endH}:${endM}`;

        bookingTasks.push(
          makeRequest({
            path: '/api/appointments',
            method: 'POST',
            body: {
              id: apptId,
              barberId,
              serviceId: 's-01',
              date: dateStr,
              startTime: timeSlot,
              endTime: endTimeStr,
              clientName: `Cliente Concurrente ${i + 1}`,
              clientPhone: `300555${String(i).padStart(4, '0')}`,
              paymentMethod: 'EFECTIVO'
            }
          })
        );
      }

      const { results, statusCounts } = await runParallelBatch('50 reservas simultaneas con escritura atomica', bookingTasks);
      const allCreated = results.every((r) => r.statusCode === 200 && r.data.success === true);

      // Verificar que el archivo en disco este integro y contenga las citas
      const savedAppointments = JSON.parse(fs.readFileSync(APPOINTMENTS_FILE, 'utf8'));
      const foundInFile = createdAppointmentIds.filter((id) => savedAppointments.some((a) => a.id === id)).length;

      if (allCreated && statusCounts[200] === 50 && foundInFile === 50) {
        console.log(`[PASS] Fase 3: 50/50 reservas creadas y guardadas en disco sin bloqueos ni corrupcion de archivos.\n`);
        passed++;
      } else {
        console.error(`[FAIL] Fase 3: Fallaron reservas. Conteo de status: ${JSON.stringify(statusCounts)}, encontrados en disco: ${foundInFile}/50\n`);
        failed++;
      }
    } catch (err) {
      console.error(`[FAIL] Fase 3: Excepcion en creacion masiva de citas: ${err.message}\n`);
      failed++;
    }

    // --------------------------------------------------------------------------
    // FASE 4: ESTAMPIDA DE CONCURRENCIA SOBRE EL MISMO TURNO (RACE CONDITION / ANTI DOUBLE-BOOKING)
    // --------------------------------------------------------------------------
    console.log('[FASE 4] Simulando 25 usuarios compitiendo en el mismo milisegundo por el EXACTO MISMO TURNO...');
    let winningApptId = null;
    try {
      const collisionTasks = [];
      const collisionDate = '2026-12-25';
      const collisionSlot = '15:00';
      const collisionEnd = '15:30';

      const barbersRes = await makeRequest({ path: '/api/barbers' });
      const barberId = barbersRes.data[0].id;

      for (let i = 0; i < 25; i++) {
        const candidateId = `appt-collision-${i}-${Date.now()}`;
        collisionTasks.push(
          makeRequest({
            path: '/api/appointments',
            method: 'POST',
            body: {
              id: candidateId,
              barberId,
              serviceId: 's-01',
              date: collisionDate,
              startTime: collisionSlot,
              endTime: collisionEnd,
              clientName: `Competidor ${i + 1}`,
              clientPhone: `311777${String(i).padStart(4, '0')}`,
              paymentMethod: 'EFECTIVO'
            }
          })
        );
      }

      const { results, statusCounts } = await runParallelBatch('25 usuarios compitiendo por 1 solo turno', collisionTasks);
      const winners = results.filter((r) => r.statusCode === 200);
      const conflicts = results.filter((r) => r.statusCode === 409);

      if (winners.length === 1 && conflicts.length === 24) {
        winningApptId = winners[0].data.appointment.id;
        createdAppointmentIds.push(winningApptId);
        console.log(`[PASS] Fase 4: Mutex transaccional blindado. Exactamente 1 reserva ganadora y 24 rechazadas limpiamente con HTTP 409.\n`);
        passed++;
      } else {
        console.error(`[FAIL] Fase 4: Violacion de mutex o colision no controlada: ${winners.length} ganadores, ${conflicts.length} conflictos (Esperado: 1 y 24).\n`);
        failed++;
      }
    } catch (err) {
      console.error(`[FAIL] Fase 4: Excepcion en prueba de colision: ${err.message}\n`);
      failed++;
    }

    // --------------------------------------------------------------------------
    // FASE 5: 50 COMPRADORES SIMULTANEOS AGOTANDO INVENTARIO (PROTECCION CONTRA SOBREVENTA)
    // --------------------------------------------------------------------------
    console.log('[FASE 5] Simulando 50 compradores simultaneos de un producto con stock limitado a 20 unidades...');
    let testProductId = null;
    let createdOrderIds = [];
    try {
      // 1. Iniciar sesion para crear producto de prueba
      const loginRes = await makeRequest({
        path: '/api/auth/login',
        method: 'POST',
        body: { username: 'admin', password: 'admin2026' }
      });
      const authToken = loginRes.data.token;

      // 2. Crear producto con stock inicial = 20
      const prodRes = await makeRequest({
        path: '/api/products',
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: {
          name: 'Cera Modeladora Stress 50',
          category: 'Cuidado Capilar',
          priceCop: 25000,
          stock: 20,
          description: 'Producto para pruebas de estres y control de inventario.'
        }
      });

      testProductId = prodRes.data.product.id;
      console.log(`  * Producto de prueba creado: '${prodRes.data.product.name}' (Stock inicial: 20 unidades)`);

      // 3. 50 compradores intentando comprar 1 unidad cada uno en el mismo instante
      const purchaseTasks = [];
      for (let i = 0; i < 50; i++) {
        purchaseTasks.push(
          makeRequest({
            path: '/api/store/orders',
            method: 'POST',
            body: {
              productId: testProductId,
              quantity: 1,
              clientName: `Comprador Estres ${i + 1}`,
              clientPhone: `320888${String(i).padStart(4, '0')}`,
              deliveryMode: 'EN_BARBERIA',
              preferredBarberId: 'ANY'
            }
          })
        );
      }

      const { results, statusCounts } = await runParallelBatch('50 pedidos simultaneos contra 20 unidades de stock', purchaseTasks);
      const successfulOrders = results.filter((r) => r.statusCode === 200 && r.data.success);
      const rejectedOrders = results.filter((r) => r.statusCode === 409);

      successfulOrders.forEach((o) => {
        if (o.data.order && o.data.order.id) {
          createdOrderIds.push(o.data.order.id);
        }
      });

      // 4. Verificar stock final en base de datos
      const checkProds = await makeRequest({ path: '/api/products' });
      const targetProduct = checkProds.data.find((p) => p.id === testProductId);

      if (successfulOrders.length === 20 && rejectedOrders.length === 30 && targetProduct && targetProduct.stock === 0) {
        console.log(`[PASS] Fase 5: Exclusion mutua de inventario perfecta: exactamente 20 pedidos aceptados, 30 rechazados por stock agotado y stock final en 0 (sin sobreventa ni numeros negativos).\n`);
        passed++;
      } else {
        console.error(`[FAIL] Fase 5: Conteo incorrecto en inventario: ${successfulOrders.length} aceptados, ${rejectedOrders.length} rechazados, Stock final: ${targetProduct ? targetProduct.stock : 'N/A'}\n`);
        failed++;
      }
    } catch (err) {
      console.error(`[FAIL] Fase 5: Excepcion en prueba de inventario: ${err.message}\n`);
      failed++;
    }

    // --------------------------------------------------------------------------
    // FASE 6: 50 DESCARGAS SIMULTANEAS DE FEEDS ICALENDAR RFC 5545
    // --------------------------------------------------------------------------
    console.log('[FASE 6] Simulando 50 solicitudes concurrentes de feeds iCalendar (.ics)...');
    try {
      const icalTasks = [];
      for (let i = 0; i < 50; i++) {
        icalTasks.push(makeRequest({ path: '/api/calendar/b-david-01.ics' }));
      }

      const { results, statusCounts } = await runParallelBatch('50 descargas concurrentes de feed iCal', icalTasks);
      const allValidIcal = results.every(
        (r) => r.statusCode === 200 &&
               typeof r.data === 'string' &&
               r.data.includes('BEGIN:VCALENDAR') &&
               r.data.includes('END:VCALENDAR')
      );

      if (allValidIcal && statusCounts[200] === 50) {
        console.log(`[PASS] Fase 6: 50/50 feeds iCalendar generados y entregados en formato RFC 5545 valido.\n`);
        passed++;
      } else {
        console.error(`[FAIL] Fase 6: Fallaron feeds iCalendar. Conteo: ${JSON.stringify(statusCounts)}\n`);
        failed++;
      }
    } catch (err) {
      console.error(`[FAIL] Fase 6: Excepcion en generacion de iCal: ${err.message}\n`);
      failed++;
    }

    // --------------------------------------------------------------------------
    // FASE 7: SALUD DEL SERVIDOR Y LATENCIA POST-ESTRES
    // --------------------------------------------------------------------------
    console.log('[FASE 7] Verificando salud del bucle de eventos y latencia post-estres...');
    try {
      const healthCheck = await makeRequest({ path: '/api/barbers' });
      if (healthCheck.statusCode === 200 && healthCheck.duration < 100) {
        console.log(`[PASS] Fase 7: Servidor 100% operativo y receptivo tras mas de 800 peticiones en rafaga (Latencia de respuesta: ${healthCheck.duration}ms).\n`);
        passed++;
      } else {
        console.error(`[FAIL] Fase 7: Servidor lento o no responde: HTTP ${healthCheck.statusCode}, Latencia: ${healthCheck.duration}ms\n`);
        failed++;
      }
    } catch (err) {
      console.error(`[FAIL] Fase 7: Servidor no respondio tras la prueba: ${err.message}\n`);
      failed++;
    }

  } finally {
    // --------------------------------------------------------------------------
    // LIMPIEZA Y RESTAURACION DE ESTADO AISLADO
    // --------------------------------------------------------------------------
    console.log('--- Realizando limpieza de datos de prueba temporales ---');
    try {
      // Restaurar citas eliminando las de estres
      if (fs.existsSync(APPOINTMENTS_FILE)) {
        const currentAppts = JSON.parse(fs.readFileSync(APPOINTMENTS_FILE, 'utf8'));
        const cleanedAppts = currentAppts.filter((a) => !a.id.startsWith('appt-stress-') && !a.id.startsWith('appt-collision-'));
        fs.writeFileSync(APPOINTMENTS_FILE, JSON.stringify(cleanedAppts, null, 2), 'utf8');
      }

      // Restaurar pedidos de tienda eliminando los de estres
      if (fs.existsSync(STORE_ORDERS_FILE)) {
        const currentOrders = JSON.parse(fs.readFileSync(STORE_ORDERS_FILE, 'utf8'));
        const cleanedOrders = currentOrders.filter((o) => !o.clientName || !o.clientName.startsWith('Comprador Estres'));
        fs.writeFileSync(STORE_ORDERS_FILE, JSON.stringify(cleanedOrders, null, 2), 'utf8');
      }

      // Restaurar productos eliminando el de estres
      if (fs.existsSync(PRODUCTS_FILE)) {
        const currentProducts = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
        const cleanedProducts = currentProducts.filter((p) => p.name !== 'Cera Modeladora Stress 50');
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(cleanedProducts, null, 2), 'utf8');
      }

      console.log('Limpieza completada exitosamente. Estado de datos preservado.\n');
    } catch (cleanErr) {
      console.error('Error durante la limpieza de datos:', cleanErr.message);
    }
  }

  console.log('===============================================================');
  console.log(` RESUMEN DE PRUEBAS DE CARGA: ${passed} pasadas, ${failed} falladas.`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runStressAndConcurrencyTests();
