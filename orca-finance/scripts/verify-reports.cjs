// Verificação técnica RF06/US13: agregação por perfil, período e categoria.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();

function load(file) {
  const absolute = path.resolve(root, file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} };
  cache.set(absolute, module);
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (specifier) => {
    const target = specifier.startsWith('@/')
      ? path.join(root, 'src', specifier.slice(2))
      : path.resolve(path.dirname(absolute), specifier);
    return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, 'index.ts'));
  };
  vm.runInThisContext(`(function(require, module, exports) {${source}\n})`, { filename: absolute })(localRequire, module, module.exports);
  return module.exports;
}

const { getAvailableReportMonths, getReportData, generateFinancialExport } = load('src/services/report.service.ts');
const { getDashboardData } = load('src/services/dashboard.service.ts');
const { getMonthlyPlanningData } = load('src/services/planning.service.ts');
const { transactionsMock } = load('src/data/mocks/transactions.mock.ts');
const snapshot = JSON.stringify(transactionsMock);
const originalLength = transactionsMock.length;

assert.deepEqual(getAvailableReportMonths(), ['2026-09', '2026-08']);
const september = getReportData();
assert.equal(september.startDate, '2026-09-01');
assert.equal(september.endDate, '2026-09-30');
assert.equal(september.totalCents, 118000);
assert.equal(september.totalCents, getDashboardData().currentMonthExpensesCents);
assert.equal(september.totalCents, getMonthlyPlanningData().totalSpentCents);
assert.equal(september.categories.reduce((sum, item) => sum + item.amountCents, 0), september.totalCents);
assert.equal(september.categories.find((item) => item.categoryId === 'category-food').amountCents, 36000);
assert.equal(getReportData('2026-08', 1).totalCents, 136700);
assert.equal(getReportData('2026-09', 3).totalCents, 254700);
assert.equal(getReportData('2026-09', 6).totalCents, 254700);
assert.throws(() => getReportData('2026-10', 1));
const csv = generateFinancialExport('csv', '2026-09', 1);
assert.equal(csv.fileName, 'orca-finance-2026-09-01-2026-09-30.csv');
assert.ok(csv.content.includes('"Descrição"'));
assert.ok(csv.content.includes('"Supermercado Extra"'));
assert.ok(!csv.content.includes('2026-08-'));
const excel = generateFinancialExport('excel', '2026-09', 1);
assert.ok(excel.content.startsWith('\uFEFF'));
assert.ok(excel.fileName.endsWith('.tsv'));
assert.equal(excel.rowCount, csv.rowCount);

try {
  transactionsMock.push({ ...transactionsMock[0], id: 'test-report-scheduled',
    date: '2026-09-15', status: 'scheduled', amountCents: 99900 });
  transactionsMock.push({ ...transactionsMock[0], id: 'test-report-other-profile',
    profileId: 'profile-other', amountCents: 99900 });
  transactionsMock.push({ ...transactionsMock[0], id: 'test-report-uncategorized',
    categoryId: null, amountCents: 100 });
  transactionsMock.push({ ...transactionsMock[0], id: 'test-report-formula',
    description: '=SUM(1+1)', amountCents: 100 });
  const updated = getReportData();
  assert.equal(updated.totalCents, 118200);
  assert.equal(updated.totalCents, getMonthlyPlanningData().totalSpentCents);
  assert.equal(updated.totalCents, getDashboardData().currentMonthExpensesCents);
  assert.equal(updated.categories.find((item) => item.categoryId === 'uncategorized').amountCents, 100);
  assert.equal(generateFinancialExport('csv').rowCount, csv.rowCount + 2);
  assert.ok(generateFinancialExport('csv').content.includes("'\u003dSUM(1+1)"));
} finally {
  transactionsMock.splice(originalLength);
}
assert.equal(JSON.stringify(transactionsMock), snapshot);
console.log('PASS: relatório por período/categoria, consistência com Dashboard/Planejamento e exclusões de agendadas/outros perfis.');
