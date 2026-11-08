import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { Clock } from '../src/common/clock';
import { PrismaService } from '../src/database/prisma.service';
import { TransactionsRepository } from '../src/modules/transactions/transactions.repository';
import { PushProvider } from '../src/modules/notifications/push.provider';
import { NotificationService } from '../src/modules/notifications/notification.service';
import { WeeklySummaryJob } from '../src/modules/notifications/weekly-summary.job';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
describe('Sprint 2 Parte 3: importação, push e dois dispositivos HTTP → PostgreSQL', () => {
  let app: NestFastifyApplication; let db: PrismaService; let category: string; let categoryName: string;
  const emails = [0, 1].map(() => `s2p3-${randomUUID()}@example.test`); const profiles: string[] = []; const tokens: string[] = [];
  const push = { send: jest.fn().mockResolvedValue('ACCEPTED') }; const token = `ExpoPushToken[${randomUUID()}]`;
  const now = new Date('2026-10-12T12:00:00Z');
  const auth = (client = 0) => ({ authorization: `Bearer ${tokens[client]}` });
  const request = (method: Method, url: string, payload?: Record<string, unknown>, client = 0) => app.inject({ method, url, headers: auth(client), ...(payload && { payload }) });
  const base = (profile = profiles[0]) => `/profiles/${profile}`;
  const imported = { tipo: 'DESPESA', valor: '35.90', dataHora: '2026-10-10T12:30:00Z', descricao: 'Almoço importado', categoriaId: null };
  const confirm = (rows: Record<string, unknown>[], confirmPossibleDuplicates = false, client = 0) => request('POST', `${base()}/imports/transactions/confirm`, { rows, confirmPossibleDuplicates }, client);
  const upload = (csv: Buffer, profile = profiles[0], client = 0, field = 'file') => {
    const boundary = `csv-${randomUUID()}`;
    return app.inject({ method: 'POST', url: `${base(profile)}/imports/transactions/preview`,
      headers: { ...auth(client), 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="import.csv"\r\nContent-Type: text/csv\r\n\r\n`), csv, Buffer.from(`\r\n--${boundary}--\r\n`)]) });
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue({ now: () => new Date(now) })
      .overrideProvider(PushProvider).useValue(push).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter()); app.useLogger(false); configureApp(app);
    await app.init(); await app.getHttpAdapter().getInstance().ready(); db = app.get(PrismaService);
    const cat = await db.categoria.findFirstOrThrow({ where: { ativa: true }, orderBy: { id: 'asc' } }); category = cat.id; categoryName = cat.nome;
    for (const email of emails) {
      const r = await app.inject({ method: 'POST', url: '/auth/register', payload: { nome: 'Parte 3', email, senha: 'senha de teste' } });
      expect(r.statusCode).toBe(201); profiles.push(r.json().profile.id);
    }
    // Dois logins independentes da mesma conta, terceiro cliente em outra conta.
    for (const email of [emails[0], emails[0], emails[1]]) {
      const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha: 'senha de teste' } }); expect(r.statusCode).toBe(201); tokens.push(r.json().accessToken);
    }
  }, 90000);
  afterAll(async () => {
    try {
      if (db) {
        const users = await db.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } }); const ids = users.map(r => r.id);
        const own = await db.perfilFinanceiro.findMany({ where: { usuarioId: { in: ids } }, select: { id: true } }); const perfilId = { in: own.map(r => r.id) };
        await db.transacao.deleteMany({ where: { perfilId } }); await db.auditoriaTransacao.deleteMany({ where: { perfilId } });
        await db.orcamentoCategoria.deleteMany({ where: { orcamento: { perfilId } } }); await db.orcamento.deleteMany({ where: { perfilId } });
        await db.cotaGastoLivre.deleteMany({ where: { perfilId } }); await db.aporteMeta.deleteMany({ where: { meta: { perfilId } } }); await db.meta.deleteMany({ where: { perfilId } });
        await db.itemReflexao.deleteMany({ where: { perfilId } }); await db.lembreteVencimento.deleteMany({ where: { perfilId } }); await db.recorrencia.deleteMany({ where: { perfilId } });
        await db.dispositivoPush.deleteMany({ where: { usuarioId: { in: ids } } });
        await db.perfilFinanceiro.deleteMany({ where: { usuarioId: { in: ids } } }); await db.usuario.deleteMany({ where: { id: { in: ids } } });
      }
    } finally { await app?.close(); }
  }, 90000);

  it('US42 preview: UTF-8, categorias, rejeições, duplicata interna e nenhuma gravação', async () => {
    const count = await db.transacao.count({ where: { perfilId: profiles[0] } });
    const csv = Buffer.from('tipo;valor;data_hora;descricao;categoria\n' +
      `DESPESA;35.90;2026-10-10T12:30:00;Almoço importado;${categoryName}\n` +
      'DESPESA;35.9;2026-10-10T12:30:00;Almoço importado;Desconhecida\n' +
      'RECEITA;10;2026-10-01T00:00:00;Receita;\n' +
      'OUTRO;1;2026-10-01T00:00:00;Tipo inválido;\n' +
      'DESPESA;1,00;2026-10-01T00:00:00;Valor inválido;\n' +
      'DESPESA;1;2026-02-30T00:00:00;Data inválida;\n' +
      'DESPESA;1;2026-10-01T00:00:00;;\n');
    const r = await upload(csv); expect(r.statusCode).toBe(200);
    expect(r.json().summary).toEqual({ totalRows: 7, validRows: 3, rejectedRows: 4, withoutCategory: 2, possibleDuplicates: 1 });
    expect(r.json().rows[0].categoria).toMatchObject({ categoriaId: category, resolved: true });
    expect(await db.transacao.count({ where: { perfilId: profiles[0] } })).toBe(count);
    expect((await upload(csv, profiles[0], 2)).statusCode).toBe(403);
    expect((await upload(Buffer.from([255]))).statusCode).toBe(400);
    expect((await upload(csv, profiles[0], 0, 'wrong')).statusCode).toBe(400);
  });
  it('US42 confirm: defaults, categoria nullable, CRIACAO e classificação posterior', async () => {
    const r = await confirm([imported, { ...imported, descricao: 'Categoria importada', categoriaId: category }]); expect(r.statusCode).toBe(201);
    expect(r.json().created).toBe(2);
    const item = await db.transacao.findUniqueOrThrow({ where: { id: r.json().transactionIds[0] } });
    expect(item).toMatchObject({ perfilId: profiles[0], categoriaId: null, essencialidade: 'NAO_CLASSIFICADA', ehGastoLivre: false, status: 'EFETIVADA' });
    const audit = await db.auditoriaTransacao.findFirstOrThrow({ where: { transacaoId: item.id } });
    expect(audit).toMatchObject({ operacao: 'CRIACAO', estadoAnterior: null, estadoNovo: { id: item.id, categoriaId: null, valor: '35.9' } });
    expect((await request('PATCH', `${base()}/transactions/${item.id}`, { anotacao: 'Classificar depois' })).statusCode).toBe(200);
    expect((await request('PATCH', `${base()}/transactions/${item.id}`, { categoriaId: category })).statusCode).toBe(200);
    const manual = await request('POST', `${base()}/transactions`, { ...imported, status: 'EFETIVADA' }); expect(manual.statusCode).toBe(400);
  });
  it('US42: duplicatas exigem confirmação, inclusive dentro do lote, e revalidação é independente do preview', async () => {
    const rejected = await confirm([imported]); expect(rejected.statusCode).toBe(409); expect(rejected.json().code).toBe('POSSIBLE_DUPLICATE_CONFIRMATION_REQUIRED');
    expect((await confirm([imported], true)).statusCode).toBe(201);
    expect((await confirm([{ ...imported, descricao: 'Nova' }, { ...imported, descricao: 'Nova' }])).statusCode).toBe(409);
    for (const change of [{ valor: '0' }, { valor: '-1' }, { status: 'PREVISTA' }, { dataHora: '2026-10-10T12:30:00' }]) {
      expect((await confirm([{ ...imported, ...change }], true)).statusCode).toBe(400);
    }
    expect((await confirm([imported], true, 2)).statusCode).toBe(403);
  });
  it('US42: falha na segunda auditoria reverte transações e auditorias de todo o lote', async () => {
    const before = [await db.transacao.count({ where: { perfilId: profiles[0] } }), await db.auditoriaTransacao.count({ where: { perfilId: profiles[0] } })];
    const repository = app.get(TransactionsRepository); const original = repository.createAudit.bind(repository);
    const spy = jest.spyOn(repository, 'createAudit').mockImplementationOnce(original).mockImplementationOnce(() => { throw new Error('private-db-failure'); });
    try {
      const r = await confirm([{ ...imported, descricao: 'Rollback 1' }, { ...imported, descricao: 'Rollback 2' }], true);
      expect(r.statusCode).toBe(500); expect(r.body).not.toContain('private-db-failure');
    } finally { spy.mockRestore(); }
    expect([await db.transacao.count({ where: { perfilId: profiles[0] } }), await db.auditoriaTransacao.count({ where: { perfilId: profiles[0] } })]).toEqual(before);
  });
  it('US21: dois clientes leem e editam perfil; última aceita vence, hora do cliente é rejeitada', async () => {
    const a = await request('GET', base()); const b = await request('GET', base(), undefined, 1); expect(a.json()).toEqual(b.json());
    const updated = await request('PATCH', base(), { nome: 'Alteração A' }); expect(updated.statusCode).toBe(200);
    expect(new Date(updated.json().updatedAt).getTime()).toBeGreaterThan(new Date(a.json().updatedAt).getTime());
    expect((await request('GET', base(), undefined, 1)).json().nome).toBe('Alteração A');
    expect((await request('PATCH', base(), { nome: 'Alteração B' }, 1)).statusCode).toBe(200);
    expect((await request('GET', base())).json().nome).toBe('Alteração B');
    expect((await request('PATCH', base(), { nome: 'Forjada', updatedAt: '2099-01-01T00:00:00Z' })).statusCode).toBe(400);
    expect((await request('PATCH', base(), { nome: 'Invasão' }, 2)).statusCode).toBe(403);
  });
  it('US21: transação com duas edições sequenciais e concorrentes mantém auditoria completa', async () => {
    const created = await confirm([{ ...imported, descricao: 'Sync' }], true); const id = created.json().transactionIds[0]; const url = `${base()}/transactions/${id}`;
    expect((await request('GET', url)).json()).toEqual((await request('GET', url, undefined, 1)).json());
    const a = await request('PATCH', url, { descricao: 'A' }); expect(a.statusCode).toBe(200);
    expect((await request('GET', url, undefined, 1)).json().descricao).toBe('A');
    const b = await request('PATCH', url, { descricao: 'B' }, 1); expect(b.statusCode).toBe(200);
    expect((await request('GET', url)).json()).toMatchObject({ descricao: 'B', updatedAt: b.json().updatedAt });
    const simultaneous = await Promise.all([request('PATCH', url, { descricao: 'Concorrente A' }), request('PATCH', url, { descricao: 'Concorrente B' }, 1)]);
    expect(simultaneous.every(r => r.statusCode === 200)).toBe(true);
    const audits = await db.auditoriaTransacao.findMany({ where: { transacaoId: id }, orderBy: { realizadoEm: 'asc' } });
    expect(audits).toHaveLength(5);
    const final = (await request('GET', url)).json();
    // A cadeia de snapshots identifica a última edição serializada, sem presumir ordem de chegada HTTP.
    const edits = audits.filter(r => r.operacao === 'EDICAO').map(r => ({ before: r.estadoAnterior as { descricao: string }, after: r.estadoNovo as { descricao: string } }));
    const terminal = edits.find(e => !edits.some(other => other.before.descricao === e.after.descricao));
    expect(final.descricao).toBe(terminal?.after.descricao);
    expect(new Date(final.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(b.json().updatedAt).getTime());
  });
  it('US21: orçamento mensal atualiza timestamp ao substituir categorias e fica visível ao outro cliente', async () => {
    const monthly = `${base()}/budgets/monthly/2026/10`;
    const first = await request('PUT', monthly, { categorias: [{ categoriaId: category, valorPlanejado: '100.00' }] }); expect(first.statusCode).toBe(200);
    expect((await request('GET', monthly, undefined, 1)).json().id).toBe(first.json().id);
    const second = await request('PUT', monthly, { categorias: [{ categoriaId: category, valorPlanejado: '200.00' }] }, 1); expect(second.statusCode).toBe(200);
    expect(new Date(second.json().updatedAt).getTime()).toBeGreaterThan(new Date(first.json().updatedAt).getTime());
    expect((await request('GET', monthly)).json().totais.valorPlanejado).toBe('200.00');
    const url = `${base()}/budgets/${first.json().id}`;
    expect((await request('PATCH', url, { nome: 'Nome A' })).statusCode).toBe(200);
    expect((await request('PATCH', url, { nome: 'Nome B' }, 1)).statusCode).toBe(200);
    expect((await request('GET', url)).json().nome).toBe('Nome B');
  });
  it('US21: timestamps disponíveis nos demais recursos persistentes, sem campo artificial em projeções', async () => {
    const goal = await request('POST', `${base()}/goals`, { nome: 'Meta', valorAlvo: '100', dataLimite: '2026-12-31', frequenciaSugestao: 'DIARIA' }); expect(goal.statusCode).toBe(201); expect(goal.json().updatedAt).toEqual(expect.any(String));
    const reflection = await request('POST', `${base()}/reflection-items`, { descricao: 'Refletir' }); expect(reflection.statusCode).toBe(201); expect(reflection.json().updatedAt).toEqual(expect.any(String));
    const recurrence = await request('POST', `${base()}/recurrences`, { tipoTransacao: 'DESPESA', valor: '1', descricao: 'Recorrência', frequencia: 'MENSAL', proximaOcorrencia: '2026-12-01T12:00:00Z' });
    expect(recurrence.statusCode).toBe(201); expect(recurrence.json().updatedAt).toEqual(expect.any(String));
    const reminder = await request('POST', `${base()}/reminders`, { recorrenciaId: recurrence.json().id, notificarEm: '2026-11-30T12:00:00Z' }); expect(reminder.statusCode).toBe(201); expect(reminder.json().updatedAt).toEqual(expect.any(String));
    const quota = await request('PUT', `${base()}/free-spending-quota/2026/10`, { valorLimite: '50' }); expect(quota.statusCode).toBe(200); expect(quota.json().updatedAt).toEqual(expect.any(String));
    expect((await request('GET', `${base()}/analytics/spending-trends`)).json().updatedAt).toBeUndefined();
  });
  it('Push: cadastro repetido/concorrente idempotente, propriedade, inativos e múltiplos aparelhos', async () => {
    const register = () => request('POST', '/me/push-devices', { token, platform: 'ANDROID' });
    const [a, b] = await Promise.all([register(), register()]); expect(a.statusCode).toBe(201); expect(b.json().id).toBe(a.json().id); expect(a.body).not.toContain(token);
    expect(await db.dispositivoPush.count({ where: { token, ativo: true } })).toBe(1);
    expect((await request('POST', '/me/push-devices', { token, platform: 'ANDROID' }, 2)).statusCode).toBe(409);
    expect((await request('DELETE', `/me/push-devices/${a.json().id}`, undefined, 2)).statusCode).toBe(403);
    expect((await request('DELETE', `/me/push-devices/${a.json().id}`)).statusCode).toBe(204);
    const notifications = app.get(NotificationService); push.send.mockClear();
    await notifications.notify((await request('GET', '/me')).json().id, { type: 'TRANSACTION_REMINDER', profileId: profiles[0], title: 'Orca Finance', body: 'Lembrete' }, 'inactive', new Date('2026-10-19Z'));
    expect(push.send).not.toHaveBeenCalled();
    expect((await register()).json().id).toBe(a.json().id);
    expect((await request('POST', '/me/push-devices', { token: `${token.slice(0, -1)}_second]`, platform: 'IOS' })).statusCode).toBe(201);
    expect((await request('POST', '/me/push-devices', { token: 'invalid', platform: 'ANDROID' })).statusCode).toBe(400);
  });
  it('US54: resumo com gastos e orçamento, período correto, dois aparelhos, sem envio real e sem repetir ciclo', async () => {
    push.send.mockClear(); const job = app.get(WeeklySummaryJob); await job.tick();
    expect(push.send).toHaveBeenCalledTimes(2);
    const payload = push.send.mock.calls[0][1]; expect(payload).toMatchObject({ type: 'WEEKLY_SUMMARY', profileId: profiles[0], periodStart: '2026-10-05', periodEnd: '2026-10-11' });
    expect(payload.body).toContain('35.90'); expect(payload.body).toContain('200.00');
    await job.tick(); expect(push.send).toHaveBeenCalledTimes(2);
  });
  it('rotas novas exigem autenticação e POST /sync não existe', async () => {
    for (const url of [`${base()}/imports/transactions/preview`, `${base()}/imports/transactions/confirm`, '/me/push-devices']) {
      expect((await app.inject({ method: 'POST', url, payload: {} })).statusCode).toBe(401);
    }
    expect((await request('POST', '/sync', {})).statusCode).toBe(404);
  });
});
