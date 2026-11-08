import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import { BudgetsRepository } from '../src/modules/budgets/budgets.repository';

describe('Sprint 2 Parte 1: RF11/23/34/42/63/46 → HTTP → PostgreSQL', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let repository: BudgetsRepository;
  const suffix = randomUUID();
  const emails = [`s2p1-a-${suffix}@example.test`, `s2p1-b-${suffix}@example.test`];
  const profiles: string[] = [];
  const tokens: string[] = [];
  let category: string;
  let linkedExpense: string;
  let scheduled: string;
  let outside: string;
  const auth = (index = 0) => ({ authorization: `Bearer ${tokens[index === 2 ? 0 : index]}` });
  const base = (index = 0) => `/profiles/${profiles[index]}`;
  const planning = (tipo = 'EVENTO', valorPlanejado = '100.00') => ({ tipo, dataInicio: '2026-11-01', dataFim: '2026-11-30',
    categorias: [{ categoriaId: category, valorPlanejado }] });
  async function createBudget(body: Record<string, unknown> = planning(), index = 0) {
    const res = await app.inject({ method: 'POST', url: `${base(index)}/budgets`, headers: auth(index), payload: body });
    expect(res.statusCode).toBe(201);
    return res.json();
  }
  async function createTransaction(payload: Record<string, unknown> = {}, index = 0) {
    const res = await app.inject({ method: 'POST', url: `${base(index)}/transactions`, headers: auth(index),
      payload: { tipo: 'DESPESA', valor: '75.00', dataHora: '2026-11-30T23:59:59.999Z', descricao: 'Sprint 2 Parte 1 fixture',
        status: 'EFETIVADA', categoriaId: category, ...payload } });
    expect(res.statusCode).toBe(201); return res.json().id as string;
  }
  const detail = async (id: string, index = 0) => (await app.inject({ method: 'GET', url: `${base(index)}/budgets/${id}`, headers: auth(index) })).json();
  const link = (id: string, transaction: string, method: 'PUT' | 'DELETE' = 'PUT', index = 0) => app.inject({
    method, url: `${base(index)}/budgets/${id}/transactions/${transaction}`, headers: auth(index),
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useLogger(false); configureApp(app); await app.init(); await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService); repository = app.get(BudgetsRepository);
    category = (await prisma.categoria.findFirstOrThrow({ where: { ativa: true }, select: { id: true } })).id;
    for (const email of emails) {
      const register = await app.inject({ method: 'POST', url: '/auth/register', payload: { nome: 'Sprint 2 Parte 1', email, senha: 'senha de teste' } });
      expect(register.statusCode).toBe(201); profiles.push(register.json().profile.id);
      const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha: 'senha de teste' } });
      expect(login.statusCode).toBe(201); tokens.push(login.json().accessToken);
    }
    const other = await app.inject({ method: 'POST', url: '/profiles', headers: auth(), payload: { nome: 'Segundo perfil' } });
    expect(other.statusCode).toBe(201); profiles.push(other.json().id);
    linkedExpense = await createTransaction();
    await createTransaction({ valor: '100.00', dataHora: '2026-11-01T00:00:00Z' });
    scheduled = await createTransaction({ valor: '900.00', status: 'PREVISTA' });
    outside = await createTransaction({ valor: '40.00', dataHora: '2026-12-01T00:00:00Z' });
    await createTransaction({ valor: '999.00' }, 2);
  }, 90000);

  afterAll(async () => {
    jest.restoreAllMocks();
    try {
      if (prisma) {
        const users = await prisma.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
        const ids = users.map((u) => u.id);
        const owned = await prisma.perfilFinanceiro.findMany({ where: { usuarioId: { in: ids } }, select: { id: true } });
        const perfilId = { in: owned.map((p) => p.id) };
        // Somente fixtures desta execução; vínculos são removidos por CASCADE da transação.
        await prisma.transacao.deleteMany({ where: { perfilId } });
        await prisma.auditoriaTransacao.deleteMany({ where: { perfilId } });
        await prisma.orcamentoCategoria.deleteMany({ where: { orcamento: { perfilId } } });
        await prisma.orcamento.deleteMany({ where: { perfilId } });
        await prisma.subcategoria.deleteMany({ where: { perfilId } });
        await prisma.perfilFinanceiro.deleteMany({ where: { usuarioId: { in: ids } } });
        await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
      }
    } finally { await app?.close(); }
  }, 90000);

  it('mantém perfis separados, BRL, saldo inicial derivado zero e renomeação', async () => {
    const list = (await app.inject({ method: 'GET', url: '/profiles', headers: auth() })).json();
    expect(list.map((p: { id: string }) => p.id).sort()).toEqual([profiles[0], profiles[2]].sort());
    expect(list.every((p: { moedaBase: string }) => p.moedaBase === 'BRL')).toBe(true);
    expect((await app.inject({ method: 'GET', url: `${base(1)}/dashboard?year=2026&month=11`, headers: auth(1) })).json().saldoAtual).toBe('0.00');
    expect((await app.inject({ method: 'PATCH', url: base(2), headers: auth(), payload: { nome: 'Casa' } })).json().nome).toBe('Casa');
    expect((await app.inject({ method: 'GET', url: base(1), headers: auth() })).statusCode).toBe(403);
  });

  it('consulta CRIACAO/EDICAO/EXCLUSAO por ID original mesmo depois de SET NULL', async () => {
    const id = await createTransaction({ valor: '12.34' });
    expect((await app.inject({ method: 'PATCH', url: `${base()}/transactions/${id}`, headers: auth(), payload: { valor: '15.00' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `${base()}/transactions/${id}`, headers: auth() })).statusCode).toBe(204);
    const audits = `${base()}/transaction-audits`;
    const list = await app.inject({ method: 'GET', url: `${audits}?transactionId=${id}&from=2000-01-01&to=2099-12-31`, headers: auth() });
    expect(list.statusCode).toBe(200); expect(list.json()).toHaveLength(3);
    expect(list.json().map((r: { operacao: string }) => r.operacao).sort()).toEqual(['CRIACAO', 'EDICAO', 'EXCLUSAO']);
    expect(list.json().every((r: { transacaoId: string | null }) => r.transacaoId === null)).toBe(true);
    const deletion = list.json().find((r: { operacao: string }) => r.operacao === 'EXCLUSAO');
    expect(deletion.estadoAnterior).toMatchObject({ id, valor: '15', perfilId: profiles[0] });
    expect(deletion.estadoNovo).toBeNull();
    expect((await app.inject({ method: 'GET', url: `${audits}/${deletion.id}`, headers: auth() })).json()).toEqual(deletion);
    const filtered = await app.inject({ method: 'GET', url: `${audits}?transactionId=${id}&operation=EDICAO`, headers: auth() });
    expect(filtered.json()).toHaveLength(1); expect(filtered.json()[0].estadoAnterior.valor).toBe('12.34');
    expect(await prisma.transacao.findUnique({ where: { id } })).toBeNull();
    expect((await app.inject({ method: 'GET', url: `${base(2)}/transaction-audits?transactionId=${id}`, headers: auth() })).json()).toEqual([]);
    expect((await app.inject({ method: 'GET', url: `${base(2)}/transaction-audits/${deletion.id}`, headers: auth() })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `${audits}`, headers: auth(1) })).statusCode).toBe(403);
  });

  it.each(['PERIODO', 'TEMPORARIO', 'EVENTO'])('cria %s, calcula realizado sem antecipar PREVISTA e sem atravessar perfis', async (tipo) => {
    const budget = await createBudget(planning(tipo));
    expect(budget.resumo.valorRealizado).toBe(tipo === 'PERIODO' ? '175.00' : '0.00');
    if (tipo === 'PERIODO') return;
    const before = (await app.inject({ method: 'GET', url: `${base()}/dashboard?year=2026&month=11`, headers: auth() })).json().saldoAtual;
    for (const id of [linkedExpense, linkedExpense, scheduled, outside]) {
      const res = await link(budget.id, id); expect(res.statusCode).toBe(204); expect(res.body).toBe('');
    }
    expect(await prisma.transacaoOrcamento.count({ where: { orcamentoId: budget.id } })).toBe(3);
    const read = await detail(budget.id);
    expect(read.categorias).toMatchObject([{ valorRealizado: '75.00', percentualConsumido: 75, estado: 'PROXIMO_LIMITE' }]);
    expect(read.resumo).toMatchObject({ valorRealizado: '75.00', percentualConsumido: 75 });
    expect(read.transacoesVinculadas).toHaveLength(3);
    expect((await app.inject({ method: 'GET', url: `${base()}/dashboard?year=2026&month=11`, headers: auth() })).json().saldoAtual).toBe(before);
    expect((await link(budget.id, linkedExpense, 'DELETE')).statusCode).toBe(204);
    expect((await link(budget.id, linkedExpense, 'DELETE')).statusCode).toBe(204);
    expect((await detail(budget.id)).resumo.valorRealizado).toBe('0.00');
    expect(await prisma.transacao.findUnique({ where: { id: linkedExpense } })).not.toBeNull();
  });

  it('PATCH substitui categorias atomicamente, aplica >100%, filtra active=false e preserva endpoint mensal', async () => {
    const item = await createBudget(); await link(item.id, linkedExpense);
    const changed = await app.inject({ method: 'PATCH', url: `${base()}/budgets/${item.id}`, headers: auth(),
      payload: { nome: 'Evento', ativo: false, categorias: [{ categoriaId: category, valorPlanejado: '50.00' }] } });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({ nome: 'Evento', ativo: false, resumo: { percentualConsumido: 150, estado: 'EXCEDIDO' } });
    const list = await app.inject({ method: 'GET', url: `${base()}/budgets?type=EVENTO&active=false&from=2026-11-15&to=2026-11-15`, headers: auth() });
    expect(list.json().map((b: { id: string }) => b.id)).toEqual([item.id]);
    const old = await app.inject({ method: 'PUT', url: `${base()}/budgets/monthly/2026/11`, headers: auth(), payload: { categorias: planning().categorias } });
    expect(old.statusCode).toBe(200); expect(old.json().totais.valorRealizado).toBe('175.00');
    expect((await detail(old.json().id)).resumo.valorRealizado).toBe('175.00');
  });

  it('ZERO_BASED soma receitas efetivadas e previstas no mês e sinaliza falta/excesso sem gerar transações', async () => {
    await createTransaction({ tipo: 'RECEITA', valor: '60.00' });
    await createTransaction({ tipo: 'RECEITA', valor: '40.00', status: 'PREVISTA' });
    await createTransaction({ tipo: 'RECEITA', valor: '900.00' }, 2);
    const count = await prisma.transacao.count({ where: { perfilId: profiles[0] } });
    for (const [allocated, status, diferenca] of [['100.00', 'COMPLETO', '0.00'], ['80.00', 'FALTA_ALOCAR', '20.00'], ['120.00', 'EXCEDIDO', '-20.00']]) {
      const budget = await createBudget(planning('ZERO_BASED', allocated));
      expect(budget).toMatchObject({ dataInicio: '2026-11-01', dataFim: '2026-11-30', zeroBased: {
        rendaPeriodo: '100.00', totalAlocado: allocated, status, diferenca, planejamentoIncompleto: status !== 'COMPLETO' } });
    }
    expect(await prisma.transacao.count({ where: { perfilId: profiles[0] } })).toBe(count);
  });

  it('preserva um MENSAL por período em POSTs concorrentes, PATCH e convivência com o PUT mensal anterior', async () => {
    const january = { ...planning('MENSAL'), dataInicio: '2027-01-01', dataFim: '2027-01-31' };
    const results = await Promise.all([1, 2].map(() => app.inject({ method: 'POST', url: `${base()}/budgets`, headers: auth(), payload: january })));
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.statusCode === 409)?.json()).toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    const first = results.find((r) => r.statusCode === 201)!.json();
    expect(await prisma.orcamento.count({ where: { perfilId: profiles[0], tipo: 'MENSAL', dataInicio: new Date('2027-01-01T00:00:00Z'), dataFim: new Date('2027-01-31T00:00:00Z') } })).toBe(1);
    expect((await app.inject({ method: 'PATCH', url: `${base()}/budgets/${first.id}`, headers: auth(), payload: { nome: 'Janeiro', ativo: false } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `${base()}/budgets`, headers: auth(), payload: january })).statusCode).toBe(409);
    expect((await createBudget(january, 2)).perfilId).toBe(profiles[2]);
    const march = await createBudget({ ...january, dataInicio: '2027-03-01', dataFim: '2027-03-31' });
    const patch = await app.inject({ method: 'PATCH', url: `${base()}/budgets/${march.id}`, headers: auth(), payload: {
      dataInicio: january.dataInicio, dataFim: january.dataFim, categorias: [{ categoriaId: category, valorPlanejado: '999.00' }],
    } });
    expect(patch.statusCode).toBe(409);
    expect(await detail(march.id)).toEqual(march);
    const february = { ...january, dataInicio: '2027-02-01', dataFim: '2027-02-28' };
    const [post, put] = await Promise.all([
      app.inject({ method: 'POST', url: `${base()}/budgets`, headers: auth(), payload: february }),
      app.inject({ method: 'PUT', url: `${base()}/budgets/monthly/2027/2`, headers: auth(), payload: { categorias: january.categorias } }),
    ]);
    expect(put.statusCode).toBe(200); expect([201, 409]).toContain(post.statusCode);
    if (post.statusCode === 201) expect(post.json().id).toBe(put.json().id);
    expect(await prisma.orcamento.count({ where: { perfilId: profiles[0], tipo: 'MENSAL', dataInicio: new Date('2027-02-01T00:00:00Z') } })).toBe(1);
    expect((await app.inject({ method: 'GET', url: `${base()}/budgets/monthly/2027/2`, headers: auth() })).statusCode).toBe(200);
    for (const tipo of ['PERIODO', 'TEMPORARIO', 'EVENTO', 'ZERO_BASED']) {
      for (let count = 0; count < 2; count++) expect((await createBudget({ ...january, tipo })).tipo).toBe(tipo);
    }
  });

  it('isola orçamento, vínculos e auditoria entre perfis do mesmo usuário e entre contas', async () => {
    const item = await createBudget(); const foreign = await createTransaction({}, 2);
    expect((await link(item.id, foreign)).statusCode).toBe(404);
    expect((await link(item.id, linkedExpense, 'PUT', 2)).statusCode).toBe(404);
    for (const method of ['GET', 'PATCH'] as const) {
      expect((await app.inject({ method, url: `${base(2)}/budgets/${item.id}`, headers: auth(),
        ...(method === 'PATCH' && { payload: { nome: 'Invasão' } }) })).statusCode).toBe(404);
      expect((await app.inject({ method, url: `${base()}/budgets/${item.id}`, headers: auth(1),
        ...(method === 'PATCH' && { payload: { nome: 'Invasão' } }) })).statusCode).toBe(403);
    }
    const own = (await app.inject({ method: 'GET', url: `${base(2)}/budgets`, headers: auth() })).json();
    expect(own.every((row: { perfilId: string; id: string }) => row.perfilId === profiles[2] && row.id !== item.id)).toBe(true);
    expect(await prisma.transacaoOrcamento.count({ where: { orcamentoId: item.id } })).toBe(0);
  });

  it('valida DTOs/datas/UUIDs/duplicidades e protege rotas sem token', async () => {
    for (const payload of [{ ...planning(), dataInicio: '2026-02-30' }, { ...planning(), dataFim: '2026-10-31' },
      { ...planning(), categorias: [...planning().categorias, ...planning().categorias] },
      { ...planning(), categorias: [{ categoriaId: category, valorPlanejado: '0' }] },
      { ...planning(), categorias: [{ categoriaId: randomUUID(), valorPlanejado: '1' }] }]) {
      expect((await app.inject({ method: 'POST', url: `${base()}/budgets`, headers: auth(), payload })).statusCode).toBe(400);
    }
    const item = await createBudget();
    for (const payload of [{}, { tipo: 'TEMPORARIO' }, { dataFim: '2026-10-31' }]) {
      expect((await app.inject({ method: 'PATCH', url: `${base()}/budgets/${item.id}`, headers: auth(), payload })).statusCode).toBe(400);
    }
    for (const query of ['active=invalid', 'from=2026-12-01&to=2026-11-01', 'type=UNKNOWN']) {
      expect((await app.inject({ method: 'GET', url: `${base()}/budgets?${query}`, headers: auth() })).statusCode).toBe(400);
    }
    for (const query of ['operation=UNKNOWN', 'transactionId=invalid', 'from=2026-02-30', 'from=2026-12-01&to=2026-11-01']) {
      expect((await app.inject({ method: 'GET', url: `${base()}/transaction-audits?${query}`, headers: auth() })).statusCode).toBe(400);
    }
    for (const path of ['/budgets', `/budgets/${item.id}`, '/transaction-audits', `/transaction-audits/${randomUUID()}`]) {
      const res = await app.inject({ method: 'GET', url: `${base()}${path}` });
      expect(res.statusCode).toBe(401); expect(res.json()).toMatchObject({ statusCode: 401, code: 'UNAUTHENTICATED', details: [] });
    }
  });

  it('falha ao persistir categorias desfaz criação e PATCH do orçamento e não expõe detalhes internos', async () => {
    const item = await createBudget(); const original = await detail(item.id);
    const count = await prisma.orcamento.count({ where: { perfilId: profiles[0] } });
    const spy = jest.spyOn(repository, 'replaceCategories').mockImplementation(async (id, _categories, tx) => {
      await tx.orcamentoCategoria.deleteMany({ where: { orcamentoId: id } });
      await tx.orcamentoCategoria.create({ data: { orcamentoId: id, categoriaId: randomUUID(), valorPlanejado: '1.00' } });
    });
    try {
      for (const method of ['POST', 'PATCH'] as const) {
        const res = await app.inject({ method, url: `${base()}/budgets${method === 'PATCH' ? `/${item.id}` : ''}`, headers: auth(),
          payload: method === 'POST' ? planning() : { nome: 'Não persistir', categorias: planning().categorias } });
        expect(res.statusCode).toBe(500);
        expect(res.json()).toEqual({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error', details: [] });
      }
    } finally { spy.mockRestore(); }
    expect(await prisma.orcamento.count({ where: { perfilId: profiles[0] } })).toBe(count);
    expect(await detail(item.id)).toEqual(original);
  });
});
