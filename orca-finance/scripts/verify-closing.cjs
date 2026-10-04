const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const createLoader = require('./ts-loader.cjs');
const load = createLoader();
const api = load('src/services/api-client.ts');
const categories = load('src/services/category.service.ts');
const recurrence = load('src/services/recurrence.service.ts');
const receipt = load('src/services/receipt.service.ts');
const currency = load('src/utils/currency.ts');
const dates = load('src/utils/date.ts');
const originalFetch = global.fetch;
process.env.EXPO_PUBLIC_API_URL = 'http://closing.example.test';
const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
let groups = 0;
async function check(name, operation) { await operation(); groups++; console.log('PASS: ' + name); }
(async () => {
  await check('parsing BRL exato no limite seguro, sem arredondamento de centavos', async () => {
    for (let offset = 0; offset < 100; offset++) {
      const cents = Number.MAX_SAFE_INTEGER - offset;
      assert.equal(currency.parseCurrencyToCents(currency.formatCurrency(cents)), cents);
    }
    assert.equal(currency.parseCurrencyToCents('90071992547409,92'), null);
    assert.equal(currency.parseCurrencyToCents('1,001'), null);
  });
  api.setApiSession('test-token', 'profile-a');
  let calls = [];
  global.fetch = async (url, options) => { calls.push({ url, method: options.method, body: options.body && JSON.parse(options.body) }); return json({ id: 'result' }); };
  await check('US05 PATCH de nome/ativação no perfil ativo, sem exclusão física', async () => {
    await categories.updateRemoteSubcategory('subcategory-a', { name: ' Feira ', active: false });
    assert.deepEqual(calls.at(-1), { url: 'http://closing.example.test/profiles/profile-a/subcategories/subcategory-a', method: 'PATCH', body: { nome: 'Feira', ativa: false } });
    await categories.updateRemoteSubcategory('subcategory-a', { active: true });
    assert.deepEqual(calls.at(-1).body, { ativa: true });
  });
  await check('US24 frequência/término, timestamp preservado e cancelamento futuro', async () => {
    const original = { id: 'recurrence-a', frequencia: 'SEMANAL', ativa: true, proximaOcorrencia: '2027-12-01T13:42:37.123Z', dataTermino: '2027-12-31' };
    const configuration = recurrence.recurrenceConfiguration(original);
    assert.equal(configuration.frequency, 'weekly');
    await recurrence.updateRemoteRecurrence(original, configuration);
    assert.deepEqual(calls.at(-1).body, { ativa: true });
    await recurrence.updateRemoteRecurrence(original, { ...configuration, frequency: 'yearly', endDate: null });
    assert.deepEqual(calls.at(-1).body, { ativa: true, frequencia: 'ANUAL', dataTermino: null });
    await recurrence.updateRemoteRecurrence(original, { ...configuration, recurring: false });
    assert.deepEqual(calls.at(-1).body, { ativa: false });
    await recurrence.updateRemoteRecurrence(original, { ...configuration, description: ' Nova descrição ', amountCents: 1029 });
    assert.deepEqual(calls.at(-1).body, { ativa: true, descricao: 'Nova descrição', valor: '10.29' });
    await recurrence.configureRemoteRecurrence('transaction-a', { type: 'expense', amountCents: 1029, description: 'Recorrência', categoryId: 'category-a', date: '2027-12-01', time: '10:42' }, { ...configuration, frequency: 'weekly' }, 'profile-a');
    assert.equal(calls.at(-1).body.frequencia, 'SEMANAL'); assert.equal(calls.at(-1).body.valor, '10.29'); assert.equal(calls.at(-1).body.dataTermino, '2027-12-31');
  });
  await check('US24 lembrete com horário local e desativação por UUID', async () => {
    await recurrence.updateRemoteReminder('reminder-a', { active: true, date: '2027-12-31', time: '23:59' });
    assert.deepEqual(calls.at(-1).body, { ativo: true, notificarEm: dates.localDateTimeToISO('2027-12-31', '23:59') });
    await recurrence.updateRemoteReminder('reminder-a', { active: false });
    assert.deepEqual(calls.at(-1).body, { ativo: false });
  });
  await check('US19 arquivo multipart enviado pelo service, sem criação por URL', async () => {
    global.fetch = async (url, options) => { calls.push({ url, body: options.body, headers: options.headers }); return json({ id: 'receipt' }); };
    await receipt.uploadReceipt('transaction-a', { uri: 'blob:test', name: 'receipt.png', mimeType: 'image/png', size: 8, webFile: new Blob(['pngbytes'], { type: 'image/png' }) });
    assert.ok(calls.at(-1).body instanceof FormData);
    assert.equal(calls.at(-1).body.get('file').type, 'image/png');
    assert.equal(calls.at(-1).headers['Content-Type'], undefined);
    assert.ok(calls.at(-1).url.endsWith('/transactions/transaction-a/receipts'));
  });
  let stored = null; let hardware = true; let enrolled = true; let success = false; let storageFails = false;
  const native = {
    'react-native': { Platform: { OS: 'android' } },
    'expo-secure-store': { getItemAsync: async () => stored, setItemAsync: async (_key, value) => { if (storageFails) throw new Error('storage'); stored = value; }, deleteItemAsync: async () => { stored = null; } },
    'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'sha256' }, getRandomBytes: n => crypto.randomBytes(n), digestStringAsync: async (_algorithm, text) => crypto.createHash('sha256').update(text).digest('hex') },
    'expo-local-authentication': { hasHardwareAsync: async () => hardware, isEnrolledAsync: async () => enrolled, authenticateAsync: async () => success ? { success: true } : { success: false, error: 'user_cancel' } },
  };
  let security = createLoader(native)('src/services/security.service.ts');
  await check('US37 PIN persistido com salt/hash, restauração e falha sem sobrescrever estado', async () => {
    await security.initializeLocalSecurity(); await security.configureLocalPin('1234');
    assert.ok(stored && !stored.includes('1234')); assert.equal(await security.checkLocalPin('1234'), true); assert.equal(await security.checkLocalPin('4321'), false);
    security = createLoader(native)('src/services/security.service.ts'); await security.initializeLocalSecurity();
    assert.equal(await security.checkLocalPin('1234'), true);
    storageFails = true; await assert.rejects(security.configureLocalPin('9876')); storageFails = false;
    assert.equal(await security.checkLocalPin('1234'), true); assert.equal(await security.checkLocalPin('9876'), false);
    await assert.rejects(security.configureLocalPin('123'), /4 números/);
  });
  await check('US37 biometria nativa: indisponível/cancelamento não desbloqueiam; sucesso e preferência', async () => {
    hardware = false; assert.equal((await security.getBiometricAvailability()).available, false);
    await assert.rejects(security.setLocalBiometricEnabled(true)); assert.equal(security.getLocalSecuritySettings().biometricEnabled, false);
    hardware = true; enrolled = false; assert.equal((await security.getBiometricAvailability()).available, false); enrolled = true;
    await assert.rejects(security.authenticateLocalBiometric(), /cancelada/);
    await assert.rejects(security.setLocalBiometricEnabled(true)); assert.equal(security.getLocalSecuritySettings().biometricEnabled, false);
    success = true; await security.setLocalBiometricEnabled(true); assert.equal(await security.authenticateLocalBiometric(), true);
    await security.setPreferredUnlockMethod('pin'); assert.equal(security.getLocalSecuritySettings().preferredMethod, 'pin');
    await security.clearLocalLock(); assert.equal(stored, null); assert.equal(security.hasLocalLock(), false);
    stored = '{}'; await assert.rejects(createLoader(native)('src/services/security.service.ts').initializeLocalSecurity(), /inválida/); assert.equal(stored, '{}');
  });
  console.log(`PASS: ${groups} grupos de fechamento.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; api.setApiSession(null, null); });
