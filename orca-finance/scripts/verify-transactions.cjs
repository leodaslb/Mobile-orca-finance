// Verificação técnica TXR-02/03/04/07/10, sem biblioteca de testes adicional.
// Executar: node scripts/verify-transactions.cjs
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

const service = load('src/services/transaction.mock-service.ts');
const { getDashboardData } = load('src/services/dashboard.mock-service.ts');
const { transactionsMock } = load('src/data/mocks/transactions.mock.ts');
const { parseBrazilianDateToISO } = load('src/utils/date.ts');
const snapshot = JSON.stringify(transactionsMock);
const dashboard = getDashboardData();
const transactions = service.getMockTransactions();
assert.equal(transactions.length, 14);
assert.deepEqual(service.getMockTransactionSections().flatMap((section) => section.data), transactions);
assert.equal(service.getMockTransactionSections().find((section) => section.date === '2026-09-13').title, 'Hoje');
assert.equal(service.getTransactionDateLabel('2026-08-31', '2026-09-01'), 'Ontem');
assert.equal(service.getTransactionDateLabel('2025-12-31', '2026-01-01'), 'Ontem');
assert.equal(service.getTransactionDateLabel('2024-02-29', '2024-03-01'), 'Ontem');
assert.equal(service.getMockTransactionById('tx-003').date, '2026-09-01');
assert.equal(service.getMockTransactionById('tx-001').subcategoryName, 'Supermercado');
assert.equal(service.getMockTransactionById('missing'), undefined);
for (const recent of dashboard.recentTransactions) {
  const detail = service.getMockTransactionById(recent.id);
  const listed = transactions.find((transaction) => transaction.id === recent.id);
  assert.deepEqual(detail, listed);
  for (const key of Object.keys(recent)) assert.deepEqual(detail[key], recent[key]);
}
assert.equal(dashboard.balanceCents, 324080);
assert.equal(dashboard.currentMonthExpensesCents, 118000);
assert.equal(dashboard.previousMonthExpensesCents, 136700);
assert.equal(dashboard.goal.currentCents, 225000);
assert.equal(service.getMockTransactions('  COMBUSTIVEL ').length, 1);
assert.equal(service.getMockTransactions('salario').length, 2);
assert.equal(service.getMockTransactions('sem correspondencia').length, 0);
assert.equal(service.getMockTransactions('   ').length, transactions.length);
assert.equal(service.getMockTransactions('mercado')[0].id, 'tx-001');
assert.equal(service.getMockTransactions('').length, transactions.length);
for (let i = 1; i < transactions.length; i++) {
  const previous = transactions[i - 1];
  const current = transactions[i];
  assert.ok(`${previous.date}T${previous.time}` >= `${current.date}T${current.time}`);
}
service.getMockTransactionById('tx-001').tags.push('local-only');
assert.equal(JSON.stringify(transactionsMock), snapshot);

// Casos ausentes no dataset oficial: apenas em memória no processo de teste.
const base = service.getMockTransactionById('tx-001');
try {
  transactionsMock.push({ ...base, id: 'test-null', categoryId: null, subcategoryId: null,
    tags: [], notes: null, essentiality: null, paymentMethod: null, receiptUri: null });
  transactionsMock.push({ ...base, id: 'test-other-profile', profileId: 'other-profile' });
  transactionsMock.push({ ...base, id: 'test-scheduled', status: 'scheduled', date: '2026-10-01' });
  const withoutCategory = service.getMockTransactionById('test-null');
  assert.equal(withoutCategory.categoryName, 'Sem categoria');
  assert.equal(withoutCategory.subcategoryName, null);
  assert.equal(withoutCategory.paymentMethod, null);
  assert.equal(service.getMockTransactionById('test-other-profile'), undefined);
  assert.ok(!service.getMockTransactions().some((item) => item.id === 'test-other-profile'));
  assert.equal(service.getMockTransactionById('test-scheduled').status, 'scheduled');
  const withScheduled = getDashboardData().balanceCents;
  transactionsMock.pop();
  assert.equal(getDashboardData().balanceCents, withScheduled);
} finally {
  transactionsMock.splice(transactions.length);
}
assert.equal(JSON.stringify(transactionsMock), snapshot);

const countBeforeReflectionCheck = transactionsMock.length;
assert.equal(service.requiresPurchaseReflection({
  type: 'expense', essentiality: 'non_essential',
}), true);
assert.equal(service.requiresPurchaseReflection({
  type: 'expense', essentiality: 'essential',
}), false);
assert.equal(service.requiresPurchaseReflection({
  type: 'expense', essentiality: null,
}), false);
assert.equal(service.requiresPurchaseReflection({
  type: 'income', essentiality: 'non_essential',
}), false);
assert.equal(transactionsMock.length, countBeforeReflectionCheck);
assert.equal(parseBrazilianDateToISO('10/10/2026'), '2026-10-10');
assert.equal(parseBrazilianDateToISO('31/02/2026'), null);

// Cadastro manual: criação, complementos e integração entre as três leituras.
const originalLength = transactionsMock.length;
try {
  const balanceBeforeCreate = getDashboardData().balanceCents;
  const expensesBeforeCreate = getDashboardData().currentMonthExpensesCents;
  const created = service.createMockTransaction({
    type: 'expense',
    amountCents: 18740,
    date: '2026-09-13',
    time: '14:32',
    description: '  Cadastro de teste  ',
    categoryId: 'category-food',
    subcategoryId: 'subcategory-supermarket',
    paymentMethod: 'debit_card',
    tags: ['viagem', 'urgente'],
    notes: null,
    essentiality: 'essential',
    receiptUri: null,
  });
  assert.match(created.id, /^tx-\d{3,}$/);
  assert.equal(created.amountCents, 18740);
  assert.equal(created.description, 'Cadastro de teste');
  assert.equal(created.subcategoryName, 'Supermercado');
  assert.equal(created.paymentMethod, 'debit_card');
  assert.deepEqual(created.tags, ['viagem', 'urgente']);
  assert.equal(created.essentiality, 'essential');
  assert.equal(created.status, 'effective');
  assert.deepEqual(service.getMockTransactionById(created.id), created);
  assert.ok(service.getMockTransactions().some((item) => item.id === created.id));
  assert.equal(getDashboardData().balanceCents, balanceBeforeCreate - 18740);
  assert.equal(getDashboardData().currentMonthExpensesCents, expensesBeforeCreate + 18740);

  const balanceBeforeScheduled = getDashboardData().balanceCents;
  const scheduled = service.createMockTransaction({
    type: 'income',
    amountCents: 50000,
    date: '2026-09-14',
    time: '09:00',
    description: 'Receita futura',
    categoryId: 'category-income',
    tags: [],
    essentiality: 'essential',
  });
  assert.equal(scheduled.status, 'scheduled');
  assert.equal(scheduled.essentiality, null);
  assert.deepEqual(service.getMockTransactionById(scheduled.id), scheduled);
  assert.ok(service.getMockTransactions().some((item) => item.id === scheduled.id));
  assert.equal(getDashboardData().balanceCents, balanceBeforeScheduled);

  assert.throws(() => service.createMockTransaction({
    type: 'expense', amountCents: 0, date: '2026-09-13', time: '14:32',
    description: 'Inválida', categoryId: 'category-food',
  }));
  assert.throws(() => service.createMockTransaction({
    type: 'expense', amountCents: 100, date: '2026-02-30', time: '14:32',
    description: 'Inválida', categoryId: 'category-food',
  }));
  assert.throws(() => service.createMockTransaction({
    type: 'expense', amountCents: 100, date: '2026-09-13', time: '25:00',
    description: 'Inválida', categoryId: 'category-food',
  }));
  assert.throws(() => service.createMockTransaction({
    type: 'expense', amountCents: 100, date: '2026-09-13', time: '14:32',
    description: ' ', categoryId: 'category-food',
  }));
  assert.throws(() => service.createMockTransaction({
    type: 'expense', amountCents: 100, date: '2026-09-13', time: '14:32',
    description: 'Inválida', categoryId: 'category-other',
    subcategoryId: 'subcategory-supermarket',
  }));
} finally {
  transactionsMock.splice(originalLength);
}
assert.equal(JSON.stringify(transactionsMock), snapshot);
console.log('PASS: cadastro, reflexão, datas complementares, scheduled e consistência Dashboard/lista/detalhe.');
