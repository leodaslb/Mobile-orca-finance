// Services mobile -> fetch HTTP real -> Nest/Fastify -> Neon. Não usa a conta Leonardo.
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const backend = path.resolve(__dirname, '../../backend');
require(path.join(backend, 'node_modules/dotenv')).config({ path: path.join(backend, '.env'), quiet: true });
require(path.join(backend, 'node_modules/reflect-metadata'));
process.env.NODE_ENV = 'test'; // nenhum scheduler gera ocorrências fora das fixtures.
process.env.TZ = 'America/Sao_Paulo';
const { NestFactory } = require(path.join(backend, 'node_modules/@nestjs/core'));
const { FastifyAdapter } = require(path.join(backend, 'node_modules/@nestjs/platform-fastify'));
const { AppModule } = require(path.join(backend, 'dist/app.module'));
const { configureApp } = require(path.join(backend, 'dist/common/configure-app'));
const { PrismaService } = require(path.join(backend, 'dist/database/prisma.service'));
const { CloudinaryStorageService } = require(path.join(backend, 'dist/modules/transactions/cloudinary-storage.service'));
const receiptBytes = require('node:fs').readFileSync(path.join(backend, 'test/fixtures/receipt.png'));
const load = require('./ts-loader.cjs')();
const client = load('src/services/api-client.ts');
const auth = load('src/services/auth.service.ts');
const transactions = load('src/services/transaction.service.ts');
const categories = load('src/services/category.service.ts');
const recurrence = load('src/services/recurrence.service.ts');
const { RecurrencesService } = require(path.join(backend, 'dist/modules/recurrences/recurrences.service'));
const dashboard = load('src/services/dashboard.service.ts');
const dates = load('src/utils/date.ts');
const emails = [`mobile-a-${randomUUID()}@example.test`, `mobile-b-${randomUUID()}@example.test`];
const password = 'mobile-test-only-password';
let app; let prisma; let groups = 0;
async function check(name, operation) { await operation(); groups++; console.log(`PASS: ${name}`); }
function activate(session, profile = session.activeProfileId) { client.setApiSession(session.accessToken, profile); }
// Somente o provider externo é substituído. Multipart/HTTP/Neon continuam reais.
async function uploadReceipt(transactionId) {
  const receipts = load('src/services/receipt.service.ts');
  return receipts.uploadReceipt(transactionId, { uri: 'blob:node-test', name: 'receipt.png', mimeType: 'image/png',
    size: receiptBytes.length, webFile: new Blob([receiptBytes], { type: 'image/png' }) });
}
async function counts() {
  const models = ['usuario', 'perfilFinanceiro', 'transacao', 'tag', 'transacaoTag', 'auditoriaTransacao',
    'subcategoria', 'recorrencia', 'lembreteVencimento', 'anexoTransacao', 'meta', 'aporteMeta'];
  return Object.fromEntries(await Promise.all(models.map(async model => [model, await prisma[model].count()])));
}
async function cleanup() {
  client.setApiSession(null, null);
  if (!prisma) return;
  const users = await prisma.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
  if (!users.length) return;
  const userIds = users.map(row => row.id);
  const profiles = await prisma.perfilFinanceiro.findMany({ where: { usuarioId: { in: userIds } }, select: { id: true } });
  const where = { perfilId: { in: profiles.map(row => row.id) } };
  await prisma.$transaction(async tx => {
    await tx.aporteMeta.deleteMany({ where: { meta: where } });
    for (const model of ['lembreteVencimento', 'transacao', 'auditoriaTransacao', 'recorrencia', 'tag', 'subcategoria', 'meta']) {
      await tx[model].deleteMany({ where });
    }
    await tx.perfilFinanceiro.deleteMany({ where: { usuarioId: { in: userIds } } });
    await tx.usuario.deleteMany({ where: { id: { in: userIds } } });
  });
}
async function main() {
  app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
  const storage = app.get(CloudinaryStorageService);
  storage.uploadReceipt = async () => ({ publicId: `orca-finance/receipts/${randomUUID()}`, secureUrl: 'https://res.cloudinary.com/test/image/upload/mobile-fixture.png' });
  storage.removeReceipt = async () => undefined;
  configureApp(app); await app.listen(0, '127.0.0.1');
  const port = app.getHttpAdapter().getInstance().server.address().port;
  process.env.EXPO_PUBLIC_API_URL = `http://127.0.0.1:${port}`;
  prisma = app.get(PrismaService);
  const beforeCounts = await counts();
  const leonardoId = '5c7d6752-8916-47bb-9895-0c719b239918';
  const beforeLeonardo = await prisma.usuario.findUnique({ where: { id: leonardoId },
    select: { id: true, senhaHash: true, updatedAt: true, perfis: { select: { id: true, nome: true, moedaBase: true } } } });
  let a; let b; let secondProfile; let catalog; let item;
  try {
    await check('US60 cadastro válido, login, conta/perfil BRL vazio e dashboard zero', async () => {
      a = await auth.signUp('Mobile A', emails[0], password); activate(a);
      assert.equal(a.profiles.length, 1); assert.equal(a.profiles[0].moedaBase, 'BRL');
      assert.equal(a.account.name, 'Mobile A'); assert.equal((await transactions.getTransactions()).length, 0);
      const data = await dashboard.getRemoteDashboardData(); assert.equal(data.balanceCents, 0); assert.equal(data.currentMonthExpensesCents, 0);
    });
    await check('US60 e-mail duplicado, senha inválida e login válido', async () => {
      await assert.rejects(auth.signUp('Duplicada', emails[0], password), error => error.status === 409);
      await assert.rejects(auth.signIn(emails[0], 'incorrect-test-password'), error => error.status === 401);
      a = await auth.signIn(emails[0], password); activate(a); assert.ok(a.accessToken);
    });
    await check('US01 payload, categoria/subcategoria reais, centavos, nota, tags e UUID', async () => {
      catalog = await categories.getTransactionCatalog(); assert.equal(catalog.categories.length, 7);
      await categories.createRemoteSubcategory(catalog.categories[0].id, 'Mobile fixture');
      catalog = await categories.getTransactionCatalog();
      const local = dates.timestampToLocal(new Date(Date.now() - 60000).toISOString());
      item = await transactions.createTransaction({ type: 'expense', amountCents: 1029, ...local,
        description: 'Compra integração mobile', notes: 'Anotação separada', categoryId: catalog.categories[0].id,
        subcategoryId: catalog.subcategories[0].id, paymentMethod: 'pix', essentiality: 'unclassified', tags: ['mobile-fixture', 'organização'] });
      assert.match(item.id, /^[0-9a-f-]{36}$/i); assert.equal(item.amountCents, 1029); assert.equal(item.essentiality, 'unclassified');
      assert.equal(item.subcategoryName, 'Mobile fixture'); assert.deepEqual([...item.tags].sort(), ['mobile-fixture', 'organização'].sort());
    });
    await check('US02 detalhe UUID, tags, anotação, recibo PNG multipart e 404', async () => {
      await uploadReceipt(item.id);
      item = await transactions.getTransactionById(item.id);
      assert.equal(item.notes, 'Anotação separada'); assert.equal(item.receipts[0].mimeType, 'image/png');
      await assert.rejects(transactions.getTransactionById(randomUUID()), error => error.status === 404);
    });
    await check('US03 busca e filtros combinados por dia/categoria/valor/pagamento no perfil ativo', async () => {
      const rows = await transactions.getTransactions('integração', { startDate: item.date, endDate: item.date,
        categoryId: item.categoryId, amountCents: 1029, paymentMethod: 'pix' });
      assert.deepEqual(rows.map(row => row.id), [item.id]);
      assert.equal((await transactions.getTransactions('integração', { amountCents: 1030 })).length, 0);
    });
    await check('US02 edição parcial preserva timestamp/status/recibo; remover tags não cria snapshot com tags', async () => {
      const before = await prisma.transacao.findUniqueOrThrow({ where: { id: item.id } });
      item = await transactions.updateTransaction(item.id, { ...item, notes: 'Nota editada', tags: [] }, item);
      assert.equal(item.notes, 'Nota editada'); assert.deepEqual(item.tags, []); assert.equal(item.receipts.length, 1);
      const after = await prisma.transacao.findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(after.dataHora.toISOString(), before.dataHora.toISOString()); assert.equal(after.status, before.status);
      const audits = await prisma.auditoriaTransacao.findMany({ where: { transacaoId: item.id } });
      assert.equal(audits.length, 2);
      for (const audit of audits) for (const snapshot of [audit.estadoAnterior, audit.estadoNovo]) {
        if (snapshot) { assert.equal('tags' in snapshot, false); assert.equal('recibos' in snapshot, false); }
      }
    });
    await check('perfil único automático, múltiplos sem escolha arbitrária e isolamento entre contas', async () => {
      secondProfile = await client.apiRequest('/profiles', { method: 'POST', body: { nome: 'Mobile A secundário' } });
      const multiple = await auth.signIn(emails[0], password); assert.equal(multiple.activeProfileId, null);
      activate(a, secondProfile.id); assert.equal((await transactions.getTransactions()).length, 0);
      b = await auth.signUp('Mobile B', emails[1], password); activate(b);
      assert.equal((await transactions.getTransactions()).length, 0);
      await assert.rejects(client.apiRequest(`/profiles/${a.activeProfileId}/transactions/${item.id}`), error => error.status === 404 || error.status === 403);
      activate(a);
    });
    await check('recorrência/lembrete: configuração remota, geração no servidor e vínculo real', async () => {
      const next = new Date(); next.setDate(next.getDate() + 35);
      const future = dates.localDate(next);
      const manual = await transactions.createTransaction({ ...item, description: 'Recorrência mobile fixture', tags: [] }, {
        recurring: true, frequency: 'monthly', nextOccurrence: future, reminder: true, dueDate: future, reminderTime: '09:30',
      });
      assert.equal(manual.recurrenceId, null); // contrato: manual independente, sem FK inventada.
      const recs = await client.apiRequest(client.profilePath('recurrences')); assert.equal(recs.length, 1);
      const generated = (await transactions.getTransactions()).find(row => row.recurrenceId === recs[0].id);
      assert.ok(generated); assert.equal(generated.status, 'scheduled');
      const reminders = await client.apiRequest(client.profilePath('reminders')); assert.equal(reminders.length, 1);
      assert.equal(reminders[0].recorrenciaId, recs[0].id);
      await recurrence.updateRemoteRecurrence(recs[0], { recurring: false, frequency: 'monthly', nextOccurrence: future, reminder: false, dueDate: null });
      assert.equal((await recurrence.getRemoteRecurrence(recs[0].id)).ativa, false);
      // Ocorrência gerada mantém categoria opcional durante a edição escalar.
      const noCategory = await client.apiRequest(client.profilePath('recurrences'), { method: 'POST', body: {
        tipoTransacao: 'DESPESA', valor: '5.00', descricao: 'Ocorrência sem categoria mobile', frequencia: 'MENSAL',
        proximaOcorrencia: dates.localDateTimeToISO(future, '10:00'),
      } });
      const occurrence = (await transactions.getTransactions()).find(row => row.recurrenceId === noCategory.id);
      assert.equal(occurrence.categoryId, null);
      const detail = await transactions.getTransactionById(occurrence.id);
      const tagged = await transactions.updateTransaction(detail.id, { ...detail, tags: ['mobile-fixture'] }, detail);
      assert.equal(tagged.categoryId, null); assert.deepEqual(tagged.tags, ['mobile-fixture']);
      const edited = await transactions.updateTransaction(detail.id, { ...tagged, notes: 'Mudança escalar sem categoria' }, tagged);
      assert.equal(edited.notes, 'Mudança escalar sem categoria'); assert.equal(edited.categoryId, null); assert.equal(edited.freeSpending, false); assert.equal(edited.recurrenceId, noCategory.id);
      assert.equal(edited.timestamp, detail.timestamp); assert.equal(edited.status, detail.status);
    });
    await check('US05 subcategoria real: criar, editar, desativar, reativar, duplicidade e ownership', async () => {
      const catalog = await categories.getTransactionCatalog();
      const sub = await categories.createRemoteSubcategory(catalog.categories[0].id, 'Closing subcategory');
      await categories.updateRemoteSubcategory(sub.id, { name: 'Closing editada', active: false });
      let current = (await categories.getTransactionCatalog()).subcategories.find(row => row.id === sub.id);
      assert.equal(current.active, false); assert.equal(current.name, 'Closing editada');
      await categories.updateRemoteSubcategory(sub.id, { active: true });
      await assert.rejects(categories.createRemoteSubcategory(catalog.categories[0].id, 'Closing editada'), error => error.status === 409);
      await assert.rejects(categories.updateRemoteSubcategory(sub.id, { name: '   ' }), error => error.status === 400);
      activate(b, a.activeProfileId);
      await assert.rejects(categories.updateRemoteSubcategory(sub.id, { active: false }), error => error.status === 403);
      activate(a, a.activeProfileId);
    });
    await check('US24 três frequências, término, edição futura, lembrete e materialização idempotente', async () => {
      const catalog = await categories.getTransactionCatalog();
      const reference = new Date(Date.now() + 5 * 86400000); reference.setHours(12, 0, 0, 0);
      for (const frequency of ['SEMANAL', 'MENSAL', 'ANUAL']) {
        const rec = await client.apiRequest(client.profilePath('recurrences'), { method: 'POST', body: {
          tipoTransacao: 'DESPESA', valor: '10.29', descricao: `Closing ${frequency}`, categoriaId: catalog.categories[0].id,
          frequencia: frequency, proximaOcorrencia: reference.toISOString(), dataTermino: '2099-12-31',
        } });
        assert.equal((await recurrence.getRemoteRecurrence(rec.id)).frequencia, frequency);
        await app.get(RecurrencesService).processDue(reference, a.activeProfileId);
        await app.get(RecurrencesService).processDue(reference, a.activeProfileId);
        const occurrence = await prisma.transacao.findMany({ where: { perfilId: a.activeProfileId, recorrenciaId: rec.id, ocorrenciaReferencia: reference } });
        assert.equal(occurrence.length, 1); assert.equal(occurrence[0].status, 'EFETIVADA');
        const historical = JSON.stringify(occurrence[0]);
        const current = await recurrence.getRemoteRecurrence(rec.id);
        await recurrence.updateRemoteRecurrence(current, { ...recurrence.recurrenceConfiguration(current), frequency: 'weekly', endDate: '2098-12-31', description: `Closing editada ${frequency}`, amountCents: 2029 });
        assert.equal((await recurrence.getRemoteRecurrence(rec.id)).dataTermino, '2098-12-31');
        const planned = await prisma.transacao.findMany({ where: { perfilId: a.activeProfileId, recorrenciaId: rec.id, status: 'PREVISTA' } });
        assert.ok(planned.length > 0); assert.ok(planned.every(row => row.valor.toString() === '20.29' && row.descricao === `Closing editada ${frequency}`));
        assert.equal(JSON.stringify(await prisma.transacao.findUnique({ where: { id: occurrence[0].id } })), historical);
        await recurrence.updateRemoteRecurrence(await recurrence.getRemoteRecurrence(rec.id), { ...recurrence.recurrenceConfiguration(await recurrence.getRemoteRecurrence(rec.id)), recurring: false });
        assert.equal(await prisma.transacao.count({ where: { perfilId: a.activeProfileId, recorrenciaId: rec.id, status: 'PREVISTA' } }), 0);
      }
      const reminders = await recurrence.getRemoteReminders();
      const reminder = reminders[0]; assert.ok(reminder);
      await recurrence.updateRemoteReminder(reminder.id, { active: false });
      assert.equal((await recurrence.getRemoteReminders()).find(row => row.id === reminder.id).ativo, false);
      await uploadReceipt(item.id);
      assert.ok((await transactions.getTransactionById(item.id)).receipts.some(row => row.mimeType === 'image/png'));
      activate(b, a.activeProfileId);
      await assert.rejects(recurrence.getRemoteRecurrences(), error => error.status === 403);
      await assert.rejects(recurrence.getRemoteReminders(), error => error.status === 403);
      activate(a, a.activeProfileId);
    });
    await check('dashboard real após mutações; reversão HTTP remove associações/recibo e mantém tags/auditoria', async () => {
      const before = await dashboard.getRemoteDashboardData();
      item = await transactions.updateTransaction(item.id, { ...item, tags: ['mobile-fixture'] }, item);
      await transactions.reverseTransaction(item.id);
      const after = await dashboard.getRemoteDashboardData(); assert.equal(after.balanceCents - before.balanceCents, 1029);
      assert.equal((await transactions.getTransactions()).some(row => row.id === item.id), false);
      await assert.rejects(transactions.getTransactionById(item.id), error => error.status === 404);
      assert.equal(await prisma.transacaoTag.count({ where: { transacaoId: item.id } }), 0);
      assert.equal(await prisma.anexoTransacao.count({ where: { transacaoId: item.id } }), 0);
      assert.equal(await prisma.tag.count({ where: { perfilId: a.activeProfileId } }), 2);
      const audit = await prisma.auditoriaTransacao.findFirstOrThrow({ where: { perfilId: a.activeProfileId, operacao: 'EXCLUSAO',
        estadoAnterior: { path: ['id'], equals: item.id } } });
      assert.equal(audit.estadoAnterior.id, item.id); assert.equal('tags' in audit.estadoAnterior, false);
    });
    await check('token inválido/401 limpa sessão; login posterior continua funcionando', async () => {
      client.setApiSession('invalid-test-token', a.activeProfileId);
      await assert.rejects(transactions.getTransactions(), error => error.status === 401 || error instanceof client.SessionChangedError);
      assert.equal(client.getApiSession().token, null);
      a = await auth.signIn(emails[0], password); activate(a, a.profiles[0].id); assert.ok((await transactions.getTransactions()).length);
    });
  } finally { await cleanup(); }
  await check('Neon sem resíduos; Leonardo, perfis e quantidades preservados', async () => {
    assert.deepEqual(await counts(), beforeCounts);
    const afterLeonardo = await prisma.usuario.findUnique({ where: { id: leonardoId },
      select: { id: true, senhaHash: true, updatedAt: true, perfis: { select: { id: true, nome: true, moedaBase: true } } } });
    assert.deepEqual(afterLeonardo, beforeLeonardo);
    assert.equal(await prisma.usuario.count({ where: { email: { in: emails } } }), 0);
  });
  console.log(`PASS: ${groups} grupos de integração mobile HTTP -> Neon. Fixtures removidas.`);
}
main().catch(error => { console.error(`FAIL: integração mobile (${error instanceof client.ApiError ? error.message : error.name}).`); process.exitCode = 1; })
  .finally(async () => {
    try { await cleanup(); } catch (error) { console.error(`FAIL: limpeza das fixtures (${error.name}).`); process.exitCode = 1; }
    finally { await app?.close(); }
  });
