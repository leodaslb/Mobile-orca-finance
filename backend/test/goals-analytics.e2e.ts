import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { strFromU8, unzipSync } from 'fflate';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/database/prisma.service';

describe('Sprint 1: US10/13/14/15 HTTP → Neon', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const emails = [`insights-a-${suffix}@example.test`, `insights-b-${suffix}@example.test`];
  const profiles: string[] = [];
  const tokens: string[] = [];
  const transactions: string[] = [];
  let category: { id: string; nome: string };
  let goalId: string;
  let otherGoal: string;
  const headers = (index = 0) => ({ authorization: `Bearer ${tokens[index]}` });
  const base = (index = 0) => `/profiles/${profiles[index]}`;
  const goals = (index = 0) => `${base(index)}/goals`;
  const detail = (id = goalId) => `${goals()}/${id}`;
  const period = 'startDate=2026-10-01&endDate=2026-10-31';
  const report = (index = 0) => `${base(index)}/reports/expenses?${period}`;
  const dashboard = (index = 0) => `${base(index)}/dashboard?year=2026&month=10`;
  const exports = (format = 'csv', index = 0) => `${base(index)}/exports/transactions?format=${format}&${period}`;
  const date = (offset: number) => {
    const result = new Date();
    result.setUTCDate(result.getUTCDate() + offset);
    return result.toISOString().slice(0, 10);
  };
  const goalPayload = () => ({ nome: 'Viagem', valorAlvo: '100.00', dataLimite: date(13), frequenciaSugestao: 'DIARIA' });
  const readDashboard = async () => (await app.inject({ method: 'GET', url: dashboard(), headers: headers() })).json();
  const readGoal = async (id = goalId) => (await app.inject({ method: 'GET', url: detail(id), headers: headers() })).json();
  const contribute = (value: string) => app.inject({ method: 'POST', url: `${detail()}/contributions`, headers: headers(),
    payload: { valor: value, dataHora: new Date().toISOString() } });
  const createTransaction = async (payload: Record<string, unknown>, index = 0) => {
    const response = await app.inject({ method: 'POST', url: `${base(index)}/transactions`, headers: headers(index),
      payload: { tipo: 'DESPESA', categoriaId: category.id, valor: '30.00', dataHora: '2026-10-01T00:00:00Z',
        descricao: 'Movimentação', status: 'EFETIVADA', ...payload } });
    expect(response.statusCode).toBe(201);
    return response.json().id as string;
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useLogger(false);
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
    category = await prisma.categoria.findFirstOrThrow({ where: { ativa: true }, orderBy: { id: 'asc' }, select: { id: true, nome: true } });
    for (const email of emails) {
      const registered = await app.inject({ method: 'POST', url: '/auth/register', payload: { nome: 'Teste de leitura', email, senha: 'senha de teste' } });
      expect(registered.statusCode).toBe(201);
      profiles.push(registered.json().profile.id);
      const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha: 'senha de teste' } });
      expect(login.statusCode).toBe(201);
      tokens.push(login.json().accessToken);
    }
    expect((await readDashboard()).saldoAtual).toBe('0.00');
    expect((await readDashboard()).comparacaoComMesAnterior.percentualVariacao).toBeNull();
    transactions.push(await createTransaction({ tipo: 'RECEITA', valor: '1000.00', dataHora: '2026-10-15T12:00:00Z' }));
    expect((await readDashboard()).saldoAtual).toBe('1000.00');
    const subcategory = await app.inject({ method: 'POST', url: `${base()}/subcategories`, headers: headers(),
      payload: { categoriaId: category.id, nome: 'Subcategoria exportável' } });
    expect(subcategory.statusCode).toBe(201);
    transactions.push(await createTransaction({ descricao: 'Café, "ação"\nsegunda linha', anotacao: '=1+1', subcategoriaId: subcategory.json().id }));
    expect((await readDashboard()).saldoAtual).toBe('970.00');
    transactions.push(await createTransaction({ valor: '20.00', categoriaId: null, ehGastoLivre: true, dataHora: '2026-10-31T23:59:59.999Z' }));
    transactions.push(await createTransaction({ valor: '40.00', dataHora: '2026-09-30T23:59:59.999Z' }));
    transactions.push(await createTransaction({ valor: '60.00', dataHora: '2026-11-01T00:00:00Z' }));
    transactions.push(await createTransaction({ valor: '700.00', status: 'PREVISTA' }));
    expect((await readDashboard()).saldoAtual).toBe('850.00');
    await createTransaction({ valor: '999.00' }, 1);
    const tag = await app.inject({ method: 'POST', url: `${base()}/tags`, headers: headers(), payload: { nome: '#ação' } });
    expect(tag.statusCode).toBe(201);
    expect((await app.inject({ method: 'PUT', url: `${base()}/transactions/${transactions[1]}/tags`, headers: headers(),
      payload: { tagIds: [tag.json().id] } })).statusCode).toBe(200);
  }, 90000);

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
      const ids = users.map((user) => user.id);
      const owned = await prisma.perfilFinanceiro.findMany({ where: { usuarioId: { in: ids } }, select: { id: true } });
      const perfilId = { in: owned.map((profile) => profile.id) };
      await prisma.aporteMeta.deleteMany({ where: { meta: { perfilId } } });
      await prisma.meta.deleteMany({ where: { perfilId } });
      await prisma.transacao.deleteMany({ where: { perfilId } });
      await prisma.auditoriaTransacao.deleteMany({ where: { perfilId } });
      await prisma.tag.deleteMany({ where: { perfilId } });
      await prisma.subcategoria.deleteMany({ where: { perfilId } });
      await prisma.perfilFinanceiro.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });

  it('cria/lista/detalha/edita meta, recalcula prazo e aporte aumenta só o progresso', async () => {
    const created = await app.inject({ method: 'POST', url: goals(), headers: headers(), payload: goalPayload() });
    expect(created.statusCode).toBe(201);
    goalId = created.json().id;
    expect(created.json()).toMatchObject({ nome: 'Viagem', valorAlvo: '100.00', valorAcumulado: '0.00',
      valorRestante: '100.00', percentualProgresso: '0.00', sugestaoAtual: '7.14', atingida: false });
    expect((await app.inject({ method: 'GET', url: goals(), headers: headers() })).json().map((row: { id: string }) => row.id)).toEqual([goalId]);
    expect((await readGoal()).id).toBe(goalId);
    const updated = await app.inject({ method: 'PATCH', url: detail(), headers: headers(), payload: { nome: 'Viagem atualizada', frequenciaSugestao: 'SEMANAL' } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ nome: 'Viagem atualizada', periodosRestantes: 2, sugestaoAtual: '50.00' });
    const count = await prisma.transacao.count({ where: { perfilId: profiles[0] } });
    const before = await readDashboard();
    const expenseReport = (await app.inject({ method: 'GET', url: report(), headers: headers() })).json();
    expect((await contribute('20.00')).statusCode).toBe(201);
    expect(await readGoal()).toMatchObject({ valorAcumulado: '20.00', valorRestante: '80.00', percentualProgresso: '20.00', sugestaoAtual: '40.00' });
    expect(await prisma.transacao.count({ where: { perfilId: profiles[0] } })).toBe(count);
    const after = await readDashboard();
    expect(after.saldoAtual).toBe(before.saldoAtual);
    expect(after.gastosDoMes).toBe(before.gastosDoMes);
    expect(after.progressoDasMetas[0]).toMatchObject({ id: goalId, valorAcumulado: '20.00' });
    expect((await app.inject({ method: 'GET', url: report(), headers: headers() })).json()).toEqual(expenseReport);
    const changed = await app.inject({ method: 'PATCH', url: detail(), headers: headers(), payload: { dataLimite: date(20) } });
    expect(changed.json()).toMatchObject({ periodosRestantes: 3, sugestaoAtual: '26.67' });
    expect((await contribute('80.00')).statusCode).toBe(201);
    expect(await readGoal()).toMatchObject({ atingida: true, valorAcumulado: '100.00', valorRestante: '0.00', sugestaoAtual: '0.00' });
    expect((await readDashboard()).saldoAtual).toBe('850.00');
  });

  it('valida nomes, valores, datas, frequência e aportes sem gravar entrada inválida', async () => {
    for (const change of [{ nome: '' }, { nome: ' \t\n ' }, { valorAlvo: '0' }, { valorAlvo: '-1' }, { valorAlvo: '1.001' },
      { valorAlvo: null }, { dataLimite: '2026-02-30' }, { dataLimite: '0000-01-01' }, { frequenciaSugestao: 'MENSAL' }]) {
      expect((await app.inject({ method: 'POST', url: goals(), headers: headers(), payload: { ...goalPayload(), ...change } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'PATCH', url: detail(), headers: headers(), payload: change })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'PATCH', url: detail(), headers: headers(), payload: {} })).statusCode).toBe(400);
    for (const value of ['0', '-1', '1.001']) expect((await contribute(value)).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `${detail()}/contributions`, headers: headers(),
      payload: { valor: '10', dataHora: '2026-10-01T12:00:00' } })).statusCode).toBe(400);
    expect(await prisma.meta.count({ where: { perfilId: profiles[0] } })).toBe(1);
    expect(await prisma.aporteMeta.count({ where: { metaId: goalId } })).toBe(2);
    expect((await app.inject({ method: 'GET', url: detail(randomUUID()), headers: headers() })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `${detail(randomUUID())}/contributions`, headers: headers(),
      payload: { valor: '10', dataHora: new Date().toISOString() } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PATCH', url: detail(randomUUID()), headers: headers(), payload: { nome: 'Ausente' } })).statusCode).toBe(404);
  });

  it('meta vencida informa falta e prorrogação recalcula sugestão', async () => {
    const response = await app.inject({ method: 'POST', url: goals(), headers: headers(), payload: { ...goalPayload(), nome: 'Vencida', dataLimite: date(-1) } });
    expect(response.statusCode).toBe(201);
    const id = response.json().id;
    expect(response.json()).toMatchObject({ atingida: false, vencida: true, valorRestante: '100.00', sugestaoAtual: null });
    const updated = await app.inject({ method: 'PATCH', url: detail(id), headers: headers(), payload: { dataLimite: date(9) } });
    expect(updated.json()).toMatchObject({ vencida: false, sugestaoAtual: '10.00', periodosRestantes: 10 });
  });

  it('relatório distribui apenas despesas efetivadas, incluindo sem categoria, com limites inclusivos', async () => {
    const response = await app.inject({ method: 'GET', url: report(), headers: headers() });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ totalGasto: '50.00', periodo: { startDate: '2026-10-01', endDate: '2026-10-31', fimExclusivo: '2026-11-01T00:00:00.000Z' } });
    expect(response.json().categorias).toEqual([
      { categoriaId: null, nome: 'Sem categoria', valor: '20.00', percentualDoTotal: '40.00' },
      { categoriaId: category.id, nome: category.nome, valor: '30.00', percentualDoTotal: '60.00' },
    ]);
    expect(await prisma.categoria.count()).toBe(7);
    const empty = await app.inject({ method: 'GET', url: `${base()}/reports/expenses?startDate=2020-01-01&endDate=2020-01-01`, headers: headers() });
    expect(empty.json()).toMatchObject({ totalGasto: '0.00', categorias: [] });
    for (const query of ['startDate=2026-10-02&endDate=2026-10-01', 'startDate=2026-02-30&endDate=2026-03-01', 'startDate=2026-10-01']) {
      expect((await app.inject({ method: 'GET', url: `${base()}/reports/expenses?${query}`, headers: headers() })).statusCode).toBe(400);
    }
  });

  it('dashboard resume saldo geral, mês atual/anterior, metas e somente cinco transações recentes', async () => {
    const response = await app.inject({ method: 'GET', url: dashboard(), headers: headers() });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ saldoAtual: '850.00', gastosDoMes: '50.00',
      comparacaoComMesAnterior: { gastosMesAtual: '50.00', gastosMesAnterior: '40.00', diferenca: '10.00', percentualVariacao: '25.00' } });
    expect(response.json().progressoDasMetas.find((goal: { id: string }) => goal.id === goalId)).toMatchObject({ valorAcumulado: '100.00', atingida: true });
    expect(response.json().transacoesRecentes).toHaveLength(5);
    expect(response.json().transacoesRecentes[0].id).toBe(transactions[4]);
    const january = await app.inject({ method: 'GET', url: `${base()}/dashboard?year=2027&month=1`, headers: headers() });
    expect(january.json().comparacaoComMesAnterior.percentualVariacao).toBeNull();
    for (const query of ['year=2026&month=13', 'year=0&month=10', 'year=2026', 'year=2026.1&month=10']) {
      expect((await app.inject({ method: 'GET', url: `${base()}/dashboard?${query}`, headers: headers() })).statusCode).toBe(400);
    }
  });

  it('exporta CSV com UTF-8, escaping, headers, tags, filtros e todas as transações do período', async () => {
    const response = await app.inject({ method: 'GET', url: exports(), headers: headers() });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toContain(`transacoes-${profiles[0]}.csv`);
    expect(response.body).toContain('"Descrição"');
    expect(response.body).toContain('"Café, ""ação""\nsegunda linha"');
    expect(response.body).toContain('"\'=1+1"');
    expect(response.body).toContain('"#ação"');
    expect(response.body).toContain('"Subcategoria exportável"');
    const uppercaseProfile = await app.inject({ method: 'GET', url: exports().replace(profiles[0], profiles[0].toUpperCase()), headers: headers() });
    expect(uppercaseProfile.statusCode).toBe(200);
    expect(uppercaseProfile.body).toBe(response.body);
    expect(response.body).toContain('"1000.00"');
    expect(response.body).toContain('"PREVISTA"');
    expect(response.body).not.toContain('"999.00"');
    expect(response.body).not.toContain('"40.00"');
    expect(response.body).not.toContain('"60.00"');
    expect(response.body).not.toMatch(/senhaHash|JWT|estadoAnterior|estadoNovo/);
    const all = await app.inject({ method: 'GET', url: `${base()}/exports/transactions?format=csv`, headers: headers() });
    expect(all.body).toContain('"40.00"');
    for (const query of ['format=pdf', 'format=csv&startDate=2026-10-01', 'format=xlsx&startDate=2026-10-02&endDate=2026-10-01']) {
      expect((await app.inject({ method: 'GET', url: `${base()}/exports/transactions?${query}`, headers: headers() })).statusCode).toBe(400);
    }
  });

  it('exporta XLSX real e ambos formatos vazios válidos, sem transformar texto em fórmula', async () => {
    const response = await app.inject({ method: 'GET', url: exports('xlsx'), headers: headers() });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(response.headers['content-disposition']).toContain('.xlsx');
    const zip = unzipSync(response.rawPayload);
    expect(zip['xl/workbook.xml']).toBeDefined();
    const xml = Object.entries(zip).filter(([name]) => name.endsWith('.xml')).map(([, content]) => strFromU8(content)).join('\n');
    expect(xml).toContain('Café,');
    expect(xml).toContain('=1+1');
    expect(xml).toContain('1000.00');
    expect(xml).not.toContain('<f>');
    for (const format of ['csv', 'xlsx']) {
      const empty = await app.inject({ method: 'GET', url: `${base()}/exports/transactions?format=${format}&startDate=2020-01-01&endDate=2020-01-01`, headers: headers() });
      expect(empty.statusCode).toBe(200);
      if (format === 'csv') expect(empty.body.trim().split('\r\n')).toHaveLength(1);
      else expect(strFromU8(unzipSync(empty.rawPayload)['xl/worksheets/sheet1.xml'])).not.toContain('<row r="2"');
    }
  });

  it('exige JWT e impede acessar/aportar/editar metas e ler/exportar outro perfil', async () => {
    const response = await app.inject({ method: 'POST', url: goals(1), headers: headers(1), payload: goalPayload() });
    expect(response.statusCode).toBe(201);
    otherGoal = response.json().id;
    const cases = [
      { method: 'GET' as const, url: goals(1) }, { method: 'POST' as const, url: goals(1), payload: goalPayload() },
      { method: 'GET' as const, url: `${goals(1)}/${otherGoal}` },
      { method: 'GET' as const, url: `${goals(1)}/${otherGoal}/contributions` },
      { method: 'PATCH' as const, url: `${goals(1)}/${otherGoal}`, payload: { nome: 'Invasão' } },
      { method: 'POST' as const, url: `${goals(1)}/${otherGoal}/contributions`, payload: { valor: '10.00', dataHora: new Date().toISOString() } },
      { method: 'GET' as const, url: report(1) }, { method: 'GET' as const, url: dashboard(1) },
      { method: 'GET' as const, url: exports('csv', 1) }, { method: 'GET' as const, url: exports('xlsx', 1) },
    ];
    for (const request of cases) {
      expect((await app.inject({ ...request, headers: headers() })).statusCode).toBe(403);
      expect((await app.inject(request)).statusCode).toBe(401);
    }
    for (const request of [
      { method: 'GET' as const, url: detail(otherGoal) }, { method: 'PATCH' as const, url: detail(otherGoal), payload: { nome: 'Invasão' } },
      { method: 'GET' as const, url: `${detail(otherGoal)}/contributions` },
      { method: 'POST' as const, url: `${detail(otherGoal)}/contributions`, payload: { valor: '10.00', dataHora: new Date().toISOString() } },
    ]) expect((await app.inject({ ...request, headers: headers() })).statusCode).toBe(404);
    expect(await prisma.aporteMeta.count({ where: { metaId: otherGoal } })).toBe(0);
  });

  it('edição/reversão refletem relatórios, dashboard e exportação, preservando aportes', async () => {
    expect((await app.inject({ method: 'PATCH', url: `${base()}/transactions/${transactions[1]}`, headers: headers(), payload: { valor: '35.00' } })).statusCode).toBe(200);
    expect((await readDashboard()).gastosDoMes).toBe('55.00');
    expect((await app.inject({ method: 'GET', url: report(), headers: headers() })).json().totalGasto).toBe('55.00');
    expect((await app.inject({ method: 'DELETE', url: `${base()}/transactions/${transactions[1]}`, headers: headers() })).statusCode).toBe(204);
    expect(await readDashboard()).toMatchObject({ saldoAtual: '880.00', gastosDoMes: '20.00',
      comparacaoComMesAnterior: { diferenca: '-20.00', percentualVariacao: '-50.00' } });
    expect((await app.inject({ method: 'GET', url: report(), headers: headers() })).json()).toMatchObject({ totalGasto: '20.00',
      categorias: [{ categoriaId: null, valor: '20.00', percentualDoTotal: '100.00' }] });
    expect((await app.inject({ method: 'GET', url: exports(), headers: headers() })).body).not.toContain('Café');
    expect(await readGoal()).toMatchObject({ valorAcumulado: '100.00', atingida: true });
    expect((await app.inject({ method: 'DELETE', url: `${base()}/transactions/${transactions[0]}`, headers: headers() })).statusCode).toBe(204);
    expect((await readDashboard()).saldoAtual).toBe('-120.00');
    expect((await readGoal()).valorAcumulado).toBe('100.00');
  });

  it('histórico vazio, um/vários aportes, ordem decrescente e leitura imediata sem gerar transação', async () => {
    const created = await app.inject({ method: 'POST', url: goals(), headers: headers(), payload: goalPayload() });
    expect(created.statusCode).toBe(201);
    const url = `${detail(created.json().id)}/contributions`;
    const read = async () => {
      const response = await app.inject({ method: 'GET', url, headers: headers() });
      expect(response.statusCode).toBe(200); return response.json();
    };
    expect(await read()).toEqual([]);
    const before = await prisma.transacao.count({ where: { perfilId: profiles[0] } });
    const ids: string[] = [];
    for (const [valor, dataHora] of [['10.50', '2026-10-03T12:00:00.123Z'], ['20.00', '2026-09-01T13:00:00Z'], ['30.00', '2026-10-04T09:00:00Z']]) {
      const response = await app.inject({ method: 'POST', url, headers: headers(), payload: { valor, dataHora } });
      expect(response.statusCode).toBe(201); ids.push(response.json().id);
      expect((await read()).map((item: { id: string }) => item.id)).toContain(response.json().id);
      if (ids.length === 1) expect(await read()).toEqual([response.json()]);
    }
    expect((await read()).map((item: { id: string }) => item.id)).toEqual([ids[2], ids[0], ids[1]]);
    expect((await readGoal(created.json().id)).valorAcumulado).toBe('60.50');
    expect(await prisma.transacao.count({ where: { perfilId: profiles[0] } })).toBe(before);
    expect((await app.inject({ method: 'GET', url: `${detail(randomUUID())}/contributions`, headers: headers() })).statusCode).toBe(404);
    const second = await app.inject({ method: 'POST', url: '/profiles', headers: headers(), payload: { nome: 'Outro perfil' } });
    expect(second.statusCode).toBe(201);
    expect((await app.inject({ method: 'GET', url: `/profiles/${second.json().id}/goals/${created.json().id}/contributions`, headers: headers() })).statusCode).toBe(404);
  });
});
