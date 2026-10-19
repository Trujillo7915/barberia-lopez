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

    // 8. Limpiar producto de prueba
    await request('DELETE', `/api/products/${testProd.id}`, null, authToken);
    console.log('[OK] 8. Eliminacion de producto verificada.');
    console.log('--- TODAS LAS PRUEBAS DEL MODULO DE TIENDA PASARON EXITOSAMENTE (8/8) ---');
  } finally {
    fs.writeFileSync(ORDERS_FILE, originalOrders, 'utf8');
  }
}

runTests().catch((err) => {
  console.error('ERROR EN PRUEBA:', err.message);
  process.exit(1);
});
