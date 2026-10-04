const assert = require('node:assert/strict');
const createLoader = require('./ts-loader.cjs');
const names = ['Moradia', 'Transporte', 'Alimentação', 'Lazer e Estilo de Vida', 'Saúde e Autocuidado', 'Educação e Carreira', 'Rendas e Investimentos'];
const icons = Object.fromEntries(['IconBook','IconCar','IconHeart','IconHome','IconMovie','IconShoppingCart','IconTag','IconWallet'].map(name => [name, function Icon() {}]));
let permission = { granted: true, canAskAgain: true }; let result = { canceled: true }; let cameraCalls = 0; let galleryCalls = 0; let fallbackSize = 1024;
const load = createLoader({ '@tabler/icons-react-native': icons,
  'expo-image-picker': { requestCameraPermissionsAsync: async () => permission,
    launchCameraAsync: async options => { cameraCalls++; assert.deepEqual(options.mediaTypes, ['images']); return result; },
    launchImageLibraryAsync: async options => { galleryCalls++; assert.equal(options.allowsMultipleSelection, false); return result; } },
  'expo-file-system': { File: class {
    constructor(uri) { this.uri = uri; this.type = uri.endsWith('.png') ? 'image/png' : 'image/jpeg'; }
    get size() { return fallbackSize; }
    async bytes() { return new Uint8Array([1, 2, 3]); }
  } },
});
const api = load('src/services/api-client.ts'); const goals = load('src/services/goal.service.ts');
const dashboard = load('src/services/dashboard.service.ts'); const receipts = load('src/services/receipt.service.ts');
const picker = load('src/services/receipt-picker.service.ts');
const originalFetch = global.fetch; const originalFormData = global.FormData;
const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
let groups = 0;
async function check(name, fn) { await fn(); groups++; console.log('PASS: ' + name); }
(async () => {
  process.env.EXPO_PUBLIC_API_URL = 'http://mobile-final.test'; api.setApiSession('token', 'profile-a');
  await check('catálogo completo: sete ícones distintos, nomes normalizados e fallback neutro', async () => {
    const { categoryPresentation } = load('src/utils/category-presentation.ts');
    assert.equal(new Set(names.map(name => categoryPresentation(name).icon)).size, 7);
    for (const name of names) {
      const p = categoryPresentation(name); assert.equal(typeof p.icon, 'function'); assert.ok(p.color && p.background && p.chart);
      assert.equal(categoryPresentation(` ${name.toUpperCase().normalize('NFD')} `).icon, p.icon);
    }
    assert.equal(categoryPresentation('Categoria futura').icon, icons.IconTag);
    assert.equal(categoryPresentation('').icon, icons.IconTag);
  });
  await check('US10: vazio, leitura dos aportes persistidos e refresh de histórico/progresso', async () => {
    let history = []; let contributed = false; const paths = [];
    global.fetch = async (url, options) => {
      paths.push(url); assert.ok(url.includes('/profiles/profile-a/goals/goal-a'));
      if (options.method === 'POST') {
        const body = JSON.parse(options.body); assert.equal(body.valor, '25.10');
        history = [{ id: 'contribution-a', metaId: 'goal-a', valor: body.valor, dataHora: body.dataHora }]; contributed = true; return json(history[0]);
      }
      if (url.endsWith('/contributions')) return json(history);
      return json({ id: 'goal-a', perfilId: 'profile-a', nome: 'Viagem', valorAlvo: '100.00', valorAcumulado: contributed ? '25.10' : '0.00',
        valorRestante: contributed ? '74.90' : '100.00', percentualProgresso: contributed ? '25.10' : '0.00', frequenciaSugestao: 'DIARIA',
        dataLimite: '2027-10-01', sugestaoAtual: '1.00', atingida: false, vencida: false });
    };
    assert.deepEqual((await goals.getGoalDetail('goal-a')).contributions, []);
    await goals.addGoalContribution({ goalId: 'goal-a', amountCents: 2510, date: '2026-10-01' });
    const detail = await goals.getGoalDetail('goal-a'); assert.equal(detail.goal.currentCents, 2510);
    assert.equal(detail.contributions[0].amountCents, 2510); assert.equal(detail.contributions[0].id, 'contribution-a');
    assert.equal((await goals.getGoalDetail('goal-a')).contributions.length, 1);
    assert.ok(paths.every(path => !path.includes('transactions')));
  });
  await check('dashboard: consultas oficiais de mês atual, anterior e vazio', async () => {
    const periods = [];
    global.fetch = async url => {
      const parsed = new URL(url); periods.push([parsed.searchParams.get('startDate'), parsed.searchParams.get('endDate')]);
      assert.equal(parsed.pathname, '/profiles/profile-a/reports/expenses');
      return json({ categorias: parsed.searchParams.get('startDate') === '2026-08-01' ? [] : [{ categoriaId: 'category-a', nome: 'Moradia', valor: '12.34' }] });
    };
    assert.equal((await dashboard.getRemoteCategorySpending('2026-10'))[0].totalCents, 1234);
    assert.equal((await dashboard.getRemoteCategorySpending('2026-09'))[0].totalCents, 1234);
    assert.deepEqual(await dashboard.getRemoteCategorySpending('2026-08'), []);
    assert.deepEqual(periods, [['2026-10-01','2026-10-31'],['2026-09-01','2026-09-30'],['2026-08-01','2026-08-31']]);
  });
  await check('US12 guarda somente descrição/duração, padrão 48h, sem criar transação nem finalizar item', async () => {
    const reflections = load('src/services/reflection.service.ts'); const calls = [];
    global.fetch = async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return json({ id: 'reflection' }); };
    await reflections.createRemoteReflectionItem(' Compra em espera ');
    assert.deepEqual(calls[0].body, { descricao: 'Compra em espera', duracaoHoras: 48 });
    await reflections.createRemoteReflectionItem('Outra compra', 72); assert.equal(calls[1].body.duracaoHoras, 72);
    assert.ok(calls.every(call => call.url.endsWith('/reflection-items')));
  });
  await check('US19: cancelamento/negação de câmera, galeria sem acesso amplo e JPEG/PNG', async () => {
    assert.equal(await picker.pickReceipt('gallery'), null); assert.equal(galleryCalls, 1);
    permission = { granted: false, canAskAgain: true };
    await assert.rejects(picker.pickReceipt('camera'), /Permita o acesso/); assert.equal(cameraCalls, 0);
    permission.canAskAgain = false; await assert.rejects(picker.pickReceipt('camera'), /configurações/);
    permission.granted = true; result = { canceled: false, assets: [{ uri: 'file:///receipt.jpg', mimeType: 'image/jpeg', fileSize: 1000 }] };
    assert.equal((await picker.pickReceipt('camera')).mimeType, 'image/jpeg');
    result.assets[0] = { uri: 'file:///receipt.png' }; assert.equal((await picker.pickReceipt('gallery')).size, fallbackSize);
    result.assets[0] = { uri: 'file:///receipt.heic', mimeType: 'image/heic', fileSize: 1000 }; await assert.rejects(picker.pickReceipt('gallery'), /JPEG ou PNG/);
    result.assets[0] = { uri: 'file:///receipt.png', mimeType: 'image/png', fileSize: 5 * 1024 * 1024 + 1 }; await assert.rejects(picker.pickReceipt('gallery'), /5 MiB/);
    fallbackSize = 0; result.assets[0] = { uri: 'file:///receipt.png' }; await assert.rejects(picker.pickReceipt('gallery'), /ler a imagem/);
  });
  await check('US19: FormData nativo com um file, JWT, limite exato e erros sem detalhes técnicos', async () => {
    global.FormData = class { constructor() { this.parts = []; } append(...part) { this.parts.push(part); } };
    let sent; global.fetch = async (url, options) => { sent = { url, options }; return json({ id: 'receipt-a' }); };
    const file = { uri: 'file:///receipt.png', name: 'comprovante.png', mimeType: 'image/png', size: 5 * 1024 * 1024 };
    assert.equal((await receipts.uploadReceipt('transaction-a', file)).id, 'receipt-a');
    const [field, uploaded, filename] = sent.options.body.parts[0];
    assert.equal(sent.options.body.parts.length, 1); assert.equal(field, 'file'); assert.equal(filename, file.name);
    assert.equal(uploaded.uri, file.uri); assert.equal(uploaded.type, file.mimeType);
    // Expo SDK 57 serializa Blob/File com bytes(); rejeita o objeto legado { uri }.
    assert.deepEqual(await uploaded.bytes(), new Uint8Array([1, 2, 3]));
    assert.equal(sent.options.headers['Content-Type'], undefined); assert.equal(sent.options.headers.Authorization, 'Bearer token');
    assert.ok(sent.url.endsWith('/transactions/transaction-a/receipts'));
    await assert.rejects(async () => receipts.uploadReceipt('transaction-a', { ...file, uri: 'https://old-url.test/receipt.png' }), /galeria/);
    await assert.rejects(async () => receipts.uploadReceipt('transaction-a', { ...file, size: file.size + 1 }), /5 MiB/);
    for (const [status, text] of [[413,/5 MiB/],[415,/JPEG ou PNG/],[502,/enviar o comprovante/],[503,/indisponível/]]) {
      global.fetch = async () => new Response('Cloudinary secret stack', { status }); await assert.rejects(receipts.uploadReceipt('transaction-a', file), text);
    }
    let resolve; global.fetch = () => new Promise(done => { resolve = done; });
    const pending = receipts.uploadReceipt('transaction-a', file); await new Promise(setImmediate);
    api.setApiSession('token', 'profile-b'); resolve(json({ id: 'obsolete' }));
    await assert.rejects(pending, api.SessionChangedError);
  });
  await check('US19: falha do upload após salvar despesa informa gravação parcial, sem segundo POST financeiro', async () => {
    api.setApiSession('token', 'profile-a'); global.FormData = originalFormData;
    const transactions = load('src/services/transaction.service.ts'); const calls = [];
    global.fetch = async (url, options) => {
      calls.push(url);
      if (url.endsWith('/receipts')) return new Response('', { status: 503 });
      return json({ id: 'saved-transaction' });
    };
    const input = { type: 'expense', amountCents: 1000, date: '2026-10-01', time: '12:00', description: 'Despesa', categoryId: 'category-a',
      receiptFile: { uri: 'blob:receipt', name: 'receipt.png', mimeType: 'image/png', size: 8, webFile: new Blob(['pngbytes'], { type: 'image/png' }) } };
    await assert.rejects(transactions.createTransaction(input), error => error instanceof transactions.PartialTransactionWriteError && error.transactionId === 'saved-transaction');
    assert.equal(calls.filter(url => url.endsWith('/transactions')).length, 1);
    calls.length = 0;
    await assert.rejects(transactions.createTransaction({ ...input, receiptFile: { ...input.receiptFile, size: 6 * 1024 * 1024 } }), /5 MiB/);
    assert.equal(calls.length, 0, 'Arquivo inválido não cria uma despesa');
  });
  console.log(`${groups} grupos de correções mobile passaram.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; global.FormData = originalFormData; });
