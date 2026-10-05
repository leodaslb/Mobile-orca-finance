// Dados para apresentação: usa os Services reais, com ownership e auditoria.
// Não modifica autenticação, schema, catálogo global ou registros existentes.
process.env.NODE_ENV = 'test'; // Impede que o Cron processe dados enquanto o seed executa.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/database/prisma.service');
const { CategoriesService } = require('../dist/modules/categories/categories.service');
const { TagsService } = require('../dist/modules/tags/tags.service');
const { TransactionsService } = require('../dist/modules/transactions/transactions.service');
const { BudgetsService } = require('../dist/modules/budgets/budgets.service');
const { GoalsService } = require('../dist/modules/goals/goals.service');
const { ReflectionService } = require('../dist/modules/reflection/reflection.service');
const { RecurrencesService } = require('../dist/modules/recurrences/recurrences.service');
const { RemindersService } = require('../dist/modules/recurrences/reminders.service');
const { AnalyticsService } = require('../dist/modules/analytics/analytics.service');

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function main() {
  const user = option('--user-id');
  const profile = option('--profile-id');
  const referenceDate = option('--reference-date');
  const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  assert.ok(uuid.test(user ?? '') && uuid.test(profile ?? ''), 'Informe --user-id e --profile-id UUID explícitos.');
  assert.match(referenceDate ?? '', /^\d{4}-\d{2}-\d{2}$/, 'Informe --reference-date YYYY-MM-DD.');
  const reference = new Date(`${referenceDate}T12:00:00Z`);
  assert.ok(Number.isFinite(reference.getTime()) && reference.getUTCFullYear() > 0, 'Data inválida.');
  assert.equal(reference.toISOString().slice(0, 10), referenceDate, 'Data inválida.');
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth() + 1;
  const period = referenceDate.slice(0, 7);
  // Reconhece rótulos anteriores para não duplicar o dataset ao reexecutar.
  const labels = (name) => [name, `[DEMO ${period}] ${name}`, `[ ${period}] ${name}`];
  const date = (offset) => new Date(reference.getTime() + offset * 86400000).toISOString();
  const effectiveDay = Math.max(1, reference.getUTCDate() - 1);
  const current = new Date(Date.UTC(year, month - 1, effectiveDay, 12)).toISOString();
  const previous = (day) => new Date(Date.UTC(year, month - 2, day, 12)).toISOString();
  const created = {};
  const count = (entity) => { created[entity] = (created[entity] ?? 0) + 1; };

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const prisma = app.get(PrismaService);
    const accountBefore = await prisma.usuario.findUniqueOrThrow({ where: { id: user } });
    const profileBefore = await prisma.perfilFinanceiro.findFirstOrThrow({ where: { id: profile, usuarioId: user } });
    const catalogueBefore = await prisma.categoria.findMany({ orderBy: { id: 'asc' } });
    const categories = new Map(catalogueBefore.filter((item) => item.ativa).map((item) => [item.nome, item.id]));
    for (const name of ['Moradia', 'Transporte', 'Alimentação', 'Lazer e Estilo de Vida', 'Saúde e Autocuidado', 'Educação e Carreira', 'Rendas e Investimentos']) {
      assert.ok(categories.has(name), `Categoria ativa ausente: ${name}. Execute o seed de catálogo separadamente.`);
    }
    const categoriesService = app.get(CategoriesService);
    const tagsService = app.get(TagsService);
    const transactions = app.get(TransactionsService);
    const budgets = app.get(BudgetsService);
    const goals = app.get(GoalsService);
    const reflection = app.get(ReflectionService);
    const recurrences = app.get(RecurrencesService);
    const reminders = app.get(RemindersService);
    const tagIds = [];
    for (const nome of ['#Pessoal', '#Essencial', '#Planejado']) {
      let item = await prisma.tag.findFirst({ where: { perfilId: profile, nome } });
      if (!item) { item = await tagsService.create(user, profile, nome); count('tags'); }
      tagIds.push(item.id);
    }
    const subcategoryIds = new Map();
    for (const [name, category] of [['Supermercado', 'Alimentação'], ['Aplicativos', 'Transporte'], ['Cinema', 'Lazer e Estilo de Vida']]) {
      const nome = `${name}`;
      const categoriaId = categories.get(category);
      let item = await prisma.subcategoria.findFirst({ where: { perfilId: profile, categoriaId, nome } });
      if (!item) { item = await categoriesService.createSubcategory(user, profile, categoriaId, nome); count('subcategories'); }
      subcategoryIds.set(name, item.id);
    }

    const records = [
      ['Salário mês anterior', 'RECEITA', '4500.00', 'Rendas e Investimentos', previous(1)],
      ['Aluguel mês anterior', 'DESPESA', '1300.00', 'Moradia', previous(5)],
      ['Mercado mês anterior', 'DESPESA', '680.00', 'Alimentação', previous(15)],
      ['Transporte mês anterior', 'DESPESA', '180.00', 'Transporte', previous(20)],
      ['Lazer mês anterior', 'DESPESA', '220.00', 'Lazer e Estilo de Vida', previous(25)],
      ['Salário', 'RECEITA', '5000.00', 'Rendas e Investimentos', current],
      ['Freelance', 'RECEITA', '650.00', 'Rendas e Investimentos', current],
      ['Aluguel', 'DESPESA', '1450.00', 'Moradia', current],
      ['Supermercado', 'DESPESA', '320.75', 'Alimentação', current, 'EFETIVADA', 'Supermercado'],
      ['Corrida de aplicativo', 'DESPESA', '45.90', 'Transporte', current, 'EFETIVADA', 'Aplicativos'],
      ['Farmácia', 'DESPESA', '82.50', 'Saúde e Autocuidado', current],
      ['Restaurante', 'DESPESA', '68.00', 'Alimentação', current],
      ['Cinema', 'DESPESA', '95.00', 'Lazer e Estilo de Vida', current, 'EFETIVADA', 'Cinema'],
      ['Curso', 'DESPESA', '150.00', 'Educação e Carreira', current],
      ['Compra por impulso', 'DESPESA', '49.90', null, current],
      ['Energia prevista', 'DESPESA', '120.00', 'Moradia', date(14), 'PREVISTA'],
      ['IPVA previsto', 'DESPESA', '450.00', 'Transporte', date(20), 'PREVISTA'],
    ];
    const transactionIds = new Map();
    for (const [name, tipo, valor, category, dataHora, status = 'EFETIVADA', subcategory] of records) {
      const descricao = name;
      let item = await prisma.transacao.findFirst({ where: { perfilId: profile, descricao: { in: labels(name) }, tipo, valor,
        dataHora: new Date(dataHora), recorrenciaId: null } });
      if (!item) {
        item = await transactions.create(user, profile, { tipo, valor, dataHora, descricao, status,
          categoriaId: category ? categories.get(category) : null, subcategoriaId: subcategoryIds.get(subcategory),
          metodoPagamento: tipo === 'RECEITA' ? 'TRANSFERENCIA' : 'PIX', ehGastoLivre: category === null,
          essencialidade: tipo === 'DESPESA' ? (['Cinema', 'Compra por impulso'].includes(name) ? 'NAO_ESSENCIAL' : 'ESSENCIAL') : 'NAO_CLASSIFICADA',
          anotacao: null });
        count('transactions');
        await transactions.setTags(user, profile, item.id, [tagIds[0], status === 'PREVISTA' ? tagIds[2] : tagIds[1]]);
      }
      transactionIds.set(name, item.id);
    }
    // Recibos são adicionados pelo aplicativo com uma imagem real, não por URL de exemplo.

    // Só cria planejamento se o período ainda não estiver configurado; não sobrescreve.
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    if (!await prisma.orcamento.findFirst({ where: { perfilId: profile, tipo: 'MENSAL', dataInicio: start, dataFim: end } })) {
      await budgets.putMonthly(user, profile, year, month, { categorias: [
        ['Moradia', '1600.00'], ['Alimentação', '500.00'], ['Transporte', '200.00'], ['Lazer e Estilo de Vida', '80.00'],
        ['Saúde e Autocuidado', '200.00'], ['Educação e Carreira', '300.00'],
      ].map(([name, valorPlanejado]) => ({ categoriaId: categories.get(name), valorPlanejado })) }); count('budgets');
    }
    if (!await prisma.cotaGastoLivre.findFirst({ where: { perfilId: profile, ano: year, mes: month } })) {
      await budgets.putQuota(user, profile, year, month, '200.00'); count('quotas');
    }
    for (const [tipo, periodo, categoriaId, valorLimite] of [
      ['LIMITE_DIARIO', 'DIARIO', null, '1000.00'], ['LIMITE_CATEGORIA', 'MENSAL', categories.get('Lazer e Estilo de Vida'), '80.00'],
    ]) {
      if (!await prisma.regraGasto.findFirst({ where: { perfilId: profile, tipo, periodo, categoriaId } })) {
        await budgets.createRule(user, profile, { tipo, periodo, categoriaId, valorLimite, canais: ['PUSH'] }); count('spendingRules');
      }
    }
    for (const [name, valorAlvo, offset, valor] of [['Viagem', '3000.00', 90, '450.00'], ['Reserva de emergência', '5000.00', 180, '800.00']]) {
      const nome = name;
      let item = await prisma.meta.findFirst({ where: { perfilId: profile, nome: { in: labels(name) } } });
      if (!item) { item = await goals.create(user, profile, { nome, valorAlvo, dataLimite: date(offset).slice(0, 10), frequenciaSugestao: 'SEMANAL' }); count('goals'); }
      const dataHora = new Date(current);
      if (!await prisma.aporteMeta.findFirst({ where: { metaId: item.id, dataHora, valor } })) {
        await goals.contribute(user, profile, item.id, { valor, dataHora: current }); count('contributions');
      }
    }
    for (const [name, duracaoHoras] of [['Fone de ouvido', 48], ['Tênis novo', 6]]) {
      const descricao = name;
      if (!await prisma.itemReflexao.findFirst({ where: { perfilId: profile, descricao: { in: labels(name) } } })) {
        await reflection.create(user, profile, { descricao, duracaoHoras }); count('reflectionItems');
      }
    }
    const nextMonth = new Date(Date.UTC(year, month, 1, 12)).toISOString();
    const recurrenceIds = [];
    for (const [name, tipoTransacao, valor, category, frequencia, proximaOcorrencia] of [
      ['Feira semanal', 'DESPESA', '25.00', 'Alimentação', 'SEMANAL', date(7)],
      ['Salário mensal', 'RECEITA', '5000.00', 'Rendas e Investimentos', 'MENSAL', nextMonth],
      ['Seguro anual', 'DESPESA', '450.00', 'Transporte', 'ANUAL', date(25)],
    ]) {
      const descricao = name;
      let item = await prisma.recorrencia.findFirst({ where: { perfilId: profile, descricao: { in: labels(name) } } });
      if (!item) {
        item = await recurrences.create(user, profile, { tipoTransacao, valor, descricao, categoriaId: categories.get(category),
          metodoPagamento: 'PIX', frequencia, proximaOcorrencia }); count('recurrences');
      }
      recurrenceIds.push(item.id);
    }
    for (const origin of [{ transacaoId: transactionIds.get('Energia prevista'), recorrenciaId: null },
      { transacaoId: null, recorrenciaId: recurrenceIds[0] }]) {
      if (!await prisma.lembreteVencimento.findFirst({ where: { perfilId: profile, ...origin } })) {
        await reminders.create(user, profile, { ...origin, notificarEm: date(origin.transacaoId ? 13 : 6), ativo: true }); count('reminders');
      }
    }

    // Verifica que senha/conta/perfil e categorias não foram alterados; nunca os imprime.
    assert.deepEqual(await prisma.usuario.findUniqueOrThrow({ where: { id: user } }), accountBefore);
    assert.deepEqual(await prisma.perfilFinanceiro.findUniqueOrThrow({ where: { id: profile } }), profileBefore);
    assert.deepEqual(await prisma.categoria.findMany({ orderBy: { id: 'asc' } }), catalogueBefore);
    const dashboard = await app.get(AnalyticsService).dashboard(user, profile, { year, month });
    console.log(JSON.stringify({ userId: user, profileId: profile, referenceDate, period, created,
      totals: { transactions: await prisma.transacao.count({ where: { perfilId: profile } }),
        effective: await prisma.transacao.count({ where: { perfilId: profile, status: 'EFETIVADA' } }),
        scheduled: await prisma.transacao.count({ where: { perfilId: profile, status: 'PREVISTA' } }),
        saldoAtual: dashboard.saldoAtual, gastosDoMes: dashboard.gastosDoMes },
      authenticationAndCataloguePreserved: true }, null, 2));
  } finally { await app.close(); }
}

main().catch((error) => {
  console.error('Seed interrompido; pode ser reexecutado para continuar:', error.getResponse?.() ?? error.name);
  process.exitCode = 1;
});
