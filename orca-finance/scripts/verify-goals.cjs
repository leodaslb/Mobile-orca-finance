// Verificação técnica RF04/US10/RN-META-01/02, sem dependência adicional.
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
  vm.runInThisContext(`(function(require, module, exports) {${source}\n})`, {
    filename: absolute,
  })(localRequire, module, module.exports);
  return module.exports;
}

const goalService = load('src/services/goal.mock-service.ts');
const { getDashboardData } = load('src/services/dashboard.mock-service.ts');
const { goalsMock, goalContributionsMock } = load('src/data/mocks/goals.mock.ts');
const { transactionsMock } = load('src/data/mocks/transactions.mock.ts');
const goalsSnapshot = JSON.stringify(goalsMock);
const contributionsSnapshot = JSON.stringify(goalContributionsMock);
const transactionsSnapshot = JSON.stringify(transactionsMock);

try {
  const initial = goalService.getGoalById('goal-001');
  assert.equal(initial.currentCents, 225000);
  assert.equal(initial.progress, 0.45);
  assert.equal(initial.suggestionCents, 2807);
  assert.equal(goalService.calculateGoalSuggestion({
    targetCents: 500000,
    currentCents: 225000,
    deadline: '2026-12-20',
    frequency: 'weekly',
  }), 19643);

  const { formatDateInput, parseBrazilianDateToISO } = load('src/utils/date.ts');
  assert.equal(formatDateInput('20122026'), '20/12/2026');
  assert.equal(parseBrazilianDateToISO(formatDateInput('20122026')), '2026-12-20');
  assert.equal(parseBrazilianDateToISO(formatDateInput('31022026')), null);
  assert.equal(formatDateInput('20/12/2026'), '20/12/2026');

  const created = goalService.createGoal({
    name: '  Notebook novo  ',
    targetCents: 100000,
    deadline: '2026-10-13',
    suggestionFrequency: 'daily',
  });
  assert.equal(created.id, 'goal-002');
  assert.equal(created.name, 'Notebook novo');
  assert.equal(created.currentCents, 0);
  assert.equal(created.suggestionCents, 3334);
  assert.ok(goalService.getGoals().some((goal) => goal.id === created.id));

  const contribution = goalService.addGoalContribution({
    goalId: created.id,
    amountCents: 12345,
    date: '2026-09-13',
  });
  assert.equal(contribution.id, 'contribution-005');
  const afterContribution = goalService.getGoalById(created.id);
  assert.equal(afterContribution.currentCents, 12345);
  assert.equal(afterContribution.contributions[0].id, contribution.id);
  assert.equal(afterContribution.suggestionCents, 2922);

  goalsMock.find((item) => item.id === created.id).deadline = '2026-09-12';
  const expired = goalService.getGoalById(created.id);
  assert.equal(expired.isExpired, true);
  assert.equal(expired.remainingCents, 87655);
  assert.equal(expired.suggestionCents, null);
  const extended = goalService.updateGoalDeadline(created.id, '2026-10-13');
  assert.equal(extended.isExpired, false);
  assert.equal(extended.currentCents, 12345);
  assert.equal(extended.suggestionCents, 2922);
  assert.throws(() => goalService.updateGoalDeadline(created.id, '2026-09-12'));

  const dashboardBefore = getDashboardData();
  const transactionCount = transactionsMock.length;
  goalService.addGoalContribution({
    goalId: 'goal-001',
    amountCents: 1000,
    date: '2026-09-13',
  });
  const dashboardAfter = getDashboardData();
  assert.equal(dashboardAfter.goal.currentCents, dashboardBefore.goal.currentCents + 1000);
  assert.equal(dashboardAfter.balanceCents, dashboardBefore.balanceCents);
  assert.equal(transactionsMock.length, transactionCount);
  assert.equal(JSON.stringify(transactionsMock), transactionsSnapshot);

  assert.throws(() => goalService.createGoal({
    name: '', targetCents: 100, deadline: '2026-10-01', suggestionFrequency: 'daily',
  }));
  assert.throws(() => goalService.createGoal({
    name: 'Inválida', targetCents: 0, deadline: '2026-10-01', suggestionFrequency: 'daily',
  }));
  assert.throws(() => goalService.createGoal({
    name: 'Vencida', targetCents: 100, deadline: '2026-09-12', suggestionFrequency: 'daily',
  }));
  assert.throws(() => goalService.addGoalContribution({
    goalId: 'missing', amountCents: 100, date: '2026-09-13',
  }));
} finally {
  goalsMock.splice(0, goalsMock.length, ...JSON.parse(goalsSnapshot));
  goalContributionsMock.splice(0, goalContributionsMock.length,
    ...JSON.parse(contributionsSnapshot));
}

assert.equal(JSON.stringify(goalsMock), goalsSnapshot);
assert.equal(JSON.stringify(goalContributionsMock), contributionsSnapshot);
assert.equal(JSON.stringify(transactionsMock), transactionsSnapshot);
console.log('PASS: lista, criação, sugestão, aporte e integração da meta com Dashboard.');
