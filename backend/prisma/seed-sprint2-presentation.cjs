// Complemento de apresentação: somente a conta explícita, Services reais e sem envio push.
process.env.NODE_ENV = 'test';
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/database/prisma.service');
const { Prisma } = require('../dist/generated/prisma/client');
const { Clock } = require('../dist/common/clock');
const service = (folder, file, name) => require(`../dist/modules/${folder}/${file}`)[name];
const option = name => process.argv[process.argv.indexOf(name) + 1];
let step = 'inicialização';
async function main() {
  assert(process.argv.includes('--apply'), 'Use --apply para gravar os dados de apresentação.');
  const email = option('--email'), referenceDate = option('--reference-date');
  assert(process.argv.includes('--email') && email?.includes('@'), 'Informe --email.');
  assert(process.argv.includes('--reference-date') && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate), 'Informe --reference-date YYYY-MM-DD.');
  const reference = new Date(`${referenceDate}T12:00:00Z`);
  assert.equal(reference.toISOString().slice(0, 10), referenceDate);
  const y = reference.getUTCFullYear(), m = reference.getUTCMonth();
  const at = (offset, day = 1, hour = 12) => new Date(Date.UTC(y, m + offset, day, hour));
  const iso = (offset, day = 1, hour = 12) => at(offset, day, hour).toISOString();
  const day = value => value.toISOString().slice(0, 10);
  const start = day(at(0)), end = day(at(1, 0));
  const mark = `Apresentação Sprint 2 · ${referenceDate.slice(0, 7)}`;
  const folder = path.resolve('.cache', `presentation-sprint2-${referenceDate}`);
  fs.mkdirSync(folder, { recursive: true });
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const db = app.get(PrismaService), clock = app.get(Clock);
    let now = reference; clock.now = () => new Date(now);
    const user = await db.usuario.findUniqueOrThrow({ where: { email } });
    const beforeProfiles = await db.perfilFinanceiro.findMany({ where: { usuarioId: user.id }, orderBy: { createdAt: 'asc' } });
    const oldIds = beforeProfiles.map(p => p.id);
    const originalTransactions = await db.transacao.findMany({ where: { perfilId: { in: oldIds } }, orderBy: { id: 'asc' } });
    const catalogBefore = await db.categoria.findMany({ orderBy: { id: 'asc' } });
    const backupPath = path.join(folder, 'before.json');
    if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, JSON.stringify({ referenceDate, userId: user.id, profiles: beforeProfiles,
      transactions: originalTransactions, budgets: await db.orcamento.findMany({ where: { perfilId: { in: oldIds } }, include: { orcamentoCategorias: true } }),
      goals: await db.meta.findMany({ where: { perfilId: { in: oldIds } }, include: { aportes: true } }),
      challenges: await db.desafioEconomia.findMany({ where: { perfilId: { in: oldIds } } }),
      automations: await db.regraAutomacao.findMany({ where: { perfilId: { in: oldIds } } }) }, null, 2));
    assert.equal(JSON.parse(fs.readFileSync(backupPath, 'utf8')).userId, user.id, 'Backup desta referência pertence a outra conta; use uma pasta isolada.');
    const get = (folder, file, name) => app.get(service(folder, file, name));
    const profiles = get('profiles', 'profiles.service', 'ProfilesService');
    const transactions = get('transactions', 'transactions.service', 'TransactionsService');
    const budgets = get('budgets', 'budgets.service', 'BudgetsService');
    const goals = get('goals', 'goals.service', 'GoalsService');
    const categories = get('categories', 'categories.service', 'CategoriesService');
    const automations = get('automation-rules', 'automation-rules.service', 'AutomationRulesService');
    const plans = get('large-purchase-plans', 'large-purchase-plans.service', 'LargePurchasePlansService');
    const challenges = get('essential-expense-challenges', 'essential-expense-challenges.service', 'EssentialExpenseChallengesService');
    const imports = get('imports', 'imports.service', 'ImportsService');
    const cat = Object.fromEntries(catalogBefore.filter(c => c.ativa).map(c => [c.nome, c.id]));
    const food = 'Alimentação', education = 'Educação e Carreira', health = 'Saúde e Autocuidado';
    for (const name of [food, education, health, 'Moradia', 'Transporte', 'Lazer e Estilo de Vida', 'Rendas e Investimentos']) assert(cat[name], `Categoria ausente: ${name}`);
    const primary = beforeProfiles.find(p => ['Leo', 'Leo · Pessoal'].includes(p.nome)) ?? beforeProfiles[0];
    assert(primary, 'Conta sem perfil principal.');
    let secondary = beforeProfiles.find(p => p.id !== primary.id && ['Teste', 'Projetos e Estudos'].includes(p.nome));
    if (!secondary) secondary = await profiles.create(user.id, 'Projetos e Estudos');
    step = 'backup e dados básicos';
    const base = spawnSync(process.execPath, [path.resolve('prisma/seed-demo.cjs'), '--user-id', user.id, '--profile-id', primary.id, '--reference-date', referenceDate], { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'test' } });
    fs.writeFileSync(path.join(folder, 'base-seed.log'), (base.stdout ?? '') + (base.stderr ?? '') + (base.error?.code ?? ''));
    assert.equal(base.status, 0, 'Seed básico falhou; revisar os logs antes de continuar.');
    if (primary.nome !== 'Leo · Pessoal') await profiles.rename(user.id, primary.id, 'Leo · Pessoal');
    if (secondary.nome !== 'Projetos e Estudos') await profiles.rename(user.id, secondary.id, 'Projetos e Estudos');
    const created = {};
    const count = name => { created[name] = (created[name] ?? 0) + 1; };
    async function tx(p, description, value, category, when, extra = {}) {
      const tipo = extra.tipo ?? 'DESPESA';
      let row = await db.transacao.findFirst({ where: { perfilId: p, descricao: description, dataHora: new Date(when), tipo, recorrenciaId: null } });
      if (!row) { row = await transactions.create(user.id, p, { tipo, descricao: description, valor: value, categoriaId: category ? cat[category] : null,
        dataHora: when, status: 'EFETIVADA', essencialidade: tipo === 'RECEITA' ? 'NAO_CLASSIFICADA' : 'ESSENCIAL', metodoPagamento: 'PIX', anotacao: mark, ...extra }); count('transactions'); }
      return row;
    }
    async function budget(p, name, type, entries, from = start, to = end) {
      const where = { perfilId: p, tipo: type, ...(type === 'MENSAL' ? { dataInicio: new Date(from), dataFim: new Date(to) } : { nome: name }) };
      const rows = await db.orcamento.findMany({ where }); assert(rows.length <= 1, 'Orçamento duplicado; revisão manual necessária.');
      if (rows[0]) return rows[0];
      const row = await budgets.createBudget(user.id, p, { nome: name, tipo: type, dataInicio: from, dataFim: to, categorias: entries.map(([c, value]) => ({ categoriaId: cat[c], valorPlanejado: value })) });
      count('budgets'); return row;
    }
    async function goal(p, name, target, deadline, contribution, contributedOn) {
      let row = await db.meta.findFirst({ where: { perfilId: p, nome: name } });
      if (!row) { row = await goals.create(user.id, p, { nome: name, valorAlvo: target, dataLimite: deadline, frequenciaSugestao: 'SEMANAL' }); count('goals'); }
      if (!await db.aporteMeta.findFirst({ where: { metaId: row.id, dataHora: new Date(contributedOn), valor: contribution } })) { await goals.contribute(user.id, p, row.id, { valor: contribution, dataHora: contributedOn }); count('contributions'); }
    }
    async function subcategory(p, name, category) {
      const old = await db.subcategoria.findFirst({ where: { perfilId: p, nome: name, categoriaId: cat[category] } });
      return old ?? categories.createSubcategory(user.id, p, cat[category], name);
    }
    step = 'histórico trimestral e padrões';
    // Trimestre completo anterior e histórico de quatro semanas, sem tabela de padrões.
    const quarterStart = Math.floor(m / 3) * 3 - 3;
    for (const [p, income] of [[primary.id, '5200.00'], [secondary.id, '3800.00']]) {
      for (let q = 0; q < 3; q++) {
        const off = quarterStart + q - m;
        await tx(p, 'Renda mensal consolidada', income, 'Rendas e Investimentos', iso(off, 2), { tipo: 'RECEITA', metodoPagamento: 'TRANSFERENCIA' });
        for (const [name, value, category] of [['Moradia e serviços', p === primary.id ? '1300.00' : '350.00', 'Moradia'], ['Mercado do bairro', '550.00', food], ['Transporte para o trabalho', '200.00', 'Transporte'], ['Cuidados com a saúde', '120.00', health], ['Lazer do mês', '180.00', 'Lazer e Estilo de Vida'], ['Cursos e materiais', '150.00', education]]) await tx(p, name, value, category, iso(off, 5), { essencialidade: category === 'Lazer e Estilo de Vida' ? 'NAO_ESSENCIAL' : 'ESSENCIAL' });
      }
      for (let week = 1; week <= 4; week++) {
        const d = new Date(reference); d.setUTCDate(d.getUTCDate() - week * 7); d.setUTCHours(10, 15, 0, 0);
        await tx(p, p === primary.id ? 'Feira de domingo' : 'Café da revisão semanal', '25.00', food, d.toISOString());
      }
    }
    step = 'lançamentos atuais e previstos';
    const previousWeekEnd = new Date(`${referenceDate}T00:00:00Z`); previousWeekEnd.setUTCDate(previousWeekEnd.getUTCDate() - (previousWeekEnd.getUTCDay() + 6) % 7);
    const previousWeekStart = new Date(previousWeekEnd.getTime() - 7 * 86400000);
    for (const p of [primary.id, secondary.id]) {
      for (const [offset, name, value, category] of [[2, 'Compra da semana no mercado', '180.00', food], [3, 'Serviços da semana', '95.00', 'Moradia'], [4, 'Transporte da semana', '65.00', 'Transporte']]) {
        const date = new Date(previousWeekStart); date.setUTCDate(date.getUTCDate() + offset); date.setUTCHours(14);
        await tx(p, name, value, category, date.toISOString());
      }
    }
    await tx(primary.id, 'Mercado do bairro', '350.00', food, iso(0, 4));
    await tx(primary.id, 'Manutenção e deslocamentos', '260.00', 'Transporte', iso(0, 5));
    await tx(primary.id, 'Consulta e medicamentos', '180.00', health, iso(0, 6));
    await tx(secondary.id, 'Entrega de projeto freelance', '4200.00', 'Rendas e Investimentos', iso(0, 2), { tipo: 'RECEITA', metodoPagamento: 'TRANSFERENCIA' });
    await tx(secondary.id, 'Próxima entrega de projeto', '1200.00', 'Rendas e Investimentos', iso(0, 20), { tipo: 'RECEITA', status: 'PREVISTA' });
    for (const [name, value, category, date] of [['Curso de desenvolvimento mobile', '450.00', education, 3], ['Equipamentos para o portfólio', '500.00', education, 5], ['Deslocamentos para o workshop', '240.00', 'Transporte', 4], ['Mercado do bairro', '250.00', food, 6], ['Internet do escritório', '120.00', 'Moradia', 7]]) await tx(secondary.id, name, value, category, iso(0, date));
    await tx(secondary.id, 'Assinatura de ferramentas prevista', '89.90', education, iso(0, 18), { status: 'PREVISTA' });
    step = 'orçamentos e vínculos';
    const monthly = await budget(primary.id, 'Orçamento principal', 'MENSAL', [[food, '500.00']]);
    await budgets.updateBudget(user.id, primary.id, monthly.id, { nome: 'Orçamento principal · Pessoal', ativo: true });
    await budget(secondary.id, 'Orçamento principal · Projetos', 'MENSAL', [[education, '750.00'], [food, '200.00'], ['Transporte', '180.00'], ['Moradia', '300.00'], [health, '150.00'], ['Lazer e Estilo de Vida', '100.00']]);
    const event = await budget(primary.id, 'Encontro em família', 'EVENTO', [[food, '200.00'], ['Lazer e Estilo de Vida', '300.00']]);
    const cinema = await db.transacao.findFirst({ where: { perfilId: primary.id, descricao: 'Cinema', dataHora: { gte: new Date(start), lt: at(1) } } });
    if (cinema) await budgets.setBudgetTransaction(user.id, primary.id, event.id, cinema.id, true);
    const temporary = await budget(primary.id, 'Curso intensivo de novembro', 'TEMPORARIO', [[education, '450.00']]);
    const course = await db.transacao.findFirst({ where: { perfilId: primary.id, descricao: 'Curso', dataHora: { gte: new Date(start), lt: at(1) } } });
    if (course) await budgets.setBudgetTransaction(user.id, primary.id, temporary.id, course.id, true);
    await budget(primary.id, 'Planejamento do trimestre', 'PERIODO', [[education, '1800.00'], ['Transporte', '900.00']], day(at(-1)), day(at(2, 0)));
    const registered = await db.transacao.aggregate({ where: { perfilId: secondary.id, tipo: 'RECEITA', status: { in: ['EFETIVADA', 'PREVISTA'] }, dataHora: { gte: at(0), lt: at(1) } }, _sum: { valor: true } });
    const income = registered._sum.valor; assert(income?.greaterThan(0)); const allocation = income.mul('0.4').toDecimalPlaces(2);
    await budget(secondary.id, 'Distribuição de renda · Base zero', 'ZERO_BASED', [[education, allocation.toFixed(2)], ['Rendas e Investimentos', income.minus(allocation).toFixed(2)]]);
    await budgets.putQuota(user.id, secondary.id, y, m + 1, '250.00');
    step = 'metas abertas, atingidas e encerradas';
    for (const p of [primary.id, secondary.id]) {
      await goal(p, 'Certificação profissional', '1800.00', day(at(3, 15)), '650.00', iso(0, 3));
      await goal(p, 'Curso concluído', '1000.00', day(at(-1, 20)), '1000.00', iso(-1, 15));
      await goal(p, 'Monitor para estudo', '2000.00', day(at(-1, 25)), '800.00', iso(-1, 18));
    }
    step = 'automações e planos';
    for (const p of [primary.id, secondary.id]) {
      const category = p === primary.id ? food : education;
      const sub = await subcategory(p, p === primary.id ? 'Restaurantes' : 'Assinaturas opcionais', category);
      for (const scope of [{ categoriaId: cat[category], subcategoriaId: null, valorDestino: 'ESSENCIAL' }, { categoriaId: null, subcategoriaId: sub.id, valorDestino: 'NAO_ESSENCIAL' }]) {
        if (!await db.regraAutomacao.findFirst({ where: { perfilId: p, categoriaId: scope.categoriaId, subcategoriaId: scope.subcategoriaId, ativa: true } })) await automations.save(user.id, p, { ...scope, atributoAlvo: 'essencialidade', ativa: true });
      }
      const planName = p === primary.id ? 'Notebook para trabalho' : 'Estação de estudos';
      if (!await db.planoGrandeCompra.findFirst({ where: { perfilId: p, nome: planName } })) await plans.create(user.id, p, { nome: planName, valorTotal: p === primary.id ? '6000.00' : '3600.00', valorMensalPlanejado: p === primary.id ? '500.00' : '300.00', dataInicio: start });
      if (!await db.regraGasto.findFirst({ where: { perfilId: p, tipo: 'PERCENTUAL_RENDA' } })) await budgets.createRule(user.id, p, { tipo: 'PERCENTUAL_RENDA', periodo: 'MENSAL', categoriaId: cat['Lazer e Estilo de Vida'], percentualLimite: 10, baseCalculo: 'RENDA_PLANEJADA', canais: ['PUSH'], ativa: true });
    }
    step = 'auditoria de edição e reversão';
    for (const p of [primary.id, secondary.id]) {
      const row = await tx(p, 'Internet residencial · revisão mensal', '109.90', 'Moradia', iso(0, 4));
      if (row.anotacao === mark) await transactions.update(user.id, p, row.id, { valor: '119.90', anotacao: `${mark} · valor revisado` });
      const audit = await db.auditoriaTransacao.findFirst({ where: { perfilId: p, operacao: 'EXCLUSAO', estadoAnterior: { path: ['descricao'], equals: 'Compra cancelada na loja' } } });
      if (!audit) { const cancelled = await tx(p, 'Compra cancelada na loja', '129.90', 'Lazer e Estilo de Vida', iso(0, 2)); await transactions.reverse(user.id, p, cancelled.id); }
    }
    step = 'importação e arquivos de teste';
    const imported = { tipo: 'DESPESA', valor: '18.50', dataHora: iso(0, 6), descricao: 'Café da reunião', categoriaId: cat[food] };
    if (!await db.transacao.findFirst({ where: { perfilId: primary.id, descricao: imported.descricao, dataHora: new Date(imported.dataHora) } })) await imports.confirm(user.id, primary.id, { rows: [imported], confirmPossibleDuplicates: false });
    const csv = `tipo;valor;data_hora;descricao;categoria\nDESPESA;18.50;${imported.dataHora.slice(0, 19)};Café da reunião;Alimentação\nDESPESA;22.90;${iso(0, 7).slice(0, 19)};Estacionamento da apresentação;\nDESPESA;abc;${iso(0, 7).slice(0, 19)};Linha inválida;Transporte\n`;
    fs.writeFileSync(path.join(folder, 'importacao-apresentacao.csv'), csv);
    const preview = await imports.preview(user.id, primary.id, async () => Buffer.from(csv));
    assert(preview.summary.possibleDuplicates >= 1, 'CSV deve permitir demonstrar duplicatas.');
    step = 'desafios históricos e atuais';
    async function acceptedAt(offset, category, name, planned, realized) {
      if (await db.desafioEconomia.findFirst({ where: { perfilId: primary.id, nome: name } })) return;
      const from = day(at(offset)), to = day(at(offset + 1, 0));
      await budget(primary.id, `Referência histórica · ${from.slice(0, 7)}`, 'MENSAL', [[category, planned]], from, to);
      const b = await db.orcamento.findFirstOrThrow({ where: { perfilId: primary.id, tipo: 'MENSAL', dataInicio: new Date(from), dataFim: new Date(to) }, include: { orcamentoCategorias: true } });
      const plan = b.orcamentoCategorias.find(c => c.categoriaId === cat[category]);
      if (!plan) await budgets.updateBudget(user.id, primary.id, b.id, { categorias: [...b.orcamentoCategorias.map(c => ({ categoriaId: c.categoriaId, valorPlanejado: c.valorPlanejado.toFixed(2) })), { categoriaId: cat[category], valorPlanejado: planned }] });
      const actual = await db.transacao.aggregate({ where: { perfilId: primary.id, tipo: 'DESPESA', status: 'EFETIVADA', categoriaId: cat[category], dataHora: { gte: at(offset), lt: at(offset + 1) } }, _sum: { valor: true } });
      const target = Prisma.Decimal.max(realized, (plan?.valorPlanejado ?? new Prisma.Decimal(planned)).mul('1.2'));
      const missing = target.minus(actual._sum.valor ?? 0);
      if (missing.greaterThan(0)) await tx(primary.id, name === 'Saúde em equilíbrio · concluído' ? 'Consultas e exames do semestre' : 'Feira e mercado · referência do desafio', missing.toFixed(2), category, iso(offset, 12));
      now = at(offset, 25);
      try { // POST revalida a categoria, inclusive quando ela não está no top 3 da apresentação.
        const accepted = await challenges.create(user.id, primary.id, { categoriaId: cat[category] }); await challenges.update(user.id, primary.id, accepted.id, { nome: name });
      } finally { now = reference; }
    }
    // Aceites históricos usam a regra real com Clock histórico, em ordem cronológica.
    await acceptedAt(-5, health, 'Saúde em equilíbrio · concluído', '200.00', '250.00');
    await acceptedAt(-1, food, 'Mercado com equilíbrio', '500.00', '750.00');
    step = 'verificações finais';
    const summaries = [];
    for (const p of [primary.id, secondary.id]) {
      const candidates = await challenges.candidates(user.id, p);
      assert(candidates.candidates.length >= 1, 'Cada perfil deve ter propostas de desafio.');
      const budgetsList = await budgets.listBudgets(user.id, p, {});
      assert(budgetsList.some(b => b.tipo === 'MENSAL' && b.dataInicio === start && b.ativo));
      const rate = await goals.completionRate(user.id, p, '6m'); assert(rate.closedGoals >= 2 && rate.completionRate !== null);
      const insight = get('analytics', 'insights.service', 'InsightsService');
      assert((await insight.suggest(user.id, p, ' mercado   do bairro ')).suggested);
      const challengeList = await challenges.list(user.id, p);
      const weekly = await get('notifications', 'weekly-summary.service', 'WeeklySummaryService').summary(user.id, p, previousWeekStart, previousWeekEnd);
      assert(weekly.largestExpenses.length >= 3, 'Resumo semanal deve conter gastos representativos.');
      const history = await db.transacao.findMany({ where: { perfilId: p, dataHora: { gte: new Date(reference.getTime() - 56 * 86400000), lte: reference } }, select: { dataHora: true, categoria: { select: { id: true, nome: true } } } });
      const reminderCandidates = require('../dist/modules/notifications/transaction-reminder-detector').detectTransactionReminders(p, history, new Date(`${referenceDate}T00:00:00Z`), reference);
      summaries.push({ id: p, nome: (await profiles.get(user.id, p)).nome, transactions: await db.transacao.count({ where: { perfilId: p } }),
        budgets: budgetsList.map(b => ({ nome: b.nome, tipo: b.tipo })), goals: (await goals.list(user.id, p)).length, completionRate: rate,
        challenges: challengeList.map(c => ({ nome: c.nome, status: c.status, gastoAtual: c.valorGastoAtual, meta: c.valorMeta })), proposals: candidates.candidates,
        automations: (await automations.list(user.id, p)).length, plans: (await plans.list(user.id, p)).length, weeklyExpenses: weekly.largestExpenses.length, reminderCandidates: reminderCandidates.length });
    }
    assert.deepEqual(await db.usuario.findUniqueOrThrow({ where: { id: user.id } }), user, 'Autenticação/conta deve permanecer intacta.');
    assert.deepEqual(await db.transacao.findMany({ where: { id: { in: originalTransactions.map(t => t.id) } }, orderBy: { id: 'asc' } }), originalTransactions, 'Lançamentos anteriores devem permanecer intactos.');
    const initialSnapshot = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const initialRows = await db.transacao.findMany({ where: { id: { in: initialSnapshot.transactions.map(t => t.id) } }, orderBy: { id: 'asc' } });
    assert.deepEqual(JSON.parse(JSON.stringify(initialRows)), initialSnapshot.transactions, 'Backup inicial deve continuar íntegro após retomadas.');
    assert.deepEqual(await db.categoria.findMany({ orderBy: { id: 'asc' } }), catalogBefore);
    const output = { referenceDate, email, created, profiles: summaries, csvPreview: preview.summary, preservedExistingTransactions: initialSnapshot.transactions.length, authenticationPreserved: true, pushSentBySeed: false };
    fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(output, null, 2));
    console.log(JSON.stringify(output, null, 2));
  } finally { await app.close(); }
}
main().catch(error => { console.error('Etapa interrompida:', step, error.getResponse?.() ?? (error.name === 'AssertionError' ? error.message : error.name)); process.exitCode = 1; });
