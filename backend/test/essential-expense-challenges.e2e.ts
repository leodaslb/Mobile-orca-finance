import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { Clock } from '../src/common/clock';
import { PrismaService } from '../src/database/prisma.service';

describe('RF65 → US59 → RN-DES-02: leitura HTTP e PostgreSQL', () => {
  let app: NestFastifyApplication; let db: PrismaService; let category: string; let otherCategory: string; let challenge: string; let generic: string;
  let now = new Date('2026-11-15T12:00:00Z');
  const profiles: string[] = []; const tokens: string[] = []; const emails = [0, 1].map(() => `us59-${randomUUID()}@example.test`);
  const base = (i = 0) => `/profiles/${profiles[i]}/essential-expense-challenges`;
  const get = (suffix = '', profile = 0, user = 0) => app.inject({ method: 'GET', url: base(profile) + suffix, headers: { authorization: `Bearer ${tokens[user]}` } });
  const write = (method: 'POST' | 'PATCH' | 'PUT', url: string, payload: Record<string, unknown>, user = 0) => app.inject({ method, url, payload, headers: { authorization: `Bearer ${tokens[user]}` } });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue({ now: () => new Date(now) }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter()); app.useLogger(false); configureApp(app);
    await app.init(); await app.getHttpAdapter().getInstance().ready(); db = app.get(PrismaService);
    const cats = await db.categoria.findMany({ where: { ativa: true }, select: { id: true }, orderBy: { id: 'asc' }, take: 2 });
    expect(cats).toHaveLength(2); category = cats[0].id; otherCategory = cats[1].id;
    for (const email of emails) {
      const r = await app.inject({ method: 'POST', url: '/auth/register', payload: { nome: 'US59', email, senha: 'senha de teste' } }); expect(r.statusCode).toBe(201); profiles.push(r.json().profile.id);
      const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha: 'senha de teste' } }); expect(login.statusCode).toBe(201); tokens.push(login.json().accessToken);
    }
    // Fixture persistida representa aceite anterior; os endpoints não criam dados durante consultas.
    challenge = (await db.desafioEconomia.create({ data: { perfilId: profiles[0], categoriaId: category, valorReferencia: '1200', valorMetaPeriodo: '1000', percentualReducao: '16.6667',
      dataInicio: new Date('2026-11-01Z'), dataFim: new Date('2026-11-30Z') } })).id;
    generic = (await db.desafioEconomia.create({ data: { perfilId: profiles[0], nome: 'US17 preservada', valorAlvo: '42.50',
      dataInicio: new Date('2026-01-01Z'), dataFim: new Date('2026-01-31Z') } })).id;
    const expense = { perfilId: profiles[0], categoriaId: category, tipo: 'DESPESA' as const, status: 'EFETIVADA' as const, descricao: 'Delivery', valor: '600', dataHora: new Date('2026-10-20T12:00:00Z') };
    await db.transacao.createMany({ data: [expense, { ...expense, dataHora: new Date('2026-10-31T23:59:59.999Z') },
      { ...expense, valor: '700', dataHora: new Date('2026-11-01T00:00:00Z') },
      { ...expense, valor: '9999', dataHora: new Date('2026-12-01T00:00:00Z') },
      { ...expense, valor: '9999', tipo: 'RECEITA', dataHora: new Date('2026-11-02Z') },
      { ...expense, valor: '9999', status: 'PREVISTA', dataHora: new Date('2026-11-02Z') },
      { ...expense, valor: '9999', categoriaId: otherCategory, dataHora: new Date('2026-11-02Z') },
      { ...expense, valor: '9999', perfilId: profiles[1] },
      { ...expense, valor: '9999', perfilId: profiles[1], dataHora: new Date('2026-11-02Z') } ] });
  }, 90000);
  afterAll(async () => {
    try {
      if (db) {
        const users = await db.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } }); const ids = users.map(r => r.id);
        const p = await db.perfilFinanceiro.findMany({ where: { usuarioId: { in: ids } }, select: { id: true } }); const perfilId = { in: p.map(r => r.id) };
        await db.desafioEconomia.deleteMany({ where: { perfilId } }); await db.transacao.deleteMany({ where: { perfilId } });
        await db.orcamentoCategoria.deleteMany({ where: { orcamento: { perfilId } } }); await db.orcamento.deleteMany({ where: { perfilId } });
        await db.perfilFinanceiro.deleteMany({ where: { usuarioId: { in: ids } } }); await db.usuario.deleteMany({ where: { id: { in: ids } } });
      }
    } finally { await app?.close(); }
  }, 90000);
  it('lista apenas US59, preserva desafio genérico e calcula gasto filtrado sem persistir progresso', async () => {
    const count = await db.desafioEconomia.count({ where: { perfilId: profiles[0] } });
    const r = await get(); expect(r.statusCode).toBe(200); expect(r.json()).toHaveLength(1);
    expect(r.json()[0]).toMatchObject({ id: challenge, valorReferencia: '1200.00', valorMeta: '1000.00', valorGastoAtual: '700.00', valorDisponivelAteMeta: '300.00', percentualPeriodoConsumido: 70, status: 'EM_ANDAMENTO' });
    expect(r.json()[0].updatedAt).toEqual(expect.any(String));
    expect((await get(`/${challenge}`)).statusCode).toBe(200); expect((await get(`/${generic}`)).statusCode).toBe(404);
    expect((await db.desafioEconomia.findUniqueOrThrow({ where: { id: generic } })).valorAlvo!.toFixed(2)).toBe('42.50');
    expect(await db.desafioEconomia.count({ where: { perfilId: profiles[0] } })).toBe(count);
  });
  it('sugestões não incluem receita, outra categoria ou histórico de outro perfil', async () => {
    const r = await get(`/${challenge}/suggestions`); expect(r.statusCode).toBe(200);
    expect(r.json().suggestions).toEqual([
      { type: 'WEEKLY_TARGET', valorSemanalAproximado: '250.00', semanasAproximadas: 4 },
      { type: 'AVERAGE_TRANSACTION', quantidadeTransacoes: 2, valorMedioHistorico: '600.00', valorMedioSugerido: '500.00' },
      { type: 'HIGH_IMPACT_DESCRIPTION', descricao: 'Delivery', valorTotal: '1200.00', quantidadeTransacoes: 2, participacaoPercentual: 100 },
    ]);
  });
  it('fim inclui o último dia completo e só conclui depois, com igualdade ou excesso', async () => {
    now = new Date('2026-11-30T23:59:59.999Z'); expect((await get(`/${challenge}`)).json().status).toBe('EM_ANDAMENTO');
    await db.transacao.create({ data: { perfilId: profiles[0], categoriaId: category, tipo: 'DESPESA', status: 'EFETIVADA', descricao: 'Fim do mês', valor: '300', dataHora: now } });
    now = new Date('2026-12-01T00:00:00Z'); expect((await get(`/${challenge}`)).json()).toMatchObject({ valorGastoAtual: '1000.00', status: 'CONCLUIDO' });
    await db.transacao.create({ data: { perfilId: profiles[0], categoriaId: category, tipo: 'DESPESA', status: 'EFETIVADA', descricao: 'Excesso', valor: '0.01', dataHora: new Date('2026-11-30T23:59:59.999Z') } });
    expect((await get(`/${challenge}`)).json()).toMatchObject({ valorGastoAtual: '1000.01', valorDisponivelAteMeta: '-0.01', status: 'NAO_ATINGIDO' });
  });
  it('JWT e ownership protegem lista, detalhe e sugestões; perfil próprio não acessa id de outro', async () => {
    expect((await app.inject({ method: 'GET', url: base() })).statusCode).toBe(401);
    for (const suffix of ['', `/${challenge}`, `/${challenge}/suggestions`]) expect((await get(suffix, 0, 1)).statusCode).toBe(403);
    expect((await get(`/${challenge}`, 1, 1)).statusCode).toBe(404);
    expect((await get('', 1, 1)).json()).toEqual([]);
  });
  it('candidatos usam mês atual, incluem categoria mista, ordenam top 3 e não criam desafios', async () => {
    now = new Date('2026-10-15T12:00:00Z');
    const created = await write('POST', '/profiles', { nome: 'Candidatos US59' }); expect(created.statusCode).toBe(201); profiles.push(created.json().id);
    const cats = await db.categoria.findMany({ where: { ativa: true }, select: { id: true }, orderBy: { id: 'asc' }, take: 6 }); expect(cats).toHaveLength(6);
    const monthly = await write('PUT', `/profiles/${profiles[2]}/budgets/monthly/2026/10`, { categorias: cats.map(c => ({ categoriaId: c.id, valorPlanejado: '1000' })) }); expect(monthly.statusCode).toBe(200);
    const fixture = { perfilId: profiles[2], tipo: 'DESPESA' as const, status: 'EFETIVADA' as const, essencialidade: 'ESSENCIAL' as const, descricao: 'Origem atual', dataHora: new Date('2026-10-10Z') };
    // Quatro elegíveis; cat[4] não essencial e cat[5] sem excesso mínimo não entram.
    await db.transacao.createMany({ data: [
      { ...fixture, categoriaId: cats[0].id, valor: '1050' }, { ...fixture, categoriaId: cats[1].id, valor: '1200' },
      { ...fixture, categoriaId: cats[2].id, valor: '1250' }, { ...fixture, categoriaId: cats[3].id, valor: '1' },
      { ...fixture, categoriaId: cats[3].id, valor: '1999', essencialidade: 'NAO_CLASSIFICADA' },
      { ...fixture, categoriaId: cats[4].id, valor: '5000', essencialidade: 'NAO_ESSENCIAL' },
      { ...fixture, categoriaId: cats[5].id, valor: '1049.99' },
      { ...fixture, categoriaId: cats[1].id, valor: '9999', status: 'PREVISTA' },
      { ...fixture, categoriaId: cats[1].id, valor: '9999', tipo: 'RECEITA' },
      { ...fixture, categoriaId: cats[1].id, valor: '9999', dataHora: new Date('2026-09-30T23:59:59.999Z') },
    ] });
    const r = await get('/candidates', 2); expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ baseline: { startDate: '2026-10-01', endDate: '2026-10-31' }, challengePeriod: { startDate: '2026-11-01', endDate: '2026-11-30' } });
    expect(r.json().candidates.map((c: { categoriaId: string }) => c.categoriaId)).toEqual([cats[3].id, cats[2].id, cats[1].id]);
    expect(r.json().candidates[0]).toMatchObject({ valorRealizado: '2000.00', percentualEstouro: 100, percentualReducaoSugerida: 20, valorMetaSugerido: '1600.00' });
    expect(await db.desafioEconomia.count({ where: { perfilId: profiles[2] } })).toBe(0);
    expect((await get('/candidates', 2, 1)).statusCode).toBe(403);
    expect((await write('POST', base(2), { categoriaId: cats[4].id })).statusCode).toBe(400);
    expect((await write('POST', base(2), { categoriaId: cats[5].id })).statusCode).toBe(400);
    expect((await write('POST', base(2), { categoriaId: cats[3].id, percentualReducao: 99, valorMeta: '1' })).statusCode).toBe(400);
  });
  it('dois POST simultâneos aceitam só um; servidor recalcula após preview e reserva o próximo mês', async () => {
    const proposal = (await get('/candidates', 2)).json().candidates[0];
    await db.transacao.create({ data: { perfilId: profiles[2], categoriaId: proposal.categoriaId, tipo: 'DESPESA', status: 'EFETIVADA', descricao: 'Após proposta', valor: '500', dataHora: new Date('2026-10-11Z') } });
    const responses = await Promise.all([write('POST', base(2), { categoriaId: proposal.categoriaId }), write('POST', base(2), { categoriaId: proposal.categoriaId })]);
    expect(responses.map(r => r.statusCode).sort()).toEqual([201, 409]);
    const accepted = responses.find(r => r.statusCode === 201)!.json();
    expect(accepted).toMatchObject({ dataInicio: '2026-11-01', dataFim: '2026-11-30', valorReferencia: '2500.00', valorMeta: '2000.00', percentualReducao: 20, status: 'EM_ANDAMENTO' });
    expect(await db.desafioEconomia.count({ where: { perfilId: profiles[2] } })).toBe(1);
    expect((await write('POST', base(2), { categoriaId: proposal.categoriaId })).statusCode).toBe(409);
    expect((await write('POST', base(2), { categoriaId: proposal.categoriaId }, 1)).statusCode).toBe(403);
  });
  it('PATCH muda somente nome e timestamp, bloqueia campos calculados e protege o perfil', async () => {
    const current = (await get('', 2)).json()[0]; const url = `${base(2)}/${current.id}`;
    const updated = await write('PATCH', url, { nome: 'Meu desafio' }); expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ nome: 'Meu desafio', valorReferencia: current.valorReferencia, valorMeta: current.valorMeta, categoriaId: current.categoriaId, percentualReducao: current.percentualReducao });
    expect(new Date(updated.json().updatedAt).getTime()).toBeGreaterThan(new Date(current.updatedAt).getTime());
    for (const payload of [{}, { nome: ' ' }, { nome: null }, { nome: 'Inválido', valorMeta: '0.01' }, { nome: 'Inválido', categoriaId: category }, { nome: 'Inválido', dataInicio: '2026-01-01' }]) {
      expect((await write('PATCH', url, payload)).statusCode).toBe(400);
    }
    expect((await write('PATCH', url, { nome: 'Invasão' }, 1)).statusCode).toBe(403);
    expect((await write('PATCH', `${base(1)}/${current.id}`, { nome: 'Outro perfil' }, 1)).statusCode).toBe(404);
  });
  it('sem orçamento mensal não cria; estouro exato 5% é aceito e desafios antigos não bloqueiam outro perfil', async () => {
    const created = await write('POST', '/profiles', { nome: 'Limiar US59' }); expect(created.statusCode).toBe(201); profiles.push(created.json().id);
    expect((await write('POST', base(3), { categoriaId: category })).statusCode).toBe(400);
    expect((await write('PUT', `/profiles/${profiles[3]}/budgets/monthly/2026/10`, { categorias: [{ categoriaId: category, valorPlanejado: '1000' }] })).statusCode).toBe(200);
    await db.transacao.create({ data: { perfilId: profiles[3], categoriaId: category, tipo: 'DESPESA', status: 'EFETIVADA', essencialidade: 'ESSENCIAL', descricao: 'Limiar 5%', valor: '1050', dataHora: new Date('2026-10-10Z') } });
    expect((await get('/candidates', 3)).json().candidates[0]).toMatchObject({ percentualEstouro: 5, valorMetaSugerido: '1000.00' });
    await db.desafioEconomia.create({ data: { perfilId: profiles[3], valorAlvo: '12', dataInicio: new Date('2026-09-01Z'), dataFim: new Date('2026-09-30Z') } });
    const r = await write('POST', base(3), { categoriaId: category }); expect(r.statusCode).toBe(201); expect(r.json()).toMatchObject({ valorReferencia: '1050.00', valorMeta: '1000.00', percentualReducao: 4.7619 });
  });
});
