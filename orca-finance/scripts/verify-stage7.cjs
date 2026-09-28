// Integração técnica RF05/RF20/RF40/RF70: reflexão, recorrência, reversão e isolamento.
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
    const target = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2))
      : path.resolve(path.dirname(absolute), specifier);
    return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, 'index.ts'));
  };
  vm.runInThisContext(`(function(require, module, exports) {${source}\n})`, { filename: absolute })(localRequire, module, module.exports);
  return module.exports;
}

const transaction = load('src/services/transaction.service.ts');
const reflection = load('src/services/reflection.service.ts');
const recurrence = load('src/services/recurrence.service.ts');
const { getDashboardData } = load('src/services/dashboard.service.ts');
const { getReportData, generateFinancialExport } = load('src/services/report.service.ts');
const { getMonthlyPlanningData } = load('src/services/planning.service.ts');
const { transactionsMock } = load('src/data/mocks/transactions.mock.ts');
const { reflectionItemsMock } = load('src/data/mocks/reflection.mock.ts');
const { recurrencesMock } = load('src/data/mocks/recurrences.mock.ts');
const { transactionAuditMock } = load('src/data/mocks/audit.mock.ts');
const { mockScenario } = load('src/data/mocks/scenario.mock.ts');
const initialTransactions = JSON.stringify(transactionsMock);
const initialBalance = getDashboardData().balanceCents;
const input = {
  type: 'expense', amountCents: 1000, date: '2026-09-13', time: '16:00',
  description: 'Compra para teste', categoryId: 'category-food', essentiality: 'non_essential',
  tags: ['teste'],
};

assert.equal(transaction.requiresPurchaseReflection(input), true);
assert.equal(transaction.requiresPurchaseReflection({ ...input, essentiality: 'unclassified' }), false);
assert.throws(() => reflection.placeInReflection({ ...input, essentiality: 'unclassified' }), /não essencial/);
const entered = new Date('2026-09-13T16:00:00Z');
const item = reflection.placeInReflection(input, 48, entered);
assert.equal(reflection.getReflectionItems('  COMPRA  ').some((entry) => entry.id === item.id), true);
assert.equal(reflection.getReflectionItems('inexistente').length, 0);
assert.equal(item.releaseAt, '2026-09-15T16:00:00.000Z');
assert.equal(transactionsMock.length, JSON.parse(initialTransactions).length);
assert.equal(getDashboardData().balanceCents, initialBalance);
assert.throws(() => reflection.finalizeReflectionItem(item.id, new Date('2026-09-15T15:59:59Z')), /ainda não terminou/);
assert.equal(reflection.getReflectionItems().length, 1);
const finalized = reflection.finalizeReflectionItem(item.id, new Date(item.releaseAt));
assert.equal(reflection.getReflectionItems().length, 0);
assert.equal(finalized.amountCents, 1000);
assert.equal(getDashboardData().balanceCents, initialBalance - 1000);

const base = recurrence.createTransactionWithRecurrence({ ...input, description: 'Recorrência teste' }, {
  recurring: true, frequency: 'monthly', nextOccurrence: '2026-10-10', reminder: false, dueDate: null,
});
const rule = recurrence.getRecurrenceForTransaction(base.id);
assert.equal(rule.profileId, mockScenario.activeProfileId);
assert.equal(transactionsMock.filter((row) => row.recurrenceId === rule.id).length, 2);
assert.equal(transactionsMock.find((row) => row.recurrenceId === rule.id && row.date === '2026-10-10').status, 'scheduled');
const countBefore = transactionsMock.length;
recurrence.processRecurrences();
recurrence.processRecurrences();
assert.equal(transactionsMock.length, countBefore);

mockScenario.referenceDate = '2026-10-10';
recurrence.processRecurrences();
assert.equal(transactionsMock.find((row) => row.recurrenceId === rule.id && row.date === '2026-10-10').status, 'effective');
assert.equal(transactionsMock.find((row) => row.recurrenceId === rule.id && row.date === '2026-11-10').status, 'scheduled');
recurrence.updateRecurrence(rule.id, {
  recurring: true, frequency: 'monthly', nextOccurrence: '2026-12-10', reminder: false, dueDate: null,
});
assert.equal(transactionsMock.some((row) => row.recurrenceId === rule.id && row.date === '2026-11-10'), false);
assert.equal(transactionsMock.some((row) => row.recurrenceId === rule.id && row.date === '2026-10-10'), true);
assert.equal(transactionsMock.some((row) => row.recurrenceId === rule.id && row.date === '2026-12-10'), true);
recurrence.updateRecurrence(rule.id, {
  recurring: false, frequency: 'monthly', nextOccurrence: null, reminder: false, dueDate: null,
});
assert.equal(transactionsMock.some((row) => row.recurrenceId === rule.id && row.date === '2026-12-10'), false);
assert.equal(transactionsMock.some((row) => row.recurrenceId === rule.id && row.date === '2026-10-10'), true);

const beforeReverse = getDashboardData().balanceCents;
const beforeReport = getReportData().totalCents;
const beforePlanning = getMonthlyPlanningData().totalSpentCents;
const target = transaction.getTransactionById(finalized.id);
transaction.reverseTransaction(finalized.id, new Date('2026-10-10T10:00:00Z'));
assert.equal(transaction.getTransactionById(finalized.id), undefined);
assert.equal(getDashboardData().balanceCents, beforeReverse + target.amountCents);
assert.equal(getReportData().totalCents, beforeReport);
assert.equal(getMonthlyPlanningData().totalSpentCents, beforePlanning);
const audit = transaction.getTransactionAuditRecords().at(-1);
assert.deepEqual(audit.snapshot.tags, target.tags);
assert.equal(audit.snapshot.id, target.id);
assert.equal(audit.operation, 'reversal');
assert.equal(audit.happenedAt, '2026-10-10T10:00:00.000Z');
assert.equal(transactionsMock.some((row) => row.description === 'Estorno'), false);

const isolatedReflection = reflection.placeInReflection(input, 48, entered);
mockScenario.activeProfileId = 'profile-other';
assert.equal(reflection.getReflectionItems().length, 0);
assert.equal(transaction.getTransactionAuditRecords().length, 0);
assert.equal(generateFinancialExport('csv').rowCount, 0);
assert.equal(recurrence.getRecurrenceForTransaction(base.id), undefined);
mockScenario.activeProfileId = 'profile-001';
assert.equal(reflection.getReflectionItems().some((entry) => entry.id === isolatedReflection.id), true);

mockScenario.referenceDate = '2027-01-31';
const monthEndBase = recurrence.createTransactionWithRecurrence({
  ...input, date: '2027-01-31', description: 'Recorrência no fim do mês',
}, {
  recurring: true, frequency: 'monthly', nextOccurrence: '2027-01-31', reminder: false, dueDate: null,
});
const monthEndRule = recurrence.getRecurrenceForTransaction(monthEndBase.id);
assert.equal(transactionsMock.filter((row) => row.recurrenceId === monthEndRule.id && row.date === '2027-02-28').length, 1);
assert.equal(transactionsMock.find((row) => row.recurrenceId === monthEndRule.id && row.date === '2027-02-28').status, 'scheduled');
mockScenario.referenceDate = '2027-02-28';
recurrence.processRecurrences();
recurrence.processRecurrences();
assert.equal(transactionsMock.filter((row) => row.recurrenceId === monthEndRule.id && row.date === '2027-02-28').length, 1);
assert.equal(transactionsMock.find((row) => row.recurrenceId === monthEndRule.id && row.date === '2027-02-28').status, 'effective');

// RN-AUD-01: um novo registro não pode herdar o ID de uma transação revertida.
const lastCreated = transaction.createTransaction(input);
transaction.reverseTransaction(lastCreated.id);
const afterReversal = transaction.createTransaction(input);
assert.notEqual(afterReversal.id, lastCreated.id);
assert.equal(transaction.getTransactionById(lastCreated.id), undefined);

mockScenario.referenceDate = '2026-09-13';
transactionsMock.splice(0, transactionsMock.length, ...JSON.parse(initialTransactions));
reflectionItemsMock.splice(0);
recurrencesMock.splice(0);
transactionAuditMock.splice(0);
console.log('PASS: reflexão 48h, recorrência única/futura e fim de mês, reversão auditada, cálculos e isolamento por perfil.');
