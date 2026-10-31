// Turns a vitest JSON report into GitHub Actions annotations (.github/workflows/tests.yml), so a run's result can be
// read from the run page or the API without downloading logs.
// Usage: node scripts/ci-test-summary.mjs <report.json> <label> [title filter, e.g. transferClub]
import fs from 'node:fs';

const [file, label = 'tests', filter] = process.argv.slice(2);
if (!file || !fs.existsSync(file)) {
  console.log(`::error title=${label}::No hay reporte de tests (${file}): los tests no llegaron a correr.`);
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const tests = report.testResults.flatMap(suite => suite.assertionResults);
const count = status => tests.filter(test => test.status === status).length;
const passed = count('passed');
const failed = count('failed');
const skipped = tests.length - passed - failed;
const level = failed ? 'error' : 'notice';
console.log(`::${level} title=${label}::${passed} pasaron, ${failed} fallaron, ${skipped} salteados (${tests.length} en total).`);

if (filter) {
  const picked = tests.filter(test => [...(test.ancestorTitles || []), test.title].join(' ').includes(filter));
  const lines = picked.map(test => `${test.status === 'passed' ? 'OK' : test.status.toUpperCase()}: ${test.title}`);
  const anyBad = picked.some(test => test.status !== 'passed');
  console.log(`::${picked.length && !anyBad ? 'notice' : 'error'} title=${label} · ${filter}::${picked.length ? lines.join(' | ') : 'ningún test con ese nombre'}`);
}
