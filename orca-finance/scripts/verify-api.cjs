const assert = require('node:assert/strict');
const load = require('./ts-loader.cjs')();
const client = load('src/services/api-client.ts');
const auth = load('src/services/auth.service.ts');
const transactions = load('src/services/transaction.service.ts');
const currency = load('src/utils/currency.ts');
const dates = load('src/utils/date.ts');
const recurrence = load('src/services/recurrence.service.ts');
const originalFetch = global.fetch;
process.env.EXPO_PUBLIC_API_URL = 'http://api.example.test';
let assertions = 0;
async function check(name, test) { await test(); assertions++; console.log(`PASS: ${name}`); }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const categories = [{ id: 'category-a', nome: 'Alimentação', ativa: true }];
const detail = { id: 'transaction-a', perfilId: 'profile-a', tipo: 'DESPESA', valor: '10.29',
  dataHora: '2026-09-01T12:42:37.123Z', descricao: 'Mercado', anotacao: 'Nota distinta', categoriaId: 'category-a',
  subcategoriaId: null, metodoPagamento: 'PIX', essencialidade: 'NAO_CLASSIFICADA', ehGastoLivre: false,
  status: 'EFETIVADA', recorrenciaId: null, tags: [{ id: 'tag-a', nome: 'viagem' }],
  recibos: [{ id: 'receipt-a', arquivoUrl: 'https://example.test/r.pdf', mimeType: 'application/pdf' }] };
function activate(profile = 'profile-a', token = 'unit-token') { client.setApiSession(token, profile); }
async function main() {
  await check('dinheiro exato, sinais, limites e payload decimal', async () => {
    for (const [value, cents] of [['0', 0], ['0.01', 1], ['10.29', 1029], ['-1.20', -120], ['90071992547409.91', Number.MAX_SAFE_INTEGER]]) {
      assert.equal(currency.decimalToCents(value), cents); assert.equal(currency.decimalToCents(currency.centsToDecimal(cents)), cents);
    }
    assert.throws(() => currency.decimalToCents('90071992547409.92'));
    assert.throws(() => currency.decimalToCents('R$ 10,29'));
    assert.throws(() => currency.decimalToCents('1.001'));
    assert.throws(() => currency.centsToDecimal(1.5));
    assert.equal(currency.formatCurrency(Number.MAX_SAFE_INTEGER).replace(/\s/g, ' '), 'R$ 90.071.992.547.409,91');
    assert.equal(currency.formatCurrency(-1).replace(/\s/g, ' '), '-R$ 0,01');
  });
  await check('timestamps UTC/local, dia completo e filtros no contrato real', async () => {
    const iso = dates.localDateTimeToISO('2026-10-02', '23:59');
    assert.deepEqual(dates.timestampToLocal(iso), { date: '2026-10-02', time: '23:59' });
    assert.equal(Date.parse(dates.filterDateBoundary('2026-10-02', true)) + 1, Date.parse(dates.filterDateBoundary('2026-10-03')));
    assert.throws(() => dates.localDateTimeToISO('2026-02-30', '12:00'));
    const query = new URLSearchParams(transactions.transactionQuery('  Mercado  ', { amountCents: 1029, paymentMethod: 'credit_card', categoryId: 'category-a' }));
    assert.equal(query.get('valor'), '10.29'); assert.equal(query.get('metodoPagamento'), 'CARTAO_CREDITO');
    assert.equal(query.get('descricao'), 'Mercado'); assert.equal(query.get('categoriaId'), 'category-a');
    assert.equal(query.has('valorMinimo'), false);
  });
  await check('cadastro -> login -> me/perfis; perfil único automático e múltiplos explícitos', async () => {
    client.setApiSession(null, null); let profiles = [{ id: 'profile-a', nome: 'Ana', moedaBase: 'BRL' }]; const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/auth/register')) return json({ user: { id: 'user-a' } }, 201);
      if (url.endsWith('/auth/login')) return json({ accessToken: 'unit-token' });
      assert.equal(options.headers.Authorization, 'Bearer unit-token');
      return url.endsWith('/me') ? json({ id: 'user-a', nome: 'Ana', email: 'ana@example.test' }) : json(profiles);
    };
    const session = await auth.signUp(' Ana ', ' ANA@example.test ', 'unit-only-password');
    assert.equal(session.activeProfileId, 'profile-a'); assert.equal(session.account.email, 'ana@example.test');
    assert.deepEqual(JSON.parse(calls[0].options.body), { nome: 'Ana', email: 'ana@example.test', senha: 'unit-only-password' });
    profiles = [...profiles, { id: 'profile-b', nome: 'Trabalho', moedaBase: 'BRL' }];
    assert.equal((await auth.signIn('ana@example.test', 'unit-only-password')).activeProfileId, null);
    assert.equal(client.getApiSession().token, null); // só o contexto confirma a sessão completa.
  });
  await check('duplicidade, credenciais inválidas e cadastro com login posterior falhando', async () => {
    global.fetch = async () => json({ message: 'Prisma stack trace' }, 409);
    await assert.rejects(auth.signUp('Ana', 'ana@example.test', 'x'), error => error.status === 409 && /e-mail/.test(error.message));
    global.fetch = async () => json({}, 401);
    await assert.rejects(auth.signIn('ana@example.test', 'x'), /senha inválidos/);
    global.fetch = async url => url.endsWith('/auth/register') ? json({}, 201) : json({}, 500);
    await assert.rejects(auth.signUp('Ana', 'ana@example.test', 'x'), /Conta criada/);
  });
  await check('erros HTTP seguros, rede, 204 e URL configurável sem localhost automático', async () => {
    activate();
    for (const status of [400, 403, 404, 409, 500]) {
      global.fetch = async () => json({ message: 'Prisma PostgreSQL password stack trace' }, status);
      await assert.rejects(client.apiRequest('/anything'), error => error.status === status && !/Prisma|PostgreSQL|password|stack/.test(error.message));
    }
    global.fetch = async () => { throw new Error('network credential detail'); };
    await assert.rejects(client.apiRequest('/anything'), /conectar ao serviço/);
    global.fetch = async () => new Response(null, { status: 204 });
    assert.equal(await client.apiRequest('/anything', { method: 'DELETE' }), undefined);
    delete process.env.EXPO_PUBLIC_API_URL;
    await assert.rejects(client.apiRequest('/anything'), /serviço não está configurado/);
    process.env.EXPO_PUBLIC_API_URL = 'http://api.example.test';
  });
  await check('401 encerra sessão; token antigo não derruba sessão nova', async () => {
    activate(); let unauthorized = 0; client.handleUnauthorized(() => unauthorized++);
    global.fetch = async () => json({}, 401);
    await assert.rejects(client.apiRequest('/protected'), error => error.status === 401);
    assert.equal(client.getApiSession().token, null); assert.equal(unauthorized, 1);
    activate(); let resolve;
    global.fetch = () => new Promise(done => { resolve = done; });
    const pending = client.apiRequest('/protected'); activate('profile-b', 'new-token'); resolve(json({}, 401));
    await assert.rejects(pending, client.SessionChangedError);
    assert.equal(client.getApiSession().token, 'new-token'); assert.equal(unauthorized, 1); client.handleUnauthorized();
  });
  await check('requisição pendente descartada ao trocar perfil ou sair; sem geração local remota', async () => {
    activate(); let resolve;
    global.fetch = () => new Promise(done => { resolve = done; });
    const pending = client.apiRequest('/profiles/profile-a/transactions');
    let done = false; pending.finally(() => { done = true; }).catch(() => {}); await Promise.resolve(); assert.equal(done, false);
    activate('profile-b'); resolve(json([detail])); await assert.rejects(pending, client.SessionChangedError);
    assert.throws(() => client.profilePath('tags', 'profile-a'), client.SessionChangedError);
    const mock = load('src/data/mocks/transactions.mock.ts').transactionsMock;
    const before = JSON.stringify(mock); load('src/services/recurrence.mock-service.ts').processRecurrences('2099-12-31'); assert.equal(JSON.stringify(mock), before);
    client.setApiSession(null, null); assert.throws(() => client.profilePath('transactions'), error => error.status === 401);
  });
  await check('troca de conta durante parsing JSON não devolve resposta da conta anterior', async () => {
    activate(); let parse;
    global.fetch = async () => ({ ok: true, status: 200, json: () => new Promise(resolve => { parse = resolve; }) });
    const pending = client.apiRequest('/protected'); await Promise.resolve(); await Promise.resolve();
    client.setApiSession(null, null); parse({ private: 'old account' });
    await assert.rejects(pending, client.SessionChangedError);
  });
  await check('detalhe adapta Decimal/enums/tags/recibo e preserva snapshot em edição parcial', async () => {
    activate(); let patch; let put = 0;
    global.fetch = async (url, options) => {
      if (url.endsWith('/categories')) return json(categories);
      if (url.endsWith('/subcategories')) return json([]);
      if (options.method === 'PATCH') { patch = JSON.parse(options.body); return json({ ...detail, ...patch }); }
      if (options.method === 'PUT') put++;
      return json(detail);
    };
    const item = await transactions.getTransactionById(detail.id);
    assert.equal(item.amountCents, 1029); assert.equal(item.essentiality, 'unclassified'); assert.equal(item.notes, 'Nota distinta');
    assert.deepEqual(item.tags, ['viagem']); assert.equal(item.receipts[0].mimeType, 'application/pdf');
    await transactions.updateTransaction(item.id, { ...item, notes: 'Nova anotação' }, item);
    assert.deepEqual(patch, { anotacao: 'Nova anotação' }); assert.equal(put, 0);
    assert.equal(item.timestamp, detail.dataHora);
  });
  await check('tags: resolver pelo perfil, remover com PUT vazio e não inventar TransacaoTag', async () => {
    activate(); let association; let patch;
    global.fetch = async (url, options) => {
      if (url.endsWith('/categories')) return json(categories);
      if (url.endsWith('/subcategories')) return json([]);
      if (options.method === 'PUT') { association = JSON.parse(options.body); return json({ tags: [] }); }
      if (options.method === 'PATCH') { patch = JSON.parse(options.body); return json(detail); }
      if (url.endsWith('/tags')) return json(detail.tags);
      return json(detail);
    };
    const item = await transactions.getTransactionById(detail.id);
    await transactions.updateTransaction(item.id, { ...item, tags: [] }, item);
    assert.deepEqual(association, { tagIds: [] });
    const generated = { ...item, categoryId: null, recurrenceId: 'recurrence-a' };
    await transactions.updateTransaction(generated.id, { ...generated, tags: [] }, generated);
    assert.deepEqual(association, { tagIds: [] });
    await transactions.updateTransaction(generated.id, { ...generated, notes: 'Mudança escalar' }, generated);
    assert.deepEqual(patch, { anotacao: 'Mudança escalar' });
  });
  await check('falha complementar após POST não repete criação; revisão invalida gravações posteriores', async () => {
    activate(); let creates = 0;
    global.fetch = async (url, options) => {
      if (url.endsWith('/tags')) return json(detail.tags);
      if (options.method === 'POST' && url.endsWith('/transactions')) { creates++; return json(detail, 201); }
      if (options.method === 'PUT') return json({}, 500);
      throw new Error('Unexpected request');
    };
    const input = { type: 'expense', amountCents: 1029, date: '2026-09-01', time: '12:42', description: 'Mercado', categoryId: 'category-a', tags: ['viagem'] };
    await assert.rejects(transactions.createTransaction(input), error => error instanceof transactions.PartialTransactionWriteError && error.transactionId === detail.id);
    assert.equal(creates, 1);
  });
  console.log(`PASS: ${assertions} grupos de verificações HTTP e domínio.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; client.setApiSession(null, null); });
