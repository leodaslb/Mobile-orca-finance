const assert = require('node:assert/strict');
const createLoader = require('./ts-loader.cjs');
const savedFetch = global.fetch, savedFormData = global.FormData;
const calls = [], store = new Map();
let response = {}, status = 200, pickerResult, permission = true, tokenFailure = false;
class Multipart { constructor() { this.fields = []; } append(...args) { this.fields.push(args); } }
class NativeFile {
  constructor(uri) { this.uri = uri; this.name = 'test.csv'; this.type = 'text/csv'; }
  get size() { return 100; }
  async bytes() { return new TextEncoder().encode('tipo;valor;data_hora;descricao;categoria\nDESPESA;1.05;2026-10-01T12:00:00;Almoço;'); }
}
// Executa o serializador do Expo instalado; um FormData permissivo sozinho ocultava o erro nativo.
const { convertFormDataAsync } = createLoader({ '../../utils/blobUtils': { blobToArrayBufferAsync: blob => blob.arrayBuffer() } })('node_modules/expo/src/winter/fetch/convertFormData.ts');
global.FormData = Multipart;
process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
const load = createLoader({
  'react-native': { Platform: { OS: 'android' } },
  'expo-constants': { __esModule: true, default: { executionEnvironment: 'bare', easConfig: { projectId: 'test-project' } } },
  'expo-device': { isDevice: false }, // Android com Google Play Services também pode receber push.
  'expo-secure-store': { getItemAsync: async k => store.get(k) ?? null, setItemAsync: async (k, v) => store.set(k, v), deleteItemAsync: async k => store.delete(k) },
  'expo-document-picker': { getDocumentAsync: async () => typeof pickerResult === 'function' ? pickerResult() : pickerResult },
  'expo-file-system': { File: NativeFile },
  'expo-notifications': { AndroidImportance: { DEFAULT: 3 }, setNotificationChannelAsync: async () => {}, requestPermissionsAsync: async () => ({ granted: permission }), getExpoPushTokenAsync: async () => { if (tokenFailure) throw new Error('FirebaseApp internal stack/token detail'); return { data: 'ExpoPushToken[test]' }; } },
});
global.fetch = async (url, options) => { calls.push({ url, method: options.method, body: options.body instanceof Multipart ? options.body : options.body ? JSON.parse(options.body) : undefined }); return { ok: status < 400, status, json: async () => response }; };
const api = load('src/services/api-client.ts');
const budget = load('src/services/budget.service.ts');
const challenge = load('src/services/challenge.service.ts');
const insights = load('src/services/insight.service.ts');
const planning = load('src/services/planning.service.ts');
const tools = load('src/services/planning-tools.service.ts');
const imports = load('src/services/import.service.ts');
const push = load('src/services/push.service.ts');
let groups = 0;
async function check(name, fn) { status = 200; response = {}; await fn(); groups++; console.log(`PASS: ${name}`); }
function last(path, method) { assert.equal(new URL(calls.at(-1).url).pathname, path); assert.equal(calls.at(-1).method, method); return calls.at(-1).body; }
(async () => {
 api.setApiSession('jwt', 'profile-a');
 await check('US04: auditoria de exclusão preserva snapshot e filtro por transação original', async () => {
   const audits = load('src/services/audit.service.ts'); response = [{ id: 'audit', transacaoId: null, operacao: 'EXCLUSAO', estadoAnterior: { id: 'deleted', descricao: 'Compra antiga', valor: '1.05' }, estadoNovo: null }];
   const result = await audits.getAudits('deleted'); last('/profiles/profile-a/transaction-audits', 'GET'); assert.match(calls.at(-1).url, /transactionId=deleted/); assert.equal(result[0].estadoAnterior.descricao, 'Compra antiga'); assert.equal(result[0].transacaoId, null);
   for (const operation of ['CRIACAO', 'EDICAO', 'EXCLUSAO']) {
     await audits.getAudits(undefined, operation);
     assert.deepEqual(Object.fromEntries(new URL(calls.at(-1).url).searchParams), { operation });
   }
   await audits.getAudits('deleted', 'EXCLUSAO');
   assert.deepEqual(Object.fromEntries(new URL(calls.at(-1).url).searchParams), { transactionId: 'deleted', operation: 'EXCLUSAO' });
   await audits.getAudits(); assert.equal(new URL(calls.at(-1).url).search, '');
 });
 await check('US07/09: CRUD, PATCH sem tipo e vínculo sem nova transação', async () => {
   await budget.getBudgets(); assert.equal(new URL(calls.at(-1).url).search, '');
   await budget.getBudgets({ type: 'EVENTO', active: false, from: '2026-10-01', to: '2026-10-31' });
   assert.deepEqual(Object.fromEntries(new URL(calls.at(-1).url).searchParams), { type: 'EVENTO', active: 'false', from: '2026-10-01', to: '2026-10-31' });
   await budget.getBudgets({ active: true }); assert.equal(new URL(calls.at(-1).url).search, '?active=true');
   const body = { nome: null, tipo: 'EVENTO', dataInicio: '2026-10-01', dataFim: '2026-10-31', categorias: [{ categoriaId: 'category', valorPlanejado: '100.01' }] };
   await budget.saveBudget(body); assert.deepEqual(last('/profiles/profile-a/budgets', 'POST'), body);
   await budget.saveBudget(body, 'budget'); assert.ok(!('tipo' in last('/profiles/profile-a/budgets/budget', 'PATCH')));
   await budget.setBudgetActive('budget', false); assert.deepEqual(last('/profiles/profile-a/budgets/budget', 'PATCH'), { ativo: false });
   await budget.setBudgetActive('budget', true); assert.deepEqual(last('/profiles/profile-a/budgets/budget', 'PATCH'), { ativo: true });
   await budget.linkBudgetTransaction('budget', 'transaction', true); last('/profiles/profile-a/budgets/budget/transactions/transaction', 'PUT');
   await budget.linkBudgetTransaction('budget', 'transaction', false); last('/profiles/profile-a/budgets/budget/transactions/transaction', 'DELETE');
   assert.equal(calls.filter(c => /\/transactions$/.test(c.url)).length, 0);
   response = [{ tipo: 'RECEITA', status: 'EFETIVADA', valor: '100.01' }, { tipo: 'RECEITA', status: 'PREVISTA', valor: '20.02' }, { tipo: 'DESPESA', status: 'EFETIVADA', valor: '999.99' }];
   assert.equal(await budget.getRegisteredBudgetIncome('2026-10-01', '2026-10-31'), '120.03');
   assert.match(calls.at(-1).url, /dataInicial=2026-10-01T00%3A00%3A00Z/);
 });
 await check('US59: aceite só categoria e PATCH somente nome, sem valores do cliente', async () => {
   response = { id: 'challenge', valorMeta: '100.01' };
   const result = await challenge.acceptChallenge('category'); assert.equal(result.valorMeta, '100.01');
   assert.deepEqual(last('/profiles/profile-a/essential-expense-challenges', 'POST'), { categoriaId: 'category' });
   await challenge.renameChallenge('challenge', 'Viagem'); assert.deepEqual(last('/profiles/profile-a/essential-expense-challenges/challenge', 'PATCH'), { nome: 'Viagem' });
   status = 409; await assert.rejects(challenge.acceptChallenge('category'), e => e.status === 409);
 });
 await check('US25/35/58: preservar não calculável, média e período autoritativo', async () => {
   response = { savingsRate: { value: null, calculable: false }, averageDailyBalance: '-1.05' }; assert.equal((await insights.getMetrics()).savingsRate.value, null);
   await insights.getMetrics('2026-01-01', '2026-02-28'); assert.match(calls.at(-1).url, /startDate=2026-01-01&endDate=2026-02-28/);
   response = { referenceQuarter: {}, categories: [{ referenceMonthlyAverage: '1500.00', currentMonthTotal: '1700.00', variationPercentage: null }] };
   assert.equal((await insights.getTrends()).categories[0].referenceMonthlyAverage, '1500.00'); last('/profiles/profile-a/analytics/spending-trends', 'GET');
   response = { completionRate: null, closedGoals: 0 }; assert.equal((await insights.getCompletion('6m')).completionRate, null); assert.match(calls.at(-1).url, /window=6m/);
   await insights.getProjection(); last('/profiles/profile-a/cash-flow/projection', 'GET');
 });
 await check('US52: percentual/base e limpeza condicional ao voltar a limite absoluto', async () => {
   await planning.saveSpendingRule({ tipo: 'PERCENTUAL_RENDA', categoriaId: 'cat', limitCents: 0, percentualLimite: 10, baseCalculo: 'RENDA_PLANEJADA', periodo: 'SEMANAL', canais: ['PUSH'], ativa: true });
   assert.deepEqual(last('/profiles/profile-a/spending-rules', 'POST'), { tipo: 'PERCENTUAL_RENDA', categoriaId: 'cat', valorLimite: null, percentualLimite: 10, baseCalculo: 'RENDA_PLANEJADA', periodo: 'SEMANAL', canais: ['PUSH'], ativa: true });
   await planning.saveSpendingRule({ tipo: 'LIMITE_CATEGORIA', categoriaId: 'cat', limitCents: 105, periodo: 'MENSAL', canais: ['PUSH'], ativa: true }, 'rule');
   assert.equal(calls.at(-1).body.baseCalculo, null); assert.equal(calls.at(-1).body.valorLimite, '1.05');
 });
 await check('US27/31/51: simulação isolada e mensal nullable', async () => {
   const count = calls.length;
   await tools.simulatePurchase({ valor: '100.01', parcelas: 3, dataPrimeiraParcela: '2026-10-20' }); last('/profiles/profile-a/simulations/purchase-impact', 'POST');
   await tools.calculate('opportunity-cost', '100.01', 2, 12); assert.deepEqual(last('/calculations/opportunity-cost', 'POST'), { valorGastoHipotetico: '100.01', taxaRetornoPercentual: 2, quantidadePeriodos: 12 });
   await tools.calculate('compound-interest', '100.01', -1, 0); assert.equal(last('/calculations/compound-interest', 'POST').quantidadePeriodos, 0);
   await tools.savePurchasePlan({ nome: 'Plano', valorTotal: '100.01', valorMensalPlanejado: null, dataInicio: '2026-10-20' }, 'plan'); assert.equal(last('/profiles/profile-a/large-purchase-plans/plan', 'PATCH').valorMensalPlanejado, null);
   assert.ok(calls.slice(count).every(c => !c.url.includes('/transactions')));
 });
 await check('US20: escopo único, essencialidade e ausência de retroatividade', async () => {
   const rule = { categoriaId: null, subcategoriaId: 'sub', atributoAlvo: 'essencialidade', valorDestino: 'ESSENCIAL', ativa: false };
   const count = calls.length; await tools.saveAutomation(rule, 'rule'); assert.deepEqual(last('/profiles/profile-a/automation-rules/rule', 'PATCH'), rule); assert.equal(calls.length, count + 1);
   const transactions = load('src/services/transaction.service.ts');
   const input = { type: 'expense', amountCents: 100, date: '2026-10-01', time: '12:00', description: 'Almoço', categoryId: 'cat', essentiality: null };
   assert.ok(!('essencialidade' in transactions.transactionPayload(input)), 'sem escolha manual, backend pode aplicar automação');
   assert.equal(transactions.transactionPayload({ ...input, essentiality: 'non_essential' }).essencialidade, 'NAO_ESSENCIAL');
 });
 await check('US42: cancelamento, preview sem gravação, arquivo grande e troca de perfil no picker', async () => {
   let count = calls.length; pickerResult = { canceled: true }; assert.equal(await imports.pickImport(), null); assert.equal(calls.length, count);
   pickerResult = { canceled: false, assets: [{ uri: 'file:///test.csv', name: 'test.csv', size: 100 }] }; response = { summary: {}, rows: [] };
   await imports.pickImport(); const form = last('/profiles/profile-a/imports/transactions/preview', 'POST'); assert.equal(form.fields[0][0], 'file'); assert.equal(calls.length, count + 1);
   const multipart = await convertFormDataAsync({ entries: () => form.fields.map(([name, value]) => [name, value]) }, 'audit-boundary');
   const contents = new TextDecoder().decode(multipart.body);
   assert.ok(contents.includes('filename="test.csv"')); assert.ok(contents.includes('Almoço;'));
   pickerResult.assets[0].size = 5 * 1024 * 1024 + 1; count = calls.length; await assert.rejects(imports.pickImport(), e => e.status === 413); assert.equal(calls.length, count);
   pickerResult = async () => { api.setApiSession('jwt', 'profile-b'); return { canceled: true }; };
   await assert.rejects(imports.pickImport(), e => e instanceof api.SessionChangedError); api.setApiSession('jwt', 'profile-a');
   pickerResult = { canceled: false, assets: [{ uri: 'file:///test.csv', name: 'test.csv', size: 100 }] };
   for (const code of [413, 415, 503]) { status = code; await assert.rejects(imports.pickImport(), e => e.status === code && !/imagem|comprovante/i.test(e.message)); }
 });
 await check('US42: confirmação filtra rejeitadas, preserva Z/nulo e pede consentimento de duplicatas', async () => {
   const valid = { rowNumber: 2, status: 'VALID', tipo: 'DESPESA', valor: '1.05', dataHora: '2026-10-01T12:00:00Z', descricao: 'Almoço', categoria: { categoriaId: null }, errors: [], possibleDuplicate: true };
   const preview = { summary: {}, rows: [valid, { ...valid, rowNumber: 3, status: 'REJECTED' }] };
   await imports.confirmImport(preview, false); let body = last('/profiles/profile-a/imports/transactions/confirm', 'POST'); assert.equal(body.rows.length, 1); assert.equal(body.rows[0].categoriaId, null); assert.equal(body.confirmPossibleDuplicates, false); assert.ok(!('rowNumber' in body.rows[0]));
   status = 409; await assert.rejects(imports.confirmImport(preview, false), e => e.status === 409 && /duplicatas/.test(e.message)); status = 201; response = { created: 1, transactionIds: ['t'] }; assert.equal((await imports.confirmImport(preview, true)).created, 1);
 });
 await check('US16/54: payload validado, data impossível/inversão/tipo desconhecido rejeitados', async () => {
   const profileId = '11111111-1111-4111-8111-111111111111';
   assert.equal(push.parsePushContext({ type: 'TRANSACTION_REMINDER', profileId }).profileId, profileId);
   assert.equal(push.parsePushContext({ type: 'SPENDING_LIMIT', profileId, ruleId: profileId }).ruleId, profileId);
   assert.equal(push.parsePushContext({ type: 'WEEKLY_SUMMARY', profileId, periodStart: '2026-10-05', periodEnd: '2026-10-11' }).periodStart, '2026-10-05');
   assert.equal(push.parsePushContext({ type: 'WEEKLY_SUMMARY', profileId, periodStart: '2026-02-30', periodEnd: '2026-03-01' }), null);
   assert.equal(push.parsePushContext({ type: 'WEEKLY_SUMMARY', profileId, periodStart: '2026-10-12', periodEnd: '2026-10-11' }), null);
   assert.equal(push.parsePushContext({ type: 'URL', profileId, url: 'https://example.test' }), null);
   assert.equal(push.parsePushContext({ type: 'TRANSACTION_REMINDER', profileId: 'other' }), null);
 });
 await check('US16/54: registrar/desativar por conta, negativa de permissão e falha preservam controle local', async () => {
   response = { id: 'device', active: true }; await push.registerPush('user');
   assert.deepEqual(last('/me/push-devices', 'POST'), { token: 'ExpoPushToken[test]', platform: 'ANDROID' }); assert.equal(store.get('orca.push-device.user'), 'device');
   status = 503; await assert.rejects(push.deactivatePush('user'), e => e.status === 503 && /notificações/.test(e.message) && !/comprovante/.test(e.message)); assert.equal(store.get('orca.push-device.user'), 'device');
   status = 204; assert.equal(await push.deactivatePush('user'), true); last('/me/push-devices/device', 'DELETE'); assert.ok(!store.has('orca.push-device.user'));
   const beforeAbsent = calls.length; assert.equal(await push.deactivatePush('user'), false); assert.equal(calls.length, beforeAbsent);
   tokenFailure = true; await assert.rejects(push.registerPush('user'), e => e.status === 503 && !/FirebaseApp|stack|token detail/.test(e.message)); assert.ok(!store.has('orca.push-device.user')); tokenFailure = false;
   store.set('orca.push-device.user', 'stale'); status = 404; assert.equal(await push.deactivatePush('user'), true); assert.ok(!store.has('orca.push-device.user'));
   const count = calls.length; permission = false; await assert.rejects(push.registerPush('user'), e => e.status === 403); assert.equal(calls.length, count);
 });
 console.log(`PASS: ${groups} grupos Sprint 2; services reais, rede/provider/picker controlados, sem gravação no banco.`);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { global.fetch = savedFetch; global.FormData = savedFormData; });
