// Serviços mobile reais → fetch HTTP real → Nest/Fastify → PostgreSQL configurado.
// Contas UUID exclusivas; não executa seed, migrations, jobs ou envio externo.
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const backend = path.resolve(__dirname, '../../backend');
require(path.join(backend, 'node_modules/dotenv')).config({ path: path.join(backend, '.env'), quiet: true });
require(path.join(backend, 'node_modules/reflect-metadata'));
process.env.NODE_ENV = 'test';
const { Test } = require(path.join(backend, 'node_modules/@nestjs/testing'));
const { FastifyAdapter } = require(path.join(backend, 'node_modules/@nestjs/platform-fastify'));
const { AppModule } = require(path.join(backend, 'dist/app.module'));
const { configureApp } = require(path.join(backend, 'dist/common/configure-app'));
const { Clock } = require(path.join(backend, 'dist/common/clock'));
const { PrismaService } = require(path.join(backend, 'dist/database/prisma.service'));
const { PushProvider } = require(path.join(backend, 'dist/modules/notifications/push.provider'));
const csv = 'tipo;valor;data_hora;descricao;categoria\nDESPESA;1.05;2026-10-23T12:00:00;Almoço importado;';
const load = require('./ts-loader.cjs')({
  // Só a escolha do arquivo é controlada. FormData, fetch, parser e persistência são reais.
  'expo-document-picker': { getDocumentAsync: async () => ({ canceled: false, assets: [{ name: 'audit.csv', size: Buffer.byteLength(csv), file: new Blob([csv], { type: 'text/csv' }) }] }) },
  'expo-file-system': { File: class {} },
  'react-native': { Platform: { OS: 'web' } },
});
const client = load('src/services/api-client.ts');
const auth = load('src/services/auth.service.ts');
const budgets = load('src/services/budget.service.ts');
const tools = load('src/services/planning-tools.service.ts');
const insights = load('src/services/insight.service.ts');
const challenges = load('src/services/challenge.service.ts');
const imports = load('src/services/import.service.ts');
const audits = load('src/services/audit.service.ts');
const planning = load('src/services/planning.service.ts');
const emails = [0, 1].map(() => `s2-mobile-${randomUUID()}@example.test`);
let app, db, groups = 0;
const activate = (session, profile = session.activeProfileId) => client.setApiSession(session.accessToken, profile);
const check = async (name, operation) => { await operation(); groups++; console.log(`PASS: ${name}`); };
async function cleanup() {
  client.setApiSession(null, null);
  if (!db) return;
  const users = await db.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
  if (!users.length) return;
  const usuarioId = { in: users.map(user => user.id) };
  const profiles = await db.perfilFinanceiro.findMany({ where: { usuarioId }, select: { id: true } });
  const perfilId = { in: profiles.map(profile => profile.id) };
  // A limpeza se limita às duas contas criadas por esta execução.
  await db.$transaction(async tx => {
    await tx.regraGastoCanal.deleteMany({ where: { regraGasto: { perfilId } } });
    for (const model of ['transacao', 'auditoriaTransacao', 'desafioEconomia', 'regraAutomacao', 'regraGasto', 'planoGrandeCompra']) await tx[model].deleteMany({ where: { perfilId } });
    await tx.orcamentoCategoria.deleteMany({ where: { orcamento: { perfilId } } });
    await tx.orcamento.deleteMany({ where: { perfilId } });
    await tx.perfilFinanceiro.deleteMany({ where: { usuarioId } });
    await tx.usuario.deleteMany({ where: { id: usuarioId } });
  });
  assert.equal(await db.usuario.count({ where: { email: { in: emails } } }), 0);
  console.log('PASS: fixtures exclusivas removidas.');
}
async function main() {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Clock).useValue({ now: () => new Date('2026-10-24T12:00:00Z') })
    .overrideProvider(PushProvider).useValue({ send: async () => { throw new Error('Envio externo não faz parte deste teste.'); } }).compile();
  app = module.createNestApplication(new FastifyAdapter()); app.useLogger(false); configureApp(app);
  await app.listen(0, '127.0.0.1'); db = app.get(PrismaService);
  process.env.EXPO_PUBLIC_API_URL = `http://127.0.0.1:${app.getHttpAdapter().getInstance().server.address().port}`;
  let a, b, category, budget, expense, plan;
  try {
    await check('US18: login e perfil reais; catálogo sem dataset fictício', async () => {
      a = await auth.signUp('Auditoria mobile A', emails[0], 'audit-test-password'); activate(a);
      category = (await client.apiRequest('/categories')).find(row => row.ativa).id;
      assert.ok(a.activeProfileId); assert.equal(a.profiles[0].moedaBase, 'BRL');
    });
    await check('US07/09: lista/detalhe, renda registrada e diferença zero-based', async () => {
      expense = await client.apiRequest(client.profilePath('transactions'), { method: 'POST', body: { tipo: 'DESPESA', status: 'EFETIVADA', valor: '120.00', descricao: 'Despesa essencial', dataHora: '2026-10-20T12:00:00Z', categoriaId: category, essencialidade: 'ESSENCIAL' } });
      for (const status of ['EFETIVADA', 'PREVISTA']) await client.apiRequest(client.profilePath('transactions'), { method: 'POST', body: { tipo: 'RECEITA', status, valor: '500.00', descricao: 'Renda registrada', dataHora: '2026-10-20T13:00:00Z', categoriaId: category } });
      const input = { nome: 'Mensal audit', tipo: 'MENSAL', dataInicio: '2026-10-01', dataFim: '2026-10-31', categorias: [{ categoriaId: category, valorPlanejado: '100.00' }] };
      budget = await budgets.saveBudget(input);
      assert.equal((await budgets.getBudgets({ type: 'MENSAL', active: true }))[0].id, budget.id);
      assert.equal((await budgets.getBudget(budget.id)).categorias[0].valorRealizado, '120.00');
      assert.equal(await budgets.getRegisteredBudgetIncome(input.dataInicio, input.dataFim), '1000.00');
      const zero = await budgets.saveBudget({ ...input, tipo: 'ZERO_BASED' });
      assert.equal(zero.zeroBased.diferenca, '900.00'); assert.equal(zero.zeroBased.planejamentoIncompleto, true);
      await budgets.setBudgetActive(zero.id, false); assert.equal((await budgets.getBudget(zero.id)).ativo, false);
    });
    await check('US20/51/21: automação e plano persistidos, null e dois clientes', async () => {
      const rule = await tools.saveAutomation({ categoriaId: category, subcategoriaId: null, atributoAlvo: 'essencialidade', valorDestino: 'ESSENCIAL', ativa: true });
      assert.equal((await tools.getAutomations())[0].id, rule.id);
      plan = await tools.savePurchasePlan({ nome: 'Plano', valorTotal: '100.00', valorMensalPlanejado: '10.00', dataInicio: '2026-11-01' });
      const second = await auth.signIn(emails[0], 'audit-test-password'); activate(second);
      await tools.savePurchasePlan({ nome: 'Plano B', valorTotal: '200.00', valorMensalPlanejado: null, dataInicio: '2026-11-01' }, plan.id);
      activate(a); const saved = (await tools.getPurchasePlans())[0]; assert.equal(saved.nome, 'Plano B'); assert.equal(saved.valorTotal, '200.00'); assert.equal(saved.quantidadeMesesEstimada, null);
    });
    await check('US25/27/31/32/35/58: formatos reais, nulos e simulação sem escrita', async () => {
      const before = await db.transacao.count({ where: { perfilId: a.activeProfileId } });
      assert.equal((await insights.getMetrics('2026-10-01', '2026-10-31')).savingsRate.calculable, true);
      assert.equal((await insights.getTrends()).referenceQuarter.startDate, '2026-07-01');
      assert.equal((await insights.getProjection()).saldoAtual, '380.00');
      assert.equal((await insights.getCompletion('6m')).completionRate, null);
      const simulation = await tools.simulatePurchase({ valor: '100.01', parcelas: 3, dataPrimeiraParcela: '2026-10-24', categoriaId: category });
      assert.equal(simulation.criaTransacoes, false); assert.equal(simulation.meses.length, 3);
      assert.equal((await tools.calculate('compound-interest', '100.00', 10, 1)).valorFuturo, '110.00');
      assert.equal(await db.transacao.count({ where: { perfilId: a.activeProfileId } }), before);
    });
    await check('US52: canais configurados e avaliação monetária; não comprova envio', async () => {
      const rule = await planning.saveSpendingRule({ tipo: 'LIMITE_DIARIO', categoriaId: null, limitCents: 5000, periodo: 'DIARIO', canais: ['PUSH'], ativa: true });
      assert.equal(rule.valorLimite, '50.00'); assert.ok(rule.avaliacaoAtual); assert.deepEqual(rule.canais, ['PUSH']);
    });
    await check('US59: baseline atual, aceite recalculado, sugestões e PATCH de nome', async () => {
      const proposals = await challenges.getCandidates(); assert.equal(proposals.baseline.startDate, '2026-10-01'); assert.equal(proposals.candidates[0].valorMetaSugerido, '100.00');
      const accepted = await challenges.acceptChallenge(category); assert.equal(accepted.dataInicio, '2026-11-01');
      assert.equal((await challenges.renameChallenge(accepted.id, 'Nome audit')).nome, 'Nome audit');
      assert.ok((await challenges.getSuggestions(accepted.id)).suggestions.length > 0);
      assert.equal((await challenges.getChallenge(accepted.id)).valorGastoAtual, '0.00');
    });
    await check('US42/04: FormData e parser reais, preview sem escrita, confirm e auditoria', async () => {
      const before = await db.transacao.count({ where: { perfilId: a.activeProfileId } });
      const picked = await imports.pickImport(); assert.equal(picked.preview.summary.validRows, 1);
      assert.equal(await db.transacao.count({ where: { perfilId: a.activeProfileId } }), before);
      const result = await imports.confirmImport(picked.preview, false); assert.equal(result.created, 1);
      assert.equal((await audits.getAudits(result.transactionIds[0]))[0].operacao, 'CRIACAO');
      await assert.rejects(imports.confirmImport(picked.preview, false), error => error.status === 409);
      assert.equal(await db.transacao.count({ where: { perfilId: a.activeProfileId } }), before + 1);
      await client.apiRequest(client.profilePath(`transactions/${expense.id}`), { method: 'DELETE' });
      const history = await audits.getAudits(expense.id); assert.ok(history.some(event => event.operacao === 'EXCLUSAO' && event.transacaoId === null));
    });
    await check('US18/21: outro perfil vazio e outra conta rejeitada pelos serviços reais', async () => {
      const other = await client.apiRequest('/profiles', { method: 'POST', body: { nome: 'Outro perfil audit' } }); activate(a, other.id);
      assert.deepEqual(await budgets.getBudgets(), []); assert.deepEqual(await tools.getPurchasePlans(), []);
      b = await auth.signUp('Auditoria mobile B', emails[1], 'audit-test-password'); activate(b, a.activeProfileId);
      for (const query of [budgets.getBudgets, tools.getPurchasePlans, insights.getMetrics, challenges.getChallenges, audits.getAudits]) await assert.rejects(query(), error => error.status === 403);
    });
  } finally { try { await cleanup(); } finally { await app.close(); } }
  console.log(`PASS: ${groups} grupos Sprint 2 mobile → HTTP → PostgreSQL. Não é homologação Android/push.`);
}
main().catch(async error => { console.error(error.stack); if (app) await app.close().catch(() => {}); process.exitCode = 1; });
