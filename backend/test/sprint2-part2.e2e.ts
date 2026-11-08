import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { Clock } from '../src/common/clock';
import { PrismaService } from '../src/database/prisma.service';
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH';

describe('Sprint 2 Parte 2: dez US HTTP → PostgreSQL', () => {
  let app: NestFastifyApplication; let db: PrismaService;
  const emails = [`s2p2-a-${randomUUID()}@example.test`, `s2p2-b-${randomUUID()}@example.test`];
  const profiles: string[] = []; const tokens: string[] = []; let cats: string[];
  const now = new Date('2026-10-14T18:30:00Z');
  const auth = (i = 0) => ({ authorization: `Bearer ${tokens[i === 1 ? 1 : 0]}` });
  const base = (i = 0) => `/profiles/${profiles[i]}`;
  const request = (method: Method, path: string, payload?: Record<string, unknown>, i = 0) => app.inject({ method, url: `${base(i)}${path}`, headers: auth(i), ...(payload && { payload }) });
  async function transaction(payload: Record<string, unknown> = {}, i = 0) {
    const r = await request('POST', '/transactions', { tipo: 'DESPESA', valor: '1.00', descricao: 'Fixture Parte 2', dataHora: '2026-10-13T12:00:00Z', categoriaId: cats[0], status: 'EFETIVADA', ...payload }, i);
    expect(r.statusCode).toBe(201); return r.json();
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue({ now: () => new Date(now) }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter()); app.useLogger(false); configureApp(app);
    await app.init(); await app.getHttpAdapter().getInstance().ready(); db = app.get(PrismaService);
    cats = (await db.categoria.findMany({ where: { ativa: true }, orderBy: { id: 'asc' }, select: { id: true } })).map(c => c.id);
    expect(cats.length).toBeGreaterThanOrEqual(2);
    for (const email of emails) {
      const r = await app.inject({ method: 'POST', url: '/auth/register', payload: { nome: 'Parte 2', email, senha: 'senha de teste' } });
      expect(r.statusCode).toBe(201); profiles.push(r.json().profile.id);
      const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha: 'senha de teste' } });
      expect(login.statusCode).toBe(201); tokens.push(login.json().accessToken);
    }
    for (const nome of ['Projeção', 'Regras', 'Tendências']) {
      const p = await app.inject({ method: 'POST', url: '/profiles', headers: auth(), payload: { nome } });
      expect(p.statusCode).toBe(201); profiles.push(p.json().id);
    }
    await transaction({ tipo: 'RECEITA', valor: '100', dataHora: '2026-09-30T23:59:59Z' });
    await transaction({ valor: '20', dataHora: '2026-10-01T12:00:00Z' });
    await transaction({ tipo: 'RECEITA', valor: '50', dataHora: '2026-10-02T12:00:00Z' });
    await transaction({ valor: '10', dataHora: '2026-10-02T12:00:00Z' });
    await transaction({ valor: '999', status: 'PREVISTA', dataHora: '2026-10-02T12:00:00Z' });
  }, 90000);
  afterAll(async () => {
    try {
      if (db) {
        const users = await db.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } }); const ids = users.map(r => r.id);
        const own = await db.perfilFinanceiro.findMany({ where: { usuarioId: { in: ids } }, select: { id: true } }); const perfilId = { in: own.map(r => r.id) };
        await db.transacao.deleteMany({ where: { perfilId } }); await db.auditoriaTransacao.deleteMany({ where: { perfilId } });
        await db.regraAutomacao.deleteMany({ where: { perfilId } }); await db.recorrencia.deleteMany({ where: { perfilId } });
        await db.regraGastoCanal.deleteMany({ where: { regraGasto: { perfilId } } }); await db.regraGasto.deleteMany({ where: { perfilId } });
        await db.orcamentoCategoria.deleteMany({ where: { orcamento: { perfilId } } }); await db.orcamento.deleteMany({ where: { perfilId } });
        await db.aporteMeta.deleteMany({ where: { meta: { perfilId } } }); await db.meta.deleteMany({ where: { perfilId } });
        await db.planoGrandeCompra.deleteMany({ where: { perfilId } }); await db.subcategoria.deleteMany({ where: { perfilId } });
        await db.perfilFinanceiro.deleteMany({ where: { usuarioId: { in: ids } } }); await db.usuario.deleteMany({ where: { id: { in: ids } } });
      }
    } finally { await app?.close(); }
  }, 90000);

  it('US25: métricas incluem saldo anterior, excluem PREVISTA e tratam renda zero', async () => {
    const r = await request('GET', '/metrics?startDate=2026-10-01&endDate=2026-10-02');
    expect(r.statusCode).toBe(200); expect(r.json()).toEqual({ period: { startDate: '2026-10-01', endDate: '2026-10-02' }, savingsRate: { value: 40, calculable: true }, averageDailyBalance: '100.00' });
    expect((await request('GET', '/metrics', undefined, 1)).json()).toMatchObject({ savingsRate: { value: null, calculable: false }, averageDailyBalance: '0.00' });
    expect((await request('GET', '/metrics')).json().period).toEqual({ startDate: '2026-01-01', endDate: '2026-12-31' });
    for (const q of ['startDate=2026-10-01', 'startDate=2026-02-30&endDate=2026-03-01', 'startDate=2026-10-02&endDate=2026-10-01']) expect((await request('GET', `/metrics?${q}`)).statusCode).toBe(400);
  });

  it('US20: CRUD, prioridade, substituição concorrente e classificação explícita preservada', async () => {
    const sub = (await request('POST', '/subcategories', { categoriaId: cats[0], nome: 'Sub Parte 2' })).json();
    const body = { categoriaId: cats[0], atributoAlvo: 'essencialidade', valorDestino: 'ESSENCIAL' };
    const first = await request('POST', '/automation-rules', body); expect(first.statusCode).toBe(201);
    expect((await request('GET', `/automation-rules/${first.json().id}`)).json()).toMatchObject(body);
    const subRule = await request('POST', '/automation-rules', { subcategoriaId: sub.id, atributoAlvo: 'essencialidade', valorDestino: 'NAO_ESSENCIAL' });
    expect(subRule.statusCode).toBe(201);
    expect((await transaction({ subcategoriaId: sub.id })).essencialidade).toBe('NAO_ESSENCIAL');
    expect((await transaction({ subcategoriaId: sub.id, essencialidade: 'ESSENCIAL' })).essencialidade).toBe('ESSENCIAL');
    expect((await transaction({ essencialidade: 'NAO_CLASSIFICADA' })).essencialidade).toBe('NAO_CLASSIFICADA');
    const race = await Promise.all(['ESSENCIAL', 'NAO_ESSENCIAL'].map(valorDestino => request('POST', '/automation-rules', { ...body, valorDestino })));
    expect(race.map(r => r.statusCode)).toEqual([201, 201]);
    const active = (await request('GET', '/automation-rules?active=true')).json();
    expect(active.filter((r: { categoriaId: string }) => r.categoriaId === cats[0])).toHaveLength(1);
    expect((await request('GET', '/automation-rules?active=false')).json().length).toBeGreaterThanOrEqual(2);
    expect((await request('PATCH', `/automation-rules/${subRule.json().id}`, { ativa: false })).statusCode).toBe(200);
    expect((await request('GET', `/automation-rules/${subRule.json().id}`, undefined, 2)).statusCode).toBe(404);
    for (const invalid of [{ ...body, subcategoriaId: sub.id }, { atributoAlvo: 'essencialidade', valorDestino: 'ESSENCIAL' },
      { ...body, categoriaId: null, subcategoriaId: randomUUID() }, { ...body, atributoAlvo: 'valor' }, { ...body, valorDestino: 'OUTRO' }]) {
      expect((await request('POST', '/automation-rules', invalid)).statusCode).toBe(400);
    }
    expect((await request('GET', '/automation-rules?active=invalid')).statusCode).toBe(400);
  });

  it('US48: histórico normalizado, maioria e correção posterior sem consulta a outro perfil', async () => {
    const desc = `Uber viagem ${randomUUID()}`;
    const first = await transaction({ descricao: desc, categoriaId: cats[0] });
    const second = await transaction({ descricao: desc.toUpperCase(), categoriaId: cats[0] });
    await transaction({ descricao: `  ${desc}  `, categoriaId: cats[1] });
    let r = await request('POST', '/category-suggestions', { descricao: ` ${desc.replace(/ /g, '  ')} ` });
    expect(r.statusCode).toBe(200); expect(r.json()).toMatchObject({ suggested: true, category: { id: cats[0] } });
    expect((await request('POST', '/category-suggestions', { descricao: desc }, 2)).json()).toEqual({ suggested: false, category: null });
    expect((await request('PATCH', `/transactions/${first.id}`, { categoriaId: cats[1] })).statusCode).toBe(200);
    r = await request('POST', '/category-suggestions', { descricao: desc }); expect(r.json().category.id).toBe(cats[1]);
    expect((await request('GET', `/transactions/${second.id}`)).statusCode).toBe(200);
    expect((await request('POST', '/category-suggestions', { descricao: 'nunca visto' })).json()).toEqual({ suggested: false, category: null });
  });

  it('US31: endpoints autenticados, status 200, Decimal e nenhuma escrita', async () => {
    const count = await db.transacao.count({ where: { perfilId: profiles[0] } });
    const compound = await app.inject({ method: 'POST', url: '/calculations/compound-interest', headers: auth(), payload: { valorInicial: '1000.00', taxaPercentual: 1, quantidadePeriodos: 12 } });
    expect(compound.statusCode).toBe(200); expect(compound.json()).toMatchObject({ valorFuturo: '1126.83', jurosAcumulados: '126.83' });
    const cost = await app.inject({ method: 'POST', url: '/calculations/opportunity-cost', headers: auth(), payload: { valorGastoHipotetico: '3000', taxaRetornoPercentual: 0.8, quantidadePeriodos: 24 } });
    expect(cost.statusCode).toBe(200); expect(cost.json().valorFuturoHipotetico).toBe('3632.24');
    for (const body of [{ valorInicial: '-1', taxaPercentual: 1, quantidadePeriodos: 1 }, { valorInicial: '100', quantidadePeriodos: 1 }, { valorInicial: '100', taxaPercentual: 1, quantidadePeriodos: 1.5 }]) {
      expect((await app.inject({ method: 'POST', url: '/calculations/compound-interest', headers: auth(), payload: body })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'POST', url: '/calculations/compound-interest', payload: {} })).statusCode).toBe(401);
    expect(await db.transacao.count({ where: { perfilId: profiles[0] } })).toBe(count);
  });

  it('US32: expande recorrência sem duplicar a PREVISTA gerada nem persistir novas ocorrências', async () => {
    await transaction({ tipo: 'RECEITA', valor: '1000' }, 2);
    await transaction({ valor: '50', status: 'PREVISTA', dataHora: '2026-10-20T12:00:00Z' }, 2);
    const recurrence = await request('POST', '/recurrences', { tipoTransacao: 'DESPESA', valor: '10', descricao: 'Semanal', categoriaId: cats[0], frequencia: 'SEMANAL', proximaOcorrencia: '2026-10-15T12:00:00Z' }, 2);
    expect(recurrence.statusCode).toBe(201);
    const count = await db.transacao.count({ where: { perfilId: profiles[2] } });
    const r = await request('GET', '/cash-flow/projection', undefined, 2); expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ saldoAtual: '1000.00', saldoProjetadoFimMes: '920.00', next30Days: {
      startDate: '2026-10-14', endDate: '2026-11-12', saidasPrevistas: '100.00', saldoProjetadoFinal: '900.00' } });
    expect(r.json().next30Days.movimentos).toHaveLength(6);
    expect(r.json().next30Days.movimentos.filter((m: { origem: string }) => m.origem === 'RECORRENCIA')).toHaveLength(5);
    expect(await db.transacao.count({ where: { perfilId: profiles[2] } })).toBe(count);
  });

  it('US27: simulação à vista/parcelada usa orçamento mensal e projeção sem gravação', async () => {
    const budget = await request('PUT', '/budgets/monthly/2026/10', { categorias: [{ categoriaId: cats[0], valorPlanejado: '200.00' }] }, 2);
    expect(budget.statusCode).toBe(200);
    const counts = [await db.transacao.count({ where: { perfilId: profiles[2] } }), await db.recorrencia.count({ where: { perfilId: profiles[2] } })];
    const r = await request('POST', '/simulations/purchase-impact', { valor: '100.00', parcelas: 1, dataPrimeiraParcela: '2026-10-20', categoriaId: cats[0] }, 2);
    expect(r.statusCode).toBe(200); expect(r.json()).toMatchObject({ criaTransacoes: false, meses: [{ competencia: '2026-10', valorParcela: '100.00', rendaProjetada: '1000.00',
      impactoOrcamentoCategoria: { valorPlanejado: '200.00', valorProjetadoComCompra: '180.00', percentualProjetado: 90 } }] });
    const installments = await request('POST', '/simulations/purchase-impact', { valor: '100.00', parcelas: 3, dataPrimeiraParcela: '2026-12-31' }, 2);
    expect(installments.statusCode).toBe(200);
    expect(installments.json().meses.map((m: { valorParcela: string }) => m.valorParcela)).toEqual(['33.34', '33.33', '33.33']);
    expect(installments.json().meses[0].impactoOrcamentoCategoria).toBeNull();
    expect([await db.transacao.count({ where: { perfilId: profiles[2] } }), await db.recorrencia.count({ where: { perfilId: profiles[2] } })]).toEqual(counts);
    expect((await request('POST', '/simulations/purchase-impact', { valor: '0', parcelas: 1, dataPrimeiraParcela: '2026-10-20' }, 2)).statusCode).toBe(400);
  });

  it('US35: compara m?dia mensal do trimestre anterior com m?s atual, limites inclusivos ±10% e todos os casos com base zero', async () => {
    const previous = await transaction({ categoriaId: cats[1], valor: '300', dataHora: '2026-07-01T00:00:00Z' }, 4);
    const current = await transaction({ categoriaId: cats[1], valor: '110', dataHora: '2026-10-10T12:00:00Z' }, 4);
    await transaction({ categoriaId: cats[1], valor: '999', dataHora: '2026-10-14T18:30:01Z' }, 4);
    await transaction({ categoriaId: cats[1], valor: '999', dataHora: '2026-11-01T00:00:00Z' }, 4);
    await transaction({ categoriaId: cats[1], valor: '999', status: 'PREVISTA', dataHora: '2026-10-13T12:00:00Z' }, 4);
    const r = await request('GET', '/analytics/spending-trends', undefined, 4); expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ currentMonth: { startDate: '2026-10-01', partial: true }, referenceQuarter: { startDate: '2026-07-01', endDate: '2026-09-30' } });
    const row = r.json().categories.find((c: { categoriaId: string }) => c.categoriaId === cats[1]);
    expect(row).toMatchObject({ currentMonthTotal: '110.00', referenceMonthlyAverage: '100.00', variationPercentage: 10, trend: 'ESTAVEL' });
    for (const [value, trend] of [['90', 'ESTAVEL'], ['111', 'AUMENTANDO'], ['89', 'DIMINUINDO']]) {
      expect((await request('PATCH', `/transactions/${current.id}`, { valor: value }, 4)).statusCode).toBe(200);
      const result = (await request('GET', '/analytics/spending-trends', undefined, 4)).json();
      expect(result.categories.find((c: { categoriaId: string }) => c.categoriaId === cats[1]).trend).toBe(trend);
    }
    expect((await request('PATCH', `/transactions/${current.id}`, { status: 'PREVISTA' }, 4)).statusCode).toBe(200);
    expect((await request('GET', '/analytics/spending-trends', undefined, 4)).json().categories.find((c: { categoriaId: string }) => c.categoriaId === cats[1]).trend).toBe('DIMINUINDO');
    expect((await request('PATCH', `/transactions/${previous.id}`, { status: 'PREVISTA' }, 4)).statusCode).toBe(200);
    expect((await request('GET', '/analytics/spending-trends', undefined, 4)).json().categories.find((c: { categoriaId: string }) => c.categoriaId === cats[1]).trend).toBe('ESTAVEL');
    expect((await request('PATCH', `/transactions/${current.id}`, { status: 'EFETIVADA' }, 4)).statusCode).toBe(200);
    expect((await request('GET', '/analytics/spending-trends', undefined, 4)).json().categories.find((c: { categoriaId: string }) => c.categoriaId === cats[1]).trend).toBe('AUMENTANDO');
    expect((await request('GET', '/analytics/spending-trends', undefined, 1)).json().categories.every((c: { trend: string }) => c.trend === 'ESTAVEL')).toBe(true);
  });

  it('US51: CRUD de plano com prazo derivado opcional e ownership', async () => {
    const r = await request('POST', '/large-purchase-plans', { nome: 'Notebook', valorTotal: '100', valorMensalPlanejado: '30', dataInicio: '2026-11-01' });
    expect(r.statusCode).toBe(201); const id = r.json().id;
    expect(r.json().quantidadeMesesEstimada).toBe(4);
    expect(await db.planoGrandeCompra.findUniqueOrThrow({ where: { id } })).not.toHaveProperty('quantidadeMesesEstimada');
    expect((await request('GET', `/large-purchase-plans/${id}`)).statusCode).toBe(200);
    expect((await request('GET', '/large-purchase-plans')).json()).toHaveLength(1);
    const changed = await request('PATCH', `/large-purchase-plans/${id}`, { nome: 'Plano editado', valorMensalPlanejado: null });
    expect(changed.statusCode).toBe(200); expect(changed.json().quantidadeMesesEstimada).toBeNull();
    expect((await request('GET', `/large-purchase-plans/${id}`, undefined, 2)).statusCode).toBe(404);
    expect((await request('POST', '/large-purchase-plans', { nome: 'Inválido', valorTotal: '100', valorMensalPlanejado: '0', dataInicio: '2026-11-01' })).statusCode).toBe(400);
  });

  it('US51/21: dois clientes editam campos distintos sem regravar valores omitidos no PATCH', async () => {
    const created = await request('POST', '/large-purchase-plans', { nome: 'Plano concorrente', valorTotal: '100', valorMensalPlanejado: '10', dataInicio: '2026-11-01' });
    expect(created.statusCode).toBe(201); const id = created.json().id;
    const responses = await Promise.all([
      request('PATCH', `/large-purchase-plans/${id}`, { valorTotal: '200' }),
      request('PATCH', `/large-purchase-plans/${id}`, { nome: 'Nome atualizado por outro cliente' }),
    ]);
    expect(responses.map(r => r.statusCode)).toEqual([200, 200]);
    const current = await request('GET', `/large-purchase-plans/${id}`);
    expect(current.json()).toMatchObject({ nome: 'Nome atualizado por outro cliente', valorTotal: '200.00', valorMensalPlanejado: '10.00', quantidadeMesesEstimada: 20 });
    expect(Date.parse(current.json().updatedAt)).toBeGreaterThanOrEqual(Date.parse(created.json().updatedAt));
  });

  it('US52: percentual por base, detalhe, canais e limites monetários sem regressão', async () => {
    await transaction({ tipo: 'RECEITA', valor: '1000', dataHora: '2026-10-01T12:00:00Z' }, 3);
    await transaction({ tipo: 'RECEITA', valor: '1000', status: 'PREVISTA', dataHora: '2026-10-20T12:00:00Z' }, 3);
    await transaction({ valor: '150', dataHora: '2026-10-14T12:00:00Z' }, 3);
    const common = { tipo: 'PERCENTUAL_RENDA', categoriaId: cats[0], percentualLimite: 10, periodo: 'MENSAL', canais: ['PUSH', 'EMAIL'] };
    for (const [baseCalculo, limiteCalculado, violada] of [['RENDA_EFETIVADA', '100.00', true], ['RENDA_PLANEJADA', '200.00', false]]) {
      const r = await request('POST', '/spending-rules', { ...common, baseCalculo }, 3); expect(r.statusCode).toBe(201);
      expect(r.json()).toMatchObject({ valorLimite: null, percentualLimite: 10, baseCalculo, avaliacaoAtual: { valorAtual: '150.00', limiteCalculado, violada } });
      expect(await db.regraGastoCanal.count({ where: { regraGastoId: r.json().id } })).toBe(2);
      expect((await request('GET', `/spending-rules/${r.json().id}?dataReferencia=2026-10-14T12%3A00%3A00Z`, undefined, 3)).json().avaliacaoAtual).toEqual(r.json().avaliacaoAtual);
      expect((await request('PATCH', `/spending-rules/${r.json().id}`, { percentualLimite: 20, canais: ['PUSH'] }, 3)).statusCode).toBe(200);
      expect((await request('GET', `/spending-rules/${r.json().id}`, undefined, 2)).statusCode).toBe(404);
    }
    for (const payload of [{ ...common }, { ...common, baseCalculo: 'RENDA_EFETIVADA', valorLimite: '100' }, { ...common, baseCalculo: 'RENDA_EFETIVADA', percentualLimite: 0 }]) {
      expect((await request('POST', '/spending-rules', payload, 3)).statusCode).toBe(400);
    }
    for (const tipo of ['LIMITE_DIARIO', 'LIMITE_CATEGORIA']) {
      const r = await request('POST', '/spending-rules', { tipo, valorLimite: '150', periodo: tipo === 'LIMITE_DIARIO' ? 'DIARIO' : 'MENSAL', canais: ['PUSH'], ...(tipo === 'LIMITE_CATEGORIA' && { categoriaId: cats[0] }) }, 3);
      expect(r.statusCode).toBe(201);
      const evaluated = await request('GET', `/spending-rules/${r.json().id}?dataReferencia=2026-10-14T12%3A00%3A00Z`, undefined, 3);
      expect(evaluated.json().avaliacaoAtual.violada).toBe(tipo === 'LIMITE_DIARIO');
    }
  });

  it('US58: janelas 6m/12m, fechadas no período e aportes após prazo excluídos', async () => {
    for (const [nome, dataLimite, dataHora] of [['Cumprida', '2026-10-01', '2026-10-01T23:59:59.999Z'], ['Atrasada', '2026-10-01', '2026-10-02T00:00:00Z'], ['Aberta', '2026-11-01', '2026-10-13T12:00:00Z']]) {
      const goal = await request('POST', '/goals', { nome, dataLimite, valorAlvo: '100', frequenciaSugestao: 'DIARIA' }); expect(goal.statusCode).toBe(201);
      expect((await request('POST', `/goals/${goal.json().id}/contributions`, { valor: '100', dataHora })).statusCode).toBe(201);
    }
    for (const window of ['6m', '12m']) {
      const r = await request('GET', `/goals/completion-rate?window=${window}`); expect(r.statusCode).toBe(200);
      expect(r.json()).toMatchObject({ window, closedGoals: 2, completedGoals: 1, completionRate: 50 });
    }
    expect((await request('GET', '/goals/completion-rate?window=6m', undefined, 1)).json().completionRate).toBeNull();
    for (const q of ['', '?window=2m']) expect((await request('GET', `/goals/completion-rate${q}`)).statusCode).toBe(400);
  });

  it('JWT/ownership cobrem todas as rotas da Parte 2, inclusive cálculos por perfil', async () => {
    const cases: [Method, string, Record<string, unknown>?][] = [
      ['GET', '/automation-rules'], ['POST', '/automation-rules', { categoriaId: cats[0], atributoAlvo: 'essencialidade', valorDestino: 'ESSENCIAL' }],
      ['GET', `/automation-rules/${randomUUID()}`], ['PATCH', `/automation-rules/${randomUUID()}`, { ativa: false }],
      ['GET', '/metrics'], ['POST', '/simulations/purchase-impact', { valor: '10', parcelas: 1, dataPrimeiraParcela: '2026-11-01' }],
      ['GET', '/cash-flow/projection'], ['GET', '/analytics/spending-trends'], ['GET', '/large-purchase-plans'],
      ['POST', '/large-purchase-plans', { nome: 'Teste', valorTotal: '100', dataInicio: '2026-11-01' }],
      ['GET', `/large-purchase-plans/${randomUUID()}`], ['PATCH', `/large-purchase-plans/${randomUUID()}`, { nome: 'Teste' }],
      ['GET', '/spending-rules'], ['POST', '/spending-rules', { tipo: 'LIMITE_DIARIO', valorLimite: '10', periodo: 'DIARIO', canais: ['PUSH'] }],
      ['GET', `/spending-rules/${randomUUID()}`], ['PATCH', `/spending-rules/${randomUUID()}`, { ativa: false }],
      ['GET', '/goals/completion-rate?window=6m'], ['POST', '/category-suggestions', { descricao: 'Uber' }],
    ];
    for (const [method, path, payload] of cases) {
      expect((await app.inject({ method, url: `${base()}${path}`, ...(payload && { payload }) })).statusCode).toBe(401);
      const r = await app.inject({ method, url: `${base()}${path}`, headers: auth(1), ...(payload && { payload }) });
      expect(r.statusCode).toBe(403); expect(r.json()).toMatchObject({ code: 'FORBIDDEN', details: [] });
    }
  });
});
