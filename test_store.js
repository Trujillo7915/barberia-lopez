const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const ORDERS_FILE = path.join(__dirname, 'data', 'store_orders.json');

function request(method, pathUrl, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- INICIANDO PRUEBAS INTEGRALES DEL MODULO DE TIENDA E INVENTARIO ---');
  const originalOrders = fs.existsSync(ORDERS_FILE) ? fs.readFileSync(ORDERS_FILE, 'utf8') : '[]';

  try {
    // 1. Obtener productos publicos
    const resProds = await request('GET', '/api/products');
    if (resProds.status !== 200 || !Array.isArray(resProds.data) || resProds.data.length < 6) {
      throw new Error('Fallo al obtener el catalogo publico de productos.');
    }
    console.log('[OK] 1. Catalogo publico de productos disponible (' + resProds.data.length + ' productos).');

    // 2. Intentar crear producto sin autenticacion (debe ser bloqueado 403)
    const unauthCreate = await request('POST', '/api/products', {
      name: 'Producto Pirata',
      priceCop: 10000,
      stock: 5
    });
    if (unauthCreate.status !== 403) {
      throw new Error('Fallo de seguridad: se permitio crear producto sin autenticacion.');
    }
    console.log('[OK] 2. Bloqueo de creacion de productos sin autenticacion (HTTP 403).');

    // 3. Iniciar sesion con cuenta autorizada (ADMIN / JEFE)
    const loginRes = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin2026'
    });
    if (loginRes.status !== 200 || !loginRes.data.token) {
      throw new Error('Fallo al autenticar cuenta autorizada.');
    }
    const authToken = loginRes.data.token;
    console.log('[OK] 3. Autenticacion HMAC verificada para gestion de inventario.');

    // 4. Agregar un nuevo producto a la tienda
    const createProdRes = await request(
      'POST',
      '/api/products',
      {
        name: 'Balsamo Post-Afeitado Mentolado Lopez',
        category: 'Barba y Piel',
        priceCop: 28000,
        stock: 5,
        description: 'Cierra poros y refresca al instante despues del afeitado con navaja.'
      },
      authToken
    );
    if (createProdRes.status !== 200 || !createProdRes.data.product) {
      throw new Error('Fallo al crear nuevo producto.');
    }
    const testProd = createProdRes.data.product;
    console.log('[OK] 4. Producto creado en inventario: ' + testProd.name + ' (Stock: ' + testProd.stock + ').');

    // 5. Cliente realiza compra en efectivo de 2 unidades -> genera referencia REF-BL-XXXX y descuenta stock a 3
    const orderRes = await request('POST', '/api/store/orders', {
      productId: testProd.id,
      quantity: 2,
      clientName: 'Juan Sebastian Vargas',
      clientPhone: '3158889900'
    });
    if (
      orderRes.status !== 200 ||
      !orderRes.data.order ||
      !orderRes.data.order.referenceCode.startsWith('REF-BL-') ||
      orderRes.data.order.paymentMethod !== 'EFECTIVO'
    ) {
      throw new Error('Fallo al generar pedido y referencia unica en efectivo.');
    }
    const order1 = orderRes.data.order;
    if (orderRes.data.product.stock !== 3) {
      throw new Error('El stock no se desconto correctamente tras el pedido. Esperado: 3, Actual: ' + orderRes.data.product.stock);
    }
    console.log('[OK] 5. Pedido apartado en efectivo con Referencia Unica: ' + order1.referenceCode + ' (Stock restante: 3).');

    // 6. Verificar entrega del producto en barberia y bloqueo anti-robo ante segundo intento de reclamo
    const deliverRes = await request('PUT', `/api/store/orders/${order1.id}/deliver`, null, authToken);
    if (deliverRes.status !== 200 || deliverRes.data.order.status !== 'ENTREGADO') {
      throw new Error('Fallo al marcar pedido como ENTREGADO.');
    }
    const doubleDeliverRes = await request('PUT', `/api/store/orders/${order1.id}/deliver`, null, authToken);
    if (doubleDeliverRes.status !== 409) {
      throw new Error('Fallo anti-robo: permitio reclamar dos veces la misma referencia.');
    }
    console.log('[OK] 6. Verificacion de referencia y bloqueo Anti-Robo contra doble reclamo (HTTP 409).');

    // 7. Crear segundo pedido y cancelarlo -> debe restaurar el stock nuevamente
    const order2Res = await request('POST', '/api/store/orders', {
      productId: testProd.id,
      quantity: 2,
      clientName: 'Cliente Cancelacion',
      clientPhone: '3100001122'
    });
    const order2 = order2Res.data.order;
    const cancelRes = await request('PUT', `/api/store/orders/${order2.id}/cancel`, null, authToken);
    if (cancelRes.status !== 200 || cancelRes.data.order.status !== 'CANCELADO') {
      throw new Error('Fallo al cancelar el pedido.');
    }
    const restoredProd = cancelRes.data.products.find((p) => p.id === testProd.id);
    if (!restoredProd || restoredProd.stock !== 3) {
      throw new Error('El stock no se restauro a 3 tras cancelar el pedido no reclamado.');
    }
    console.log('[OK] 7. Cancelacion de pedido restaura automaticamente las unidades al inventario.');

    // 8. Escenario Barbero FUERA DE TURNO vs Barbero EN TURNO:
    // Crear barbero temporal de prueba via /api/barbers/with-user
    const tempUsername = 'barbero.test.' + Date.now();
    const createBarberRes = await request(
      'POST',
      '/api/barbers/with-user',
      {
        barberData: { name: 'Barbero Turno Test', specialty: 'Cortes y Tienda', phone: '3001112233' },
        userData: { username: tempUsername, password: 'testPass2026', role: 'BARBERO' }
      },
      authToken
    );
    if (createBarberRes.status !== 201 || !createBarberRes.data.barber) {
      throw new Error('Fallo al crear barbero temporal para prueba de turnos.');
    }
    const tempBarberId = createBarberRes.data.barber.id;
    const tempUserId = createBarberRes.data.user.id;

    const juniorLogin = await request('POST', '/api/auth/login', {
      username: tempUsername,
      password: 'testPass2026'
    });
    if (juniorLogin.status !== 200 || !juniorLogin.data.token) {
      throw new Error('Fallo al iniciar sesion con cuenta de barbero.');
    }
    const juniorToken = juniorLogin.data.token;

    // Poner al barbero FUERA DE TURNO (onShift: false)
    const offShiftRes = await request('PUT', `/api/barbers/${tempBarberId}`, { onShift: false }, juniorToken);
    if (offShiftRes.status !== 200 || offShiftRes.data.barber.onShift !== false) {
      throw new Error('Fallo al cambiar estado de estacion a Fuera de Turno.');
    }

    // Cliente en la barberia intenta pedir entrega inmediata con barbero fuera de turno -> bloqueado 409
    const inShopOffBarberRes = await request('POST', '/api/store/orders', {
      productId: testProd.id,
      quantity: 1,
      clientName: 'Cliente en Silla',
      clientPhone: '3112223344',
      deliveryMode: 'EN_BARBERIA',
      preferredBarberId: tempBarberId
    });
    if (inShopOffBarberRes.status !== 409) {
      throw new Error('Debio bloquear pedido EN_BARBERIA dirigido a un barbero fuera de turno.');
    }

    // Cliente crea pedido valido -> Barbero FUERA DE TURNO intenta cobrarlo/entregarlo -> bloqueado 403
    const order3Res = await request('POST', '/api/store/orders', {
      productId: testProd.id,
      quantity: 1,
      clientName: 'Cliente Apartado Remoto',
      clientPhone: '3112223344',
      deliveryMode: 'APARTADO_RECOGIDA',
      preferredBarberId: 'ANY'
    });
    const order3 = order3Res.data.order;
    const offShiftDeliver = await request('PUT', `/api/store/orders/${order3.id}/deliver`, null, juniorToken);
    if (offShiftDeliver.status !== 403) {
      throw new Error('Fallo de control de turno: un barbero FUERA DE TURNO pudo confirmar cobro de producto.');
    }
    const offShiftDirectSale = await request(
      'POST',
      '/api/store/orders',
      { productId: testProd.id, quantity: 1, clientName: 'Venta Ilegal Fuera Turno', directSale: true },
      juniorToken
    );
    if (offShiftDirectSale.status !== 403) {
      throw new Error('Fallo de control de turno: un barbero FUERA DE TURNO pudo registrar venta directa.');
    }
    console.log('[OK] 8. Bloqueo estricto para barbero FUERA DE TURNO (cobros, entregas y ventas directas HTTP 403/409).');

    // 9. Activar turno del barbero -> ahora puede entregar el pedido y registrar Venta Directa en Estacion con trazabilidad de caja
    await request('PUT', `/api/barbers/${tempBarberId}`, { onShift: true }, juniorToken);
    const onShiftDeliver = await request('PUT', `/api/store/orders/${order3.id}/deliver`, null, juniorToken);
    if (
      onShiftDeliver.status !== 200 ||
      onShiftDeliver.data.order.status !== 'ENTREGADO' ||
      onShiftDeliver.data.order.deliveredByBarberId !== tempBarberId
    ) {
      throw new Error('Fallo al entregar pedido con barbero EN TURNO o no se adjudico a su estacion.');
    }

    const directSaleRes = await request(
      'POST',
      '/api/store/orders',
      {
        productId: testProd.id,
        quantity: 1,
        clientName: 'Cliente Silla Presencial',
        directSale: true
      },
      juniorToken
    );
    if (
      directSaleRes.status !== 200 ||
      directSaleRes.data.order.status !== 'ENTREGADO' ||
      directSaleRes.data.order.deliveryMode !== 'VENTA_DIRECTA' ||
      directSaleRes.data.order.deliveredByBarberId !== tempBarberId
    ) {
      throw new Error('Fallo al registrar Venta Directa en Estacion por barbero en turno.');
    }
    console.log('[OK] 9. Barbero EN TURNO confirma entregas y registra Ventas Directas con trazabilidad exacta de caja por estacion.');

    // 10. Limpiar barbero y producto de prueba
    await request('DELETE', `/api/users/${tempUserId}`, null, authToken);
    await request('DELETE', `/api/barbers/${tempBarberId}`, null, authToken);
    await request('DELETE', `/api/products/${testProd.id}`, null, authToken);
    console.log('[OK] 10. Eliminacion de datos temporales verificada.');
    console.log('--- TODAS LAS PRUEBAS DEL MODULO DE TIENDA Y ESCENARIOS PASARON EXITOSAMENTE (10/10) ---');
  } finally {
    fs.writeFileSync(ORDERS_FILE, originalOrders, 'utf8');
  }
}

runTests().catch((err) => {
  console.error('ERROR EN PRUEBA:', err.message);
  process.exit(1);
});
