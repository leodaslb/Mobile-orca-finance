// Verificação técnica dos services mockados US60/US37, sem dependência adicional.
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

const auth = load('src/services/auth.service.ts');
const security = load('src/services/security.service.ts');
const { profilesMock } = load('src/data/mocks/profile.mock.ts');
const { getDashboardData } = load('src/services/dashboard.service.ts');
const { getTransactions } = load('src/services/transaction.service.ts');
const { getSpendingLimitsConfiguration, getAvailablePlanningPeriods, getPlannedVsActualData } = load('src/services/planning.service.ts');
const { getReportData, generateFinancialExport } = load('src/services/report.service.ts');
const { getGoals } = load('src/services/goal.service.ts');
const { getReflectionItems } = load('src/services/reflection.service.ts');
const { getCategoriesWithSubcategories } = load('src/services/category.service.ts');

assert.throws(() => auth.signUpLocal('', 'x@example.com', 'abc'), /Preencha/);
assert.throws(() => auth.signUpLocal('Ana', 'inválido', 'abc'), /e-mail válido/);
assert.throws(() => auth.signUpLocal('Ana', 'DEMO@ORCA.FINANCE', 'abc'), /já está cadastrado/);
const created = auth.signUpLocal('Ana Silva', ' ANA@example.com ', 'senha de teste');
assert.equal(created.account.email, 'ana@example.com');
assert.equal(created.activeProfileId, profilesMock.at(-1).id);
assert.equal(profilesMock.at(-1).name, 'Ana Silva');
assert.equal(profilesMock.at(-1).initialBalanceCents, 0);
assert.equal(profilesMock.at(-1).currencyCode, 'BRL');
assert.equal(getDashboardData().balanceCents, 0);
assert.equal(getDashboardData().goal, null);
assert.equal(getTransactions().length, 0);
assert.equal(getSpendingLimitsConfiguration().dailyLimitCents, 0);
assert.deepEqual(getAvailablePlanningPeriods(), ['2026-09']);
assert.equal(getPlannedVsActualData(getAvailablePlanningPeriods()[0]).totalSpentCents, 0);
assert.equal(getGoals().length, 0);
assert.equal(getReportData().totalCents, 0);
assert.equal(generateFinancialExport('csv').rowCount, 0);
assert.equal(getReflectionItems().length, 0);
assert.ok(getCategoriesWithSubcategories().every((row) => row.subcategories.length === 0));
assert.throws(() => auth.signUpLocal('Outro', 'ana@example.com', 'abc'), /já está cadastrado/);
assert.throws(() => auth.signInLocal('ana@example.com', 'errada'), /inválidos/);
assert.equal(auth.signInLocal('ANA@example.com', 'senha de teste').activeProfileId, created.activeProfileId);
assert.throws(() => auth.selectLocalProfile(created.account, 'profile-001'), /não pertence/);

assert.equal(security.hasLocalLock(), false);
assert.throws(() => security.configureLocalPin('123'), /4 números/);
security.configureLocalPin('1234');
assert.equal(security.getLocalSecuritySettings().pinConfigured, true);
assert.equal(security.checkLocalPin('1234'), true);
assert.equal(security.checkLocalPin('4321'), false);
assert.equal(JSON.stringify(security.getLocalSecuritySettings()).includes('1234'), false);
assert.equal(security.hasLocalLock(), true);
security.setLocalBiometricEnabled(true);
assert.equal(security.getLocalSecuritySettings().preferredMethod, 'biometric');
security.setPreferredUnlockMethod('pin');
assert.equal(security.getLocalSecuritySettings().preferredMethod, 'pin');
security.setLocalBiometricEnabled(false);
assert.throws(() => security.setPreferredUnlockMethod('biometric'), /Ative/);
security.clearLocalLock();
assert.equal(security.hasLocalLock(), false);
assert.equal(security.checkLocalPin('1234'), false);

auth.signInLocal('demo@orca.finance', 'demo1234');
assert.equal(getDashboardData().balanceCents, 324080);
assert.equal(getTransactions().length, 14);
console.log('PASS: cadastro/login mockado, perfil vazio isolado, PIN local, preferência e dados financeiros da demonstração.');
