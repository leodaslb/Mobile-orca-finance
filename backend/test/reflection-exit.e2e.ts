import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { Clock } from '../src/common/clock';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import { ReflectionRepository } from '../src/modules/reflection/reflection.repository';
import { TransactionsRepository } from '../src/modules/transactions/transactions.repository';

describe('US12 saída: HTTP → Neon, atomicidade e projeções', () => {
  let app: NestFastifyApplication; let prisma: PrismaService; let category: string;
  let now = new Date('2026-10-01T12:00:00Z');
  const emails = [`exit-a-${randomUUID()}@example.test`, `exit-b-${randomUUID()}@example.test`];
  const profiles: string[] = []; const tokens: string[] = [];
  let sameUserProfile: string;
  const headers = (i = 0) => ({ authorization: `Bearer ${tokens[i]}` });
  const base = (i = 0) => `/profiles/${profiles[i]}`;
  const payload = () => ({ tipo: 'DESPESA', status: 'EFETIVADA', valor: '25.50', descricao: 'Compra preenchida novamente',
    dataHora: '2026-10-03T12:00:00Z', categoriaId: category, essencialidade: 'NAO_ESSENCIAL' });
  const item = async (i = 0) => {
    const response = await app.inject({ method: 'POST', url: `${base(i)}/reflection-items`, headers: headers(i), payload: { descricao: 'Descrição original' } });
    expect(response.statusCode).toBe(201); return response.json().id as string;
  };
  const complete = (id: string, change = {}) => app.inject({ method: 'POST', url: `${base()}/reflection-items/${id}/transactions`, headers: headers(), payload: { ...payload(), ...change } });
  const discard = (id: string) => app.inject({ method: 'DELETE', url: `${base()}/reflection-items/${id}`, headers: headers() });
  const counts = async () => ({ transactions: await prisma.transacao.count({ where: { perfilId: profiles[0] } }),
    audit: await prisma.auditoriaTransacao.count({ where: { perfilId: profiles[0] } }) });
  const read = async (path: string) => {
    const response = await app.inject({ method: 'GET', url: `${base()}${path}`, headers: headers() });
    expect(response.statusCode).toBe(200); return response.json();
  };
  const projections = async () => ({ dashboard: await read('/dashboard?year=2026&month=10'),
    budget: await read('/budgets/monthly/2026/10'), report: await read('/reports/expenses?startDate=2026-10-01&endDate=2026-10-31') });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue({ now: () => new Date(now) }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter()); app.useLogger(false); configureApp(app);
    await app.init(); await app.getHttpAdapter().getInstance().ready(); prisma = app.get(PrismaService);
    category = (await prisma.categoria.findFirstOrThrow({ where: { ativa: true }, select: { id: true } })).id;
    for (const email of emails) {
      const registered = await app.inject({ method: 'POST', url: '/auth/register', payload: { nome: 'Teste saída reflexão', email, senha: 'senha de teste' } });
      expect(registered.statusCode).toBe(201); profiles.push(registered.json().profile.id);
      const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha: 'senha de teste' } });
      expect(login.statusCode).toBe(201); tokens.push(login.json().accessToken);
    }
    const extra = await app.inject({ method: 'POST', url: '/profiles', headers: headers(), payload: { nome: 'Outro perfil teste saída' } });
    expect(extra.statusCode).toBe(201); sameUserProfile = extra.json().id;
    expect((await app.inject({ method: 'PUT', url: `${base()}/budgets/monthly/2026/10`, headers: headers(),
      payload: { categorias: [{ categoriaId: category, valorPlanejado: '500.00' }] } })).statusCode).toBe(200);
  }, 90000);
  beforeEach(() => { now = new Date('2026-10-01T12:00:00Z'); });
  afterAll(async () => {
    jest.restoreAllMocks();
    try { if (prisma) {
      const users = await prisma.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
      const ids = users.map(user => user.id);
      const owned = await prisma.perfilFinanceiro.findMany({ where: { usuarioId: { in: ids } }, select: { id: true } });
      const perfilId = { in: owned.map(profile => profile.id) };
      await prisma.transacao.deleteMany({ where: { perfilId } });
      await prisma.auditoriaTransacao.deleteMany({ where: { perfilId } });
      await prisma.itemReflexao.deleteMany({ where: { perfilId } });
      await prisma.orcamentoCategoria.deleteMany({ where: { orcamento: { perfilId } } });
      await prisma.orcamento.deleteMany({ where: { perfilId } });
      await prisma.perfilFinanceiro.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
      expect(await prisma.usuario.count({ where: { email: { in: emails } } })).toBe(0);
      expect(await prisma.itemReflexao.count({ where: { perfilId } })).toBe(0);
    } } finally { await app?.close(); }
  });
  it('aguardar, expirar e consultar/abrir formulário não criam compra nem alteram projeções', async () => {
    const before = await counts(); const financial = await projections(); const id = await item();
    now = new Date('2026-10-03T11:59:59.999Z');
    expect((await complete(id)).statusCode).toBe(409); expect((await discard(id)).statusCode).toBe(409);
    now = new Date('2026-10-03T12:00:00Z');
    expect(await read(`/reflection-items/${id}`)).toMatchObject({ descricao: 'Descrição original', liberado: true });
    expect((await read('/reflection-items')).some((row: { id: string }) => row.id === id)).toBe(true);
    expect(await counts()).toEqual(before); expect(await projections()).toEqual(financial);
  });
  it('novo envio cria EFETIVADA com os novos dados/auditoria e remove o item atomicamente', async () => {
    const id = await item(); const before = await counts(); const financial = await projections();
    now = new Date('2026-10-03T12:00:00Z');
    const response = await complete(id); expect(response.statusCode).toBe(201);
    const saved = response.json(); expect(saved).toMatchObject({ ...payload(), dataHora: new Date(payload().dataHora).toISOString() });
    expect(await prisma.itemReflexao.findUnique({ where: { id } })).toBeNull();
    expect(await counts()).toEqual({ transactions: before.transactions + 1, audit: before.audit + 1 });
    const audit = await prisma.auditoriaTransacao.findFirstOrThrow({ where: { transacaoId: saved.id } });
    expect(audit.estadoNovo).toMatchObject({ status: 'EFETIVADA', descricao: payload().descricao });
    for (const field of ['tags', 'recibos', 'itemReflexaoId', 'reflectionItemId']) expect(audit.estadoNovo).not.toHaveProperty(field);
    const after = await projections(); expect(after.dashboard).not.toEqual(financial.dashboard);
    expect(after.budget.totais.valorRealizado).toBe('25.50'); expect(after.report).not.toEqual(financial.report);
    expect((await complete(id)).statusCode).toBe(404); expect(await counts()).toEqual({ transactions: before.transactions + 1, audit: before.audit + 1 });
  });
  it('desistir remove somente o item e preserva transações, auditoria e cálculos', async () => {
    const id = await item(); const before = await counts(); const financial = await projections(); now = new Date('2026-10-03T12:00:00Z');
    const response = await discard(id); expect(response.statusCode).toBe(204); expect(response.body).toBe('');
    expect(await prisma.itemReflexao.findUnique({ where: { id } })).toBeNull();
    expect(await counts()).toEqual(before); expect(await projections()).toEqual(financial);
  });
  it('erros de DTO/negócio conservam o item; receita/PREVISTA são rejeitadas', async () => {
    const id = await item(); const before = await counts(); now = new Date('2026-10-03T12:00:00Z');
    for (const change of [{ valor: '0' }, { descricao: ' ' }, { categoriaId: null }, { tipo: 'RECEITA' }, { status: 'PREVISTA' }, { formulario: {} }]) {
      expect((await complete(id, change)).statusCode).toBe(400);
    }
    expect(await prisma.itemReflexao.findUnique({ where: { id } })).not.toBeNull(); expect(await counts()).toEqual(before);
  });
  it('JWT e ownership protegem conclusão/desistência, inclusive outro perfil do mesmo usuário', async () => {
    const id = await item(1); now = new Date('2026-10-03T12:00:00Z');
    for (const action of ['complete', 'discard']) {
      const method = action === 'complete' ? 'POST' : 'DELETE'; const suffix = action === 'complete' ? '/transactions' : '';
      const request = { method: method as 'POST' | 'DELETE', url: `${base(1)}/reflection-items/${id}${suffix}`, ...(method === 'POST' ? { payload: payload() } : {}) };
      expect((await app.inject(request)).statusCode).toBe(401);
      expect((await app.inject({ ...request, headers: headers() })).statusCode).toBe(403);
      expect((await app.inject({ ...request, url: `${base()}/reflection-items/${id}${suffix}`, headers: headers() })).statusCode).toBe(404);
      expect((await app.inject({ ...request, url: `/profiles/${sameUserProfile}/reflection-items/${id}${suffix}`, headers: headers() })).statusCode).toBe(404);
    }
    expect(await prisma.itemReflexao.findUnique({ where: { id } })).not.toBeNull();
  });
  it('falha real de FK na auditoria faz rollback da compra e conserva item', async () => {
    const id = await item(); const before = await counts(); now = new Date('2026-10-03T12:00:00Z');
    const repo = app.get(TransactionsRepository); const original = repo.createAudit.bind(repo);
    const spy = jest.spyOn(repo, 'createAudit').mockImplementationOnce((data, tx) => original({ ...data, transacaoId: randomUUID() }, tx));
    try { expect((await complete(id)).statusCode).toBe(500); } finally { spy.mockRestore(); }
    expect(await counts()).toEqual(before); expect(await prisma.itemReflexao.findUnique({ where: { id } })).not.toBeNull();
  });
  it('falha após remoção desfaz item, transação e auditoria juntos', async () => {
    const id = await item(); const before = await counts(); now = new Date('2026-10-03T12:00:00Z');
    const repo = app.get(ReflectionRepository); const original = repo.remove.bind(repo);
    const spy = jest.spyOn(repo, 'remove').mockImplementationOnce(async (profile, itemId, tx) => { await original(profile, itemId, tx); throw new Error('falha simulada após remoção'); });
    try { expect((await complete(id)).statusCode).toBe(500); } finally { spy.mockRestore(); }
    expect(await counts()).toEqual(before); expect(await prisma.itemReflexao.findUnique({ where: { id } })).not.toBeNull();
  });
  it('envios concorrentes criam somente uma compra e um snapshot', async () => {
    const id = await item(); const before = await counts(); now = new Date('2026-10-03T12:00:00Z');
    const responses = await Promise.all([complete(id), complete(id)]);
    expect(responses.map(response => response.statusCode).sort()).toEqual([201, 404]);
    expect(await counts()).toEqual({ transactions: before.transactions + 1, audit: before.audit + 1 });
  });
  it('conclusão concorrente com desistência consome uma vez, sem estado parcial', async () => {
    const id = await item(); const before = await counts(); now = new Date('2026-10-03T12:00:00Z');
    const [purchase, cancellation] = await Promise.all([complete(id), discard(id)]);
    expect([[201, 404], [404, 204]]).toContainEqual([purchase.statusCode, cancellation.statusCode]);
    const delta = purchase.statusCode === 201 ? 1 : 0;
    expect(await counts()).toEqual({ transactions: before.transactions + delta, audit: before.audit + delta });
    expect(await prisma.itemReflexao.findUnique({ where: { id } })).toBeNull();
  });
});
