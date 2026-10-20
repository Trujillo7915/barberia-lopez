const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- INICIO DE PRUEBAS DE CICLO DE VIDA DE USUARIOS Y LOGIN ---');

  // 1. Login exitoso con admin
  const adminLogin = await makeRequest('POST', '/api/auth/login', { username: 'admin', password: 'admin2026' });
  assert.strictEqual(adminLogin.status, 200, 'Admin debe poder autenticarse con admin2026');
  assert.ok(adminLogin.body.token, 'Admin debe recibir un token');
  const adminToken = adminLogin.body.token;
  console.log('[PASS] 1. Login exitoso con admin (admin2026)');

  // 2. Login exitoso con david.barber usando david2026
  const davidLogin1 = await makeRequest('POST', '/api/auth/login', { username: 'david.barber', password: 'david2026' });
  assert.strictEqual(davidLogin1.status, 200, 'david.barber debe poder autenticarse con david2026');
  assert.strictEqual(davidLogin1.body.user.role, 'JEFE');
  console.log('[PASS] 2. Login exitoso con david.barber (david2026)');

  // 3. Login exitoso con david.barber usando BarberiaLopez (13 caracteres, clave alternativa del usuario)
  const davidLogin2 = await makeRequest('POST', '/api/auth/login', { username: 'david.barber', password: 'BarberiaLopez' });
  assert.strictEqual(davidLogin2.status, 200, 'david.barber debe poder autenticarse con BarberiaLopez');
  console.log('[PASS] 3. Login exitoso con david.barber usando BarberiaLopez (13 caracteres)');

  // 4. Login exitoso con matta.barber
  const mattaLogin = await makeRequest('POST', '/api/auth/login', { username: 'matta.barber', password: 'matta2026' });
  assert.strictEqual(mattaLogin.status, 200, 'matta.barber debe poder autenticarse con matta2026');
  console.log('[PASS] 4. Login exitoso con matta.barber (matta2026)');

  // 5. Verificacion de sesion /api/auth/me
  const meValid = await makeRequest('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${adminToken}` });
  assert.strictEqual(meValid.status, 200, '/api/auth/me debe responder 200 con token valido');
  assert.strictEqual(meValid.body.user.username, 'admin');
  console.log('[PASS] 5. Verificacion /api/auth/me exitosa');

  // 6. Verificacion /api/auth/me con token invalido o ausente rechazada con 401
  const meInvalid = await makeRequest('GET', '/api/auth/me');
  assert.strictEqual(meInvalid.status, 401, '/api/auth/me sin token debe devolver 401');
  console.log('[PASS] 6. Verificacion /api/auth/me rechazada sin token (401)');

  // 7. Creacion atomica de nuevo barbero y usuario
  const testUsername = 'carlos.test';
  const testPassword = 'carlos2026';
  const createRes = await makeRequest('POST', '/api/barbers/with-user', {
    barberData: { name: 'Carlos Test', specialty: 'Degradados', phone: '+57 311 000 1122' },
    userData: { username: testUsername, password: testPassword, role: 'BARBERO' }
  }, { 'Authorization': `Bearer ${adminToken}` });

  assert.strictEqual(createRes.status, 201, 'Creacion de barbero con usuario debe responder 201');
  assert.ok(createRes.body.barber && createRes.body.user, 'Respuesta debe incluir barbero y usuario');
  const createdUserId = createRes.body.user.id;
  const createdBarberId = createRes.body.barber.id;
  console.log('[PASS] 7. Barbero y usuario creados atomicamente (/api/barbers/with-user)');

  // 8. Login del nuevo usuario creado
  const newLogin = await makeRequest('POST', '/api/auth/login', { username: testUsername, password: testPassword });
  assert.strictEqual(newLogin.status, 200, 'Nuevo usuario debe poder autenticarse');
  const newSessionToken = newLogin.body.token;
  console.log('[PASS] 8. Login exitoso del nuevo usuario');

  // 9. Cambio de contraseña para el nuevo usuario
  const changedPwd = 'nuevoPassword2026';
  const updatePwdRes = await makeRequest('PUT', `/api/users/${createdUserId}`, { password: changedPwd }, { 'Authorization': `Bearer ${adminToken}` });
  assert.strictEqual(updatePwdRes.status, 200, 'Cambio de contrasena debe responder 200');
  console.log('[PASS] 9. Cambio de contrasena ejecutado exitosamente');

  // 10. Verificacion de login con la nueva contraseña
  const verifyNewPwdLogin = await makeRequest('POST', '/api/auth/login', { username: testUsername, password: changedPwd });
  assert.strictEqual(verifyNewPwdLogin.status, 200, 'Login debe ser exitoso con la nueva contrasena');
  console.log('[PASS] 10. Login confirmado con la nueva contrasena');

  // 11. Eliminacion en cascada: Eliminar el usuario debe remover el barbero
  const deleteRes = await makeRequest('DELETE', `/api/users/${createdUserId}`, null, { 'Authorization': `Bearer ${adminToken}` });
  assert.strictEqual(deleteRes.status, 200, 'Eliminacion de usuario debe responder 200');

  const checkUsers = await makeRequest('GET', '/api/users');
  const userStillExists = checkUsers.body.some((u) => u.id === createdUserId);
  assert.strictEqual(userStillExists, false, 'El usuario no debe existir en GET /api/users');

  const checkBarbers = await makeRequest('GET', '/api/barbers');
  const barberStillExists = checkBarbers.body.some((b) => b.id === createdBarberId);
  assert.strictEqual(barberStillExists, false, 'El barbero asociado no debe existir en GET /api/barbers (cascada)');
  console.log('[PASS] 11. Eliminacion en cascada verificada (usuario y barbero removidos)');

  // 12. Bloqueo de eliminacion de usuario Administrador
  const deleteAdminRes = await makeRequest('DELETE', '/api/users/u-admin-01', null, { 'Authorization': `Bearer ${adminToken}` });
  assert.strictEqual(deleteAdminRes.status, 400, 'No se debe permitir eliminar al Administrador');
  console.log('[PASS] 12. Proteccion de usuario Administrador confirmada (Status 400)');

  console.log('\n======================================================');
  console.log(' RESULTADOS: 12 pruebas superadas, 0 fallos.');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('[FAIL] Error en pruebas de ciclo de vida:', err);
  process.exit(1);
});
