const { spawnSync } = require('child_process');
const path = require('path');

const TESTS = [
  { name: 'Seguridad y Penetración Defensiva', file: 'test_security.js' },
  { name: 'Concurrencia, Persistencia y Calendarios RFC 5545', file: 'test_concurrency_and_barbers.js' },
  { name: 'Finalizacion de Corte, Idempotencia y Caja Diaria', file: 'test_cut_completion_and_cash.js' },
  { name: 'Catalogo, Inventario, Turnos y Tienda de Productos', file: 'test_store.js' }
];

console.log('===============================================================');
console.log(' BARBERIA LOPEZ — SUITE MAESTRA DE PRUEBAS AUTOMATIZADAS');
console.log('===============================================================\n');

let totalPassedSuites = 0;
let totalFailedSuites = 0;

for (const t of TESTS) {
  const filePath = path.join(__dirname, t.file);
  console.log(`>>> EJECUTANDO: [${t.name}] (${t.file}) ...`);
  const result = spawnSync('node', [filePath], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  });

  if (result.status === 0) {
    console.log(`[PASS] Suite '${t.name}' aprobada exitosamente.\n`);
    totalPassedSuites++;
  } else {
    console.error(`[FAIL] Suite '${t.name}' fallo con codigo de salida ${result.status}.\n`);
    totalFailedSuites++;
  }
}

console.log('===============================================================');
console.log(` RESUMEN GLOBAL DE SUITES: ${totalPassedSuites} pasadas, ${totalFailedSuites} falladas.`);
console.log('===============================================================');

if (totalFailedSuites > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
