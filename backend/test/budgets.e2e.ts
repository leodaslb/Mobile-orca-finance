import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import { BudgetsRepository } from '../src/modules/budgets/budgets.repository';

describe('Sprint 1: planejamento HTTP → Neon', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const emails = [`planning-a-${suffix}@example.test`, `planning-b-${suffix}@example.test`];
  const profiles: string[] = [];
  const tokens: string[] = [];
  let categories: string[];
  let budgetId: string;
  let dailyId: string;
  let categoryRuleId: string;
  const headers = (index = 0) => ({ authorization: `Bearer ${tokens[index]}` });
  const base = (index = 0) => `/profiles/${profiles[index]}`;
  const budget = (month = 9, index = 0) => `${base(index)}/budgets/monthly/2026/${month}`;
  const quota = (index = 0) => `${base(index)}/free-spending-quota/2026/12`;
  const rules = (index = 0) => `${base(index)}/spending-rules`;
  const plan = (value = '100.00') => ({ categorias: [
    { categoriaId: categories[0], valorPlanejado: value }, { categoriaId: categories[1], valorPlanejado: '200.00' },
  ] });
  const readBudget = async () => (await app.inject({ method: 'GET', url: budget(), headers: headers() })).json();
  const readQuota = async () => (await app.inject({ method: 'GET', url: quota(), headers: headers() })).json();
  const readRules = async (date = '2026-09-15T12:00:00Z') => (await app.inject({ method: 'GET',
    url: `${rules()}?dataReferencia=${encodeURIComponent(date)}`, headers: headers() })).json();
  const createTransaction = async (payload: Record<string, unknown> = {}, index = 0) => {
    const response = await app.inject({ method: 'POST', url: `${base(index)}/transactions`, headers: headers(index),
      payload: { tipo: 'DESPESA', valor: '20.00', categoriaId: categories[0], dataHora: '2026-09-15T12:00:00Z',
        descricao: 'Teste de planejamento', status: 'EFETIVADA', ...payload } });
    expect(response.statusCode).toBe(201);
    return response.json().id as string;
  };
  const changeTransaction = async (id: string, payload: Record<string, unknown>) => {
    expect((await app.inject({ method: 'PATCH', url: `${base()}/transactions/${id}`, headers: headers(), payload })).statusCode).toBe(200);
  };
  const reverse = async (id: string) => {
    expect((await app.inject({ method: 'DELETE', url: `${base()}/transactions/${id}`, headers: headers() })).statusCode).toBe(204);
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useLogger(false);
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
    categories = (await prisma.categoria.findMany({ where: { ativa: true }, orderBy: { id: 'asc' } })).map((item) => item.id);
    expect(categories.length).toBeGreaterThanOrEqual(2);
    for (const email of emails) {
      const registered = await app.inject({ method: 'POST', url: '/auth/register', payload: { nome: 'Planejamento', email, senha: 'senha de teste' } });
      expect(registered.statusCode).toBe(201);
      profiles.push(registered.json().profile.id);
      const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha: 'senha de teste' } });
      expect(login.statusCode).toBe(201);
      tokens.push(login.json().accessToken);
    }
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (prisma) {
      const users = await prisma.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
      const userIds = users.map((item) => item.id);
      const owned = await prisma.perfilFinanceiro.findMany({ where: { usuarioId: { in: userIds } }, select: { id: true } });
      const perfilId = { in: owned.map((item) => item.id) };
      await prisma.transacao.deleteMany({ where: { perfilId } });
      await prisma.auditoriaTransacao.deleteMany({ where: { perfilId } });
      await prisma.regraGastoCanal.deleteMany({ where: { regraGasto: { perfilId } } });
      await prisma.regraGasto.deleteMany({ where: { perfilId } });
      await prisma.orcamentoCategoria.deleteMany({ where: { orcamento: { perfilId } } });
      await prisma.orcamento.deleteMany({ where: { perfilId } });
      await prisma.cotaGastoLivre.deleteMany({ where: { perfilId } });
      await prisma.subcategoria.deleteMany({ where: { perfilId } });
      await prisma.perfilFinanceiro.deleteMany({ where: { usuarioId: { in: userIds } } });
      await prisma.usuario.deleteMany({ where: { id: { in: userIds } } });
    }
    await app?.close();
  });

  it('cria, consulta e substitui orçamento mensal sem duplicação, inclusive PUTs concorrentes', async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await app.inject({ method: 'PUT', url: budget(), headers: headers(), payload: plan() });
      expect(response.statusCode).toBe(200);
      if (budgetId) expect(response.json().id).toBe(budgetId);
      budgetId = response.json().id;
      expect(response.json().totais).toMatchObject({ valorPlanejado: '300.00', valorRealizado: '0.00', estado: 'NORMAL' });
    }
    const replacements = await Promise.all(['10.00', '15.00'].map((value) => app.inject({ method: 'PUT', url: budget(11), headers: headers(), payload: plan(value) })));
    expect(replacements.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(new Set(replacements.map((response) => response.json().id)).size).toBe(1);
    expect(await prisma.orcamento.count({ where: { perfilId: profiles[0], tipo: 'MENSAL' } })).toBe(2);
    expect(await prisma.orcamentoCategoria.count({ where: { orcamentoId: budgetId } })).toBe(2);
    expect((await app.inject({ method: 'PUT', url: budget(11), headers: headers(), payload: { categorias: [plan().categorias[0]] } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: budget(11), headers: headers() })).json().categorias).toHaveLength(1);
  });

  it('RF24 usa subcategoria personalizada e orçamento MENSAL normal da categoria existente', async () => {
    const category = await prisma.categoria.findFirstOrThrow({ where: { nome: 'Lazer e Estilo de Vida', ativa: true } });
    const sub = await app.inject({ method: 'POST', url: `${base()}/subcategories`, headers: headers(), payload: { categoriaId: category.id, nome: 'Streaming' } });
    expect(sub.statusCode).toBe(201);
    const url = budget(8);
    expect((await app.inject({ method: 'PUT', url, headers: headers(), payload: { categorias: [{ categoriaId: category.id, valorPlanejado: '100.00' }] } })).statusCode).toBe(200);
    const id = await createTransaction({ valor: '75.00', categoriaId: category.id, subcategoriaId: sub.json().id, dataHora: '2026-08-15T12:00:00Z' });
    const response = (await app.inject({ method: 'GET', url, headers: headers() })).json();
    expect(response).toMatchObject({ categorias: [{ valorRealizado: '75.00', estado: 'PROXIMO_LIMITE' }] });
    expect((await prisma.orcamento.findUniqueOrThrow({ where: { id: response.id } })).tipo).toBe('MENSAL');
    await reverse(id);
    // Esta fixture não altera o catálogo global nem o estado esperado pelos testes anteriores.
    await prisma.orcamentoCategoria.deleteMany({ where: { orcamentoId: response.id } });
    await prisma.orcamento.delete({ where: { id: response.id } });
  });

  it('valida valores, categorias, calendário e tipos fora do escopo sem criar registros', async () => {
    for (const value of ['0', '-1', '1.001', 'NaN', '100000000000000000', '']) {
      expect((await app.inject({ method: 'PUT', url: budget(), headers: headers(), payload: plan(value) })).statusCode).toBe(400);
      expect((await app.inject({ method: 'PUT', url: quota(), headers: headers(), payload: { valorLimite: value } })).statusCode).toBe(400);
    }
    for (const payload of [{ categorias: [] }, { categorias: [plan().categorias[0], plan().categorias[0]] },
      { categorias: [{ categoriaId: randomUUID(), valorPlanejado: '10.00' }] }, { ...plan(), tipo: 'CONTEXTUAL' }]) {
      expect((await app.inject({ method: 'PUT', url: budget(), headers: headers(), payload })).statusCode).toBe(400);
    }
    for (const url of [budget(0), budget(13), budget().replace('/2026/', '/0/'), quota().replace('/12', '/13')]) {
      expect((await app.inject({ method: 'GET', url, headers: headers() })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'GET', url: budget(8), headers: headers() })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: quota(), headers: headers() })).statusCode).toBe(404);
  });

  it('compara despesas efetivadas do perfil/categoria/mês e aplica os limites exatos de 75% e 100%', async () => {
    const id = await createTransaction({ valor: '74.99' });
    await createTransaction({ valor: '700.00', status: 'PREVISTA' });
    await createTransaction({ valor: '900.00', tipo: 'RECEITA' });
    await createTransaction({ valor: '999.00', dataHora: '2026-10-01T00:00:00Z' });
    await createTransaction({ valor: '900.00' }, 1);
    const category = async () => (await readBudget()).categorias.find((item: { categoria: { id: string } }) => item.categoria.id === categories[0]);
    expect(await category()).toMatchObject({ valorRealizado: '74.99', desvio: '-25.01', estado: 'NORMAL' });
    for (const [value, state] of [['75.00', 'PROXIMO_LIMITE'], ['100.00', 'PROXIMO_LIMITE'], ['100.01', 'EXCEDIDO']]) {
      await changeTransaction(id, { valor: value });
      expect(await category()).toMatchObject({ valorRealizado: value, estado: state });
    }
    expect((await readBudget()).totais).toMatchObject({ valorPlanejado: '300.00', valorRealizado: '100.01', desvio: '-199.99' });
    await changeTransaction(id, { categoriaId: categories[1], valor: '20.00' });
    expect(await category()).toMatchObject({ valorRealizado: '0.00' });
    expect((await readBudget()).totais.valorRealizado).toBe('20.00');
    await changeTransaction(id, { dataHora: '2026-10-01T00:00:00Z' });
    expect((await readBudget()).totais.valorRealizado).toBe('0.00');
    await changeTransaction(id, { dataHora: '2026-09-30T23:59:59.999Z', status: 'PREVISTA' });
    expect((await readBudget()).totais.valorRealizado).toBe('0.00');
    await changeTransaction(id, { status: 'EFETIVADA' });
    expect((await readBudget()).totais.valorRealizado).toBe('20.00');
    await reverse(id);
    expect((await readBudget()).totais.valorRealizado).toBe('0.00');
  });

  it('quota é única por perfil/mês e só consome gasto livre explicitamente marcado, sem duplicar totais', async () => {
    const first = await app.inject({ method: 'PUT', url: quota(), headers: headers(), payload: { valorLimite: '100.00' } });
    expect(first.statusCode).toBe(200);
    const updated = await app.inject({ method: 'PUT', url: quota(), headers: headers(), payload: { valorLimite: '120.00' } });
    expect(updated.json().id).toBe(first.json().id);
    expect(await prisma.cotaGastoLivre.count({ where: { perfilId: profiles[0] } })).toBe(1);
    expect((await app.inject({ method: 'PUT', url: budget(12), headers: headers(), payload: plan() })).statusCode).toBe(200);
    const date = '2026-12-15T12:00:00Z';
    const id = await createTransaction({ ehGastoLivre: true, dataHora: date });
    await createTransaction({ ehGastoLivre: true, dataHora: date, status: 'PREVISTA', valor: '30.00' });
    await createTransaction({ ehGastoLivre: false, dataHora: date, tipo: 'RECEITA', valor: '500.00' });
    await createTransaction({ ehGastoLivre: false, dataHora: date, valor: '100.00' });
    await createTransaction({ ehGastoLivre: true, dataHora: date, valor: '900.00' }, 1);
    await prisma.transacao.create({ data: { perfilId: profiles[0], tipo: 'DESPESA', valor: '17.00', status: 'EFETIVADA',
      dataHora: new Date(date), descricao: 'Legado sem categoria', ehGastoLivre: false } });
    expect(await readQuota()).toMatchObject({ valorLimite: '120.00', valorConsumido: '20.00', valorRestante: '100.00' });
    expect((await app.inject({ method: 'GET', url: budget(12), headers: headers() })).json().totais.valorRealizado).toBe('120.00');
    const uncategorized = await createTransaction({ categoriaId: null, ehGastoLivre: true, dataHora: date, valor: '7.00' });
    expect((await readQuota()).valorConsumido).toBe('27.00');
    expect((await app.inject({ method: 'GET', url: budget(12), headers: headers() })).json().totais.valorRealizado).toBe('120.00');
    await reverse(uncategorized);
    await changeTransaction(id, { valor: '130.00' });
    expect(await readQuota()).toMatchObject({ valorConsumido: '130.00', valorRestante: '-10.00' });
    await changeTransaction(id, { ehGastoLivre: false });
    expect((await readQuota()).valorConsumido).toBe('0.00');
    await changeTransaction(id, { ehGastoLivre: true, status: 'PREVISTA' });
    expect((await readQuota()).valorConsumido).toBe('0.00');
    await changeTransaction(id, { status: 'EFETIVADA', dataHora: '2027-01-01T00:00:00Z' });
    expect((await readQuota()).valorConsumido).toBe('0.00');
    await changeTransaction(id, { dataHora: '2026-12-01T00:00:00Z' });
    expect((await readQuota()).valorConsumido).toBe('130.00');
    await reverse(id);
    expect((await readQuota()).valorConsumido).toBe('0.00');
  });

  it('configura regras monetárias e canais; rejeita combinações inválidas e regras percentuais', async () => {
    const payload = { tipo: 'LIMITE_DIARIO', periodo: 'DIARIO', valorLimite: '30.00', canais: ['PUSH', 'EMAIL'] };
    const daily = await app.inject({ method: 'POST', url: rules(), headers: headers(), payload });
    expect(daily.statusCode).toBe(201);
    dailyId = daily.json().id;
    expect(daily.json().canais).toEqual(['EMAIL', 'PUSH']);
    for (const periodo of ['DIARIO', 'SEMANAL', 'MENSAL', 'ANUAL']) {
      const response = await app.inject({ method: 'POST', url: rules(), headers: headers(),
        payload: { ...payload, tipo: 'LIMITE_CATEGORIA', categoriaId: categories[0], periodo } });
      expect(response.statusCode).toBe(201);
      if (periodo === 'MENSAL') categoryRuleId = response.json().id;
    }
    for (const invalid of [
      { ...payload, valorLimite: '0' }, { ...payload, periodo: 'MENSAL' }, { ...payload, categoriaId: categories[0] },
      { ...payload, tipo: 'LIMITE_CATEGORIA' }, { ...payload, tipo: 'LIMITE_CATEGORIA', categoriaId: randomUUID() },
      { ...payload, canais: [] }, { ...payload, canais: ['SMS'] }, { ...payload, canais: ['PUSH', 'PUSH'] },
      { ...payload, tipo: 'PERCENTUAL_RENDA' }, { ...payload, percentualLimite: '10.00' }, { ...payload, baseCalculo: 'RENDA_MENSAL' },
    ]) {
      expect((await app.inject({ method: 'POST', url: rules(), headers: headers(), payload: invalid })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'PATCH', url: `${rules()}/${dailyId}`, headers: headers(), payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: `${rules()}/${categoryRuleId}`, headers: headers(), payload: { categoriaId: null } })).statusCode).toBe(400);
    const patch = await app.inject({ method: 'PATCH', url: `${rules()}/${dailyId}`, headers: headers(), payload: { canais: ['EMAIL'] } });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().canais).toEqual(['EMAIL']);
    expect(await prisma.regraGastoCanal.count({ where: { regraGastoId: dailyId } })).toBe(1);
  });

  it('avalia limite diário ao atingir, categoria ao ultrapassar, e reflete edição/reversão sem cache', async () => {
    const id = await createTransaction({ valor: '30.00' });
    let list = await readRules();
    expect(list.find((item: { id: string }) => item.id === dailyId)).toMatchObject({ valorConsumido: '30.00', alertaAtivo: true });
    expect(list.find((item: { id: string }) => item.id === categoryRuleId)).toMatchObject({ valorConsumido: '30.00', alertaAtivo: false });
    expect(list.find((item: { periodo: string }) => item.periodo === 'SEMANAL')).toMatchObject({
      valorConsumido: '30.00', inicio: '2026-09-14T00:00:00.000Z', fimExclusivo: '2026-09-21T00:00:00.000Z',
    });
    // Inclui também os 100.00 efetivados em dezembro no cenário da cota.
    expect(list.find((item: { periodo: string }) => item.periodo === 'ANUAL')).toMatchObject({ valorConsumido: '1129.00' });
    await changeTransaction(id, { valor: '30.01' });
    expect((await readRules()).find((item: { id: string }) => item.id === categoryRuleId).alertaAtivo).toBe(true);
    expect((await readRules('2026-09-16T00:00:00Z')).find((item: { id: string }) => item.id === dailyId).valorConsumido).toBe('0.00');
    expect((await app.inject({ method: 'PATCH', url: `${rules()}/${dailyId}`, headers: headers(), payload: { ativa: false } })).statusCode).toBe(200);
    expect((await readRules()).find((item: { id: string }) => item.id === dailyId)).toMatchObject({ limiteAtingido: true, alertaAtivo: false });
    await changeTransaction(id, { categoriaId: categories[1] });
    expect((await readRules()).find((item: { id: string }) => item.id === categoryRuleId).valorConsumido).toBe('0.00');
    await changeTransaction(id, { status: 'PREVISTA' });
    expect((await readRules()).find((item: { id: string }) => item.id === dailyId).valorConsumido).toBe('0.00');
    await changeTransaction(id, { status: 'EFETIVADA', categoriaId: categories[0], dataHora: '2026-09-14T12:00:00Z' });
    list = await readRules();
    expect(list.find((item: { id: string }) => item.id === dailyId).valorConsumido).toBe('0.00');
    expect(list.find((item: { id: string }) => item.id === categoryRuleId).valorConsumido).toBe('30.01');
    await reverse(id);
    expect((await readRules()).find((item: { id: string }) => item.id === categoryRuleId).valorConsumido).toBe('0.00');
    expect((await app.inject({ method: 'GET', url: `${rules()}?dataReferencia=2026-09-15`, headers: headers() })).statusCode).toBe(400);
  });

  it('bloqueia leitura/escrita de outro perfil e atualização de regra com perfil incorreto', async () => {
    const cases = [
      { method: 'GET' as const, url: budget(9, 1) }, { method: 'PUT' as const, url: budget(9, 1), payload: plan() },
      { method: 'GET' as const, url: quota(1) }, { method: 'PUT' as const, url: quota(1), payload: { valorLimite: '10.00' } },
      { method: 'GET' as const, url: rules(1) }, { method: 'POST' as const, url: rules(1), payload: { tipo: 'LIMITE_DIARIO', periodo: 'DIARIO', valorLimite: '10.00', canais: ['PUSH'] } },
      { method: 'PATCH' as const, url: `${rules(1)}/${dailyId}`, payload: { ativa: false } },
    ];
    for (const request of cases) {
      expect((await app.inject({ ...request, headers: headers() })).statusCode).toBe(403);
      expect((await app.inject(request)).statusCode).toBe(401);
    }
    expect((await app.inject({ method: 'PATCH', url: `${rules(1)}/${dailyId}`, headers: headers(1), payload: { ativa: false } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PATCH', url: `${rules()}/${randomUUID()}`, headers: headers(), payload: { ativa: false } })).statusCode).toBe(404);
  });

  it('faz rollback real de orçamento/categorias e regra/canais após falha FK no Neon', async () => {
    const repository = app.get(BudgetsRepository);
    const beforeBudget = await prisma.orcamentoCategoria.findMany({ where: { orcamentoId: budgetId }, orderBy: { id: 'asc' } });
    const original = repository.replaceCategories.bind(repository);
    const budgetSpy = jest.spyOn(repository, 'replaceCategories').mockImplementation((id, items, tx) =>
      original(id, [{ ...items[0], categoriaId: randomUUID() }], tx));
    try {
      expect((await app.inject({ method: 'PUT', url: budget(), headers: headers(), payload: plan('200.00') })).statusCode).toBe(500);
    } finally { budgetSpy.mockRestore(); }
    expect(await prisma.orcamentoCategoria.findMany({ where: { orcamentoId: budgetId }, orderBy: { id: 'asc' } })).toEqual(beforeBudget);
    const beforeRule = await prisma.regraGasto.findUniqueOrThrow({ where: { id: dailyId }, include: { canais: true } });
    const channelSpy = jest.spyOn(repository, 'replaceChannels').mockImplementation(async (id, _channels, tx) => {
      await tx.regraGastoCanal.deleteMany({ where: { regraGastoId: id } });
      await tx.regraGastoCanal.create({ data: { regraGastoId: randomUUID(), canal: 'PUSH' } });
    });
    try {
      expect((await app.inject({ method: 'PATCH', url: `${rules()}/${dailyId}`, headers: headers(),
        payload: { valorLimite: '999.00', canais: ['PUSH'] } })).statusCode).toBe(500);
      expect((await app.inject({ method: 'POST', url: rules(), headers: headers(),
        payload: { tipo: 'LIMITE_DIARIO', periodo: 'DIARIO', valorLimite: '999.00', canais: ['PUSH'] } })).statusCode).toBe(500);
    } finally { channelSpy.mockRestore(); }
    expect(await prisma.regraGasto.findUniqueOrThrow({ where: { id: dailyId }, include: { canais: true } })).toEqual(beforeRule);
    expect(await prisma.regraGasto.count({ where: { perfilId: profiles[0] } })).toBe(5);
  });

  it('não escolhe silenciosamente orçamento mensal legado duplicado nem inventa estado para planejado zero', async () => {
    const legacy = await prisma.orcamento.create({ data: { perfilId: profiles[0], tipo: 'MENSAL',
      dataInicio: new Date('2026-08-01T00:00:00Z'), dataFim: new Date('2026-08-31T00:00:00Z'),
      orcamentoCategorias: { create: { categoriaId: categories[0], valorPlanejado: '0.00' } } } });
    const response = await app.inject({ method: 'GET', url: budget(8), headers: headers() });
    expect(response.json().categorias[0]).toMatchObject({ percentualConsumido: null, estado: null });
    await prisma.orcamento.create({ data: { perfilId: profiles[0], tipo: 'MENSAL', dataInicio: legacy.dataInicio, dataFim: legacy.dataFim } });
    expect((await app.inject({ method: 'GET', url: budget(8), headers: headers() })).statusCode).toBe(409);
    expect((await app.inject({ method: 'PUT', url: budget(8), headers: headers(), payload: plan() })).statusCode).toBe(409);
  });
});
