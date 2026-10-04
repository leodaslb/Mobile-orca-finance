import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { Clock } from '../src/common/clock';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import { RecurrencesService } from '../src/modules/recurrences/recurrences.service';
import { TransactionsRepository } from '../src/modules/transactions/transactions.repository';
import { CloudinaryStorageService } from '../src/modules/transactions/cloudinary-storage.service';
import { JPEG_RECEIPT, PNG_RECEIPT, receiptMultipart } from './receipt-fixtures';

describe('Sprint 1: US12/19/24 HTTP → Neon', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let processor: RecurrencesService;
  let now = new Date('2026-10-01T12:00:00Z');
  const emails = [`flow-a-${randomUUID()}@example.test`, `flow-b-${randomUUID()}@example.test`];
  const profiles: string[] = [];
  const tokens: string[] = [];
  const expenses: string[] = [];
  const subcategories: string[] = [];
  const reflectionItems: string[] = [];
  let category: string;
  let income: string;
  let recurrence: string;
  let historical: string;
  let pending: string;
  let otherRecurrence: string;
  let otherReminder: string;
  const headers = (index = 0) => ({ authorization: `Bearer ${tokens[index]}` });
  const base = (index = 0) => `/profiles/${profiles[index]}`;
  const read = async (path: string, index = 0) => {
    const response = await app.inject({ method: 'GET', url: `${base(index)}${path}`, headers: headers(index) });
    expect(response.statusCode).toBe(200);
    return response.json();
  };
  const post = (path: string, payload: Record<string, unknown>, index = 0) => app.inject({
    method: 'POST', url: `${base(index)}${path}`, headers: headers(index), payload });
  const patch = (path: string, payload: Record<string, unknown>, index = 0) => app.inject({
    method: 'PATCH', url: `${base(index)}${path}`, headers: headers(index), payload });
  const template = (change: Record<string, unknown> = {}) => ({ tipoTransacao: 'DESPESA', valor: '20.00', descricao: 'Conta recorrente',
    categoriaId: category, frequencia: 'SEMANAL', proximaOcorrencia: '2026-10-02T12:00:00Z', ...change });
  const rows = (id = recurrence) => prisma.transacao.findMany({ where: { perfilId: profiles[0], recorrenciaId: id }, orderBy: { ocorrenciaReferencia: 'asc' } });
  const processAt = async (reference: string) => { now = new Date(reference); await processor.processDue(now, profiles[0]); };
  const cancel = async (id: string) => { expect((await patch(`/recurrences/${id}`, { ativa: false })).statusCode).toBe(200); };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue({ now: () => new Date(now) })
      .overrideProvider(CloudinaryStorageService).useValue({ uploadReceipt: async () => ({ publicId: `orca-finance/receipts/${randomUUID()}`,
        secureUrl: 'https://res.cloudinary.com/test/image/upload/receipt.png' }), removeReceipt: async () => undefined }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useLogger(false);
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
    processor = app.get(RecurrencesService);
    category = (await prisma.categoria.findFirstOrThrow({ where: { ativa: true }, select: { id: true } })).id;
    for (const email of emails) {
      const registered = await app.inject({ method: 'POST', url: '/auth/register', payload: { nome: 'Teste do fluxo', email, senha: 'senha de teste' } });
      expect(registered.statusCode).toBe(201);
      profiles.push(registered.json().profile.id);
      const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha: 'senha de teste' } });
      expect(login.statusCode).toBe(201);
      tokens.push(login.json().accessToken);
      const index = profiles.length - 1;
      const expense = await post('/transactions', { tipo: 'DESPESA', valor: '10', dataHora: now.toISOString(), descricao: 'Despesa com recibo',
        status: 'EFETIVADA', categoriaId: category }, index);
      expect(expense.statusCode).toBe(201);
      expenses.push(expense.json().id);
      const subcategory = await post('/subcategories', { categoriaId: category, nome: 'Subcategoria do fluxo' }, index);
      expect(subcategory.statusCode).toBe(201);
      subcategories.push(subcategory.json().id);
    }
    const revenue = await post('/transactions', { tipo: 'RECEITA', valor: '100', dataHora: now.toISOString(), descricao: 'Receita', status: 'EFETIVADA', categoriaId: category });
    expect(revenue.statusCode).toBe(201);
    income = revenue.json().id;
    expect((await app.inject({ method: 'PUT', url: `${base()}/budgets/monthly/2026/10`, headers: headers(),
      payload: { categorias: [{ categoriaId: category, valorPlanejado: '500' }] } })).statusCode).toBe(200);
    const other = await post('/recurrences', template({ ativa: false }), 1);
    expect(other.statusCode).toBe(201);
    otherRecurrence = other.json().id;
    const reminder = await post('/reminders', { recorrenciaId: otherRecurrence, notificarEm: now.toISOString() }, 1);
    expect(reminder.statusCode).toBe(201);
    otherReminder = reminder.json().id;
  }, 90000);

  afterAll(async () => {
    jest.restoreAllMocks();
    try { if (prisma) {
      const users = await prisma.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
      const ids = users.map((user) => user.id);
      const owned = await prisma.perfilFinanceiro.findMany({ where: { usuarioId: { in: ids } }, select: { id: true } });
      const perfilId = { in: owned.map((profile) => profile.id) };
      await prisma.lembreteVencimento.deleteMany({ where: { perfilId } });
      await prisma.transacao.deleteMany({ where: { perfilId } });
      await prisma.auditoriaTransacao.deleteMany({ where: { perfilId } });
      await prisma.recorrencia.deleteMany({ where: { perfilId } });
      await prisma.itemReflexao.deleteMany({ where: { perfilId } });
      await prisma.orcamentoCategoria.deleteMany({ where: { orcamento: { perfilId } } });
      await prisma.orcamento.deleteMany({ where: { perfilId } });
      await prisma.subcategoria.deleteMany({ where: { perfilId } });
      await prisma.perfilFinanceiro.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    } } finally { await app?.close(); }
  });

  it('US12: padrão/customização/liberação/PATCH não afetam transações ou projeções', async () => {
    const before = await read('/dashboard?year=2026&month=10');
    const budget = await read('/budgets/monthly/2026/10');
    const report = await read('/reports/expenses?startDate=2026-10-01&endDate=2026-10-31');
    const count = await prisma.transacao.count({ where: { perfilId: profiles[0] } });
    const standard = await post('/reflection-items', { descricao: 'Pensar antes de comprar' });
    expect(standard.statusCode).toBe(201);
    reflectionItems.push(standard.json().id);
    expect(standard.json()).toMatchObject({ entradaEm: now.toISOString(), duracaoHoras: 48, liberaEm: '2026-10-03T12:00:00.000Z', liberado: false });
    const custom = await post('/reflection-items', { descricao: 'Outra compra', duracaoHoras: 2 });
    expect(custom.statusCode).toBe(201);
    expect(custom.json().liberaEm).toBe('2026-10-01T14:00:00.000Z');
    expect((await read('/reflection-items')).length).toBe(2);
    now = new Date('2026-10-03T11:59:59.999Z');
    expect((await read(`/reflection-items/${reflectionItems[0]}`)).liberado).toBe(false);
    now = new Date('2026-10-03T12:00:00Z');
    expect((await read(`/reflection-items/${reflectionItems[0]}`)).liberado).toBe(true);
    const edited = await patch(`/reflection-items/${reflectionItems[0]}`, { descricao: 'Compra reconsiderada', duracaoHoras: 72 });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toMatchObject({ entradaEm: '2026-10-01T12:00:00.000Z', liberaEm: '2026-10-04T12:00:00.000Z', liberado: false });
    expect(await prisma.transacao.count({ where: { perfilId: profiles[0] } })).toBe(count);
    expect(await read('/dashboard?year=2026&month=10')).toEqual(before);
    expect(await read('/budgets/monthly/2026/10')).toEqual(budget);
    expect(await read('/reports/expenses?startDate=2026-10-01&endDate=2026-10-31')).toEqual(report);
    now = new Date('2026-10-01T12:00:00Z');
  });

  it('US12/19: rejeita dados inválidos e guarda apenas RECIBO de DESPESA', async () => {
    for (const payload of [{ descricao: ' ' }, { descricao: 'Compra', duracaoHoras: 0 }, { descricao: 'Compra', entradaEm: now.toISOString() }]) {
      expect((await post('/reflection-items', payload)).statusCode).toBe(400);
    }
    expect((await patch(`/reflection-items/${reflectionItems[0]}`, {})).statusCode).toBe(400);
    const url = `/transactions/${expenses[0]}/receipts`;
    for (const payload of [{ arquivoUrl: '' }, { arquivoUrl: 'arquivo.pdf' }, { arquivoUrl: 'https://example.com/file', tipo: 'OUTRO' }]) {
      expect((await post(url, payload)).statusCode).toBe(415);
    }
    const count = await prisma.auditoriaTransacao.count({ where: { perfilId: profiles[0] } });
    const jpeg = receiptMultipart([{ buffer: JPEG_RECEIPT, mimeType: 'image/jpeg' }]);
    const receipt = await app.inject({ method: 'POST', url: `${base()}${url}`, headers: { ...headers(), ...jpeg.headers }, payload: jpeg.payload });
    expect(receipt.statusCode).toBe(201);
    expect(receipt.json()).toMatchObject({ tipo: 'RECIBO', transacaoId: expenses[0], mimeType: 'image/jpeg' });
    const png = receiptMultipart([{ buffer: PNG_RECEIPT, mimeType: 'image/png' }]);
    const second = await app.inject({ method: 'POST', url: `${base()}${url}`, headers: { ...headers(), ...png.headers }, payload: png.payload });
    expect(second.statusCode).toBe(201);
    expect(second.json().mimeType).toBe('image/png');
    const list = await read(url);
    expect(list).toHaveLength(2);
    expect((await read(`/transactions/${expenses[0]}`)).recibos).toEqual(list);
    expect((await read(`/transactions/${expenses[0]}`)).tags).toEqual([]);
    expect((await post(`/transactions/${income}/receipts`, { arquivoUrl: 'https://example.com/file' })).statusCode).toBe(400);
    expect(await prisma.auditoriaTransacao.count({ where: { perfilId: profiles[0] } })).toBe(count);
  });

  it('US24: cria/lista/detalha recorrência semanal e PREVISTA não afeta finanças', async () => {
    const before = await read('/dashboard?year=2026&month=10');
    const budget = await read('/budgets/monthly/2026/10');
    const created = await post('/recurrences', template());
    expect(created.statusCode).toBe(201);
    recurrence = created.json().id;
    expect(created.json()).toMatchObject({ frequencia: 'SEMANAL', valor: '20.00', ativa: true });
    expect((await read('/recurrences')).map((item: { id: string }) => item.id)).toEqual([recurrence]);
    expect((await read(`/recurrences/${recurrence}`)).id).toBe(recurrence);
    const occurrences = await rows();
    expect(occurrences).toHaveLength(1);
    historical = occurrences[0].id;
    expect(occurrences[0]).toMatchObject({ status: 'PREVISTA', recorrenciaId: recurrence, ocorrenciaReferencia: new Date('2026-10-02T12:00:00Z') });
    expect((await read(`/transactions/${historical}`)).ocorrenciaReferencia).toBe('2026-10-02T12:00:00.000Z');
    const after = await read('/dashboard?year=2026&month=10');
    expect(after.saldoAtual).toBe(before.saldoAtual);
    expect(after.gastosDoMes).toBe(before.gastosDoMes);
    expect(after.comparacaoComMesAnterior).toEqual(before.comparacaoComMesAnterior);
    expect(after.transacoesRecentes).toContainEqual(expect.objectContaining({ id: historical, status: 'PREVISTA' }));
    expect(await read('/budgets/monthly/2026/10')).toEqual(budget);
    await processor.processDue(now, profiles[0]);
    expect(await rows()).toHaveLength(1);
  });

  it('US24: processamento concorrente/repetido efetiva uma vez e materializa só a próxima', async () => {
    now = new Date('2026-10-02T12:00:00Z');
    expect((await patch(`/recurrences/${recurrence}`, { valor: '30' })).statusCode).toBe(409);
    await Promise.all([processor.processDue(now, profiles[0]), processor.processDue(now, profiles[0])]);
    await processor.processDue(now, profiles[0]);
    const occurrences = await rows();
    expect(occurrences).toHaveLength(2);
    expect(occurrences[0]).toMatchObject({ id: historical, status: 'EFETIVADA' });
    expect(occurrences[1]).toMatchObject({ status: 'PREVISTA', ocorrenciaReferencia: new Date('2026-10-09T12:00:00Z') });
    pending = occurrences[1].id;
    expect((await read(`/recurrences/${recurrence}`)).proximaOcorrencia).toBe('2026-10-09T12:00:00.000Z');
    expect(await prisma.auditoriaTransacao.count({ where: { transacaoId: { in: occurrences.map((item) => item.id) } } })).toBe(3);
    expect((await read('/dashboard?year=2026&month=10')).saldoAtual).toBe('70.00');
    expect((await read('/budgets/monthly/2026/10')).totais.valorRealizado).toBe('30.00');
  });

  it('US24: edição só altera futura; reprogramação e cancelamento preservam EFETIVADA', async () => {
    const before = await prisma.transacao.findUniqueOrThrow({ where: { id: historical } });
    expect((await patch(`/recurrences/${recurrence}`, { valor: '35.25', descricao: 'Conta editada' })).statusCode).toBe(200);
    expect((await prisma.transacao.findUniqueOrThrow({ where: { id: pending } })).valor.toFixed(2)).toBe('35.25');
    expect(await prisma.transacao.findUniqueOrThrow({ where: { id: historical } })).toEqual(before);
    expect((await patch(`/recurrences/${recurrence}`, { frequencia: 'MENSAL', proximaOcorrencia: '2026-10-15T12:00:00Z' })).statusCode).toBe(200);
    expect(await prisma.transacao.count({ where: { id: pending } })).toBe(0);
    const next = (await rows())[1];
    expect(next.ocorrenciaReferencia?.toISOString()).toBe('2026-10-15T12:00:00.000Z');
    await cancel(recurrence);
    expect(await rows()).toEqual([before]);
    expect((await read(`/recurrences/${recurrence}`)).ativa).toBe(false);
    await processAt('2026-10-31T12:00:00Z');
    expect(await rows()).toEqual([before]);
    expect((await read('/dashboard?year=2026&month=10')).saldoAtual).toBe('70.00');
    now = new Date('2026-10-02T12:00:00Z');
  });

  it('US24: mensal/anual e categoria opcional preservam datas e única próxima PREVISTA', async () => {
    for (const [frequencia, next] of [['MENSAL', '2026-11-03T12:00:00.000Z'], ['ANUAL', '2027-10-03T12:00:00.000Z']]) {
      const created = await post('/recurrences', template({ frequencia, proximaOcorrencia: '2026-10-03T12:00:00Z', categoriaId: null }));
      expect(created.statusCode).toBe(201);
      const id = created.json().id;
      await processAt('2026-10-03T12:00:00Z');
      const occurrences = await rows(id);
      expect(occurrences.map((item) => item.status)).toEqual(['EFETIVADA', 'PREVISTA']);
      expect(occurrences[1].ocorrenciaReferencia?.toISOString()).toBe(next);
      expect(occurrences[0].ehGastoLivre).toBe(false);
      await cancel(id);
    }
  });

  it('US24: dataTermino inclui última data e encerra sem criar ocorrência posterior', async () => {
    expect((await post('/recurrences', template({ proximaOcorrencia: '2026-10-04T12:00:00Z', dataTermino: '2026-10-03' }))).statusCode).toBe(400);
    const created = await post('/recurrences', template({ proximaOcorrencia: '2026-10-04T12:00:00Z', dataTermino: '2026-10-11' }));
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    await processAt('2026-10-04T12:00:00Z');
    expect((await rows(id))[1].status).toBe('PREVISTA');
    await processAt('2026-10-11T12:00:00Z');
    await processor.processDue(now, profiles[0]);
    expect((await rows(id)).map((item) => item.status)).toEqual(['EFETIVADA', 'EFETIVADA']);
    expect((await read(`/recurrences/${id}`)).ativa).toBe(false);
  });

  it('US24: rollback de criação/processamento/edição se auditoria falha', async () => {
    now = new Date('2026-10-11T12:00:00Z');
    const repository = app.get(TransactionsRepository);
    const original = repository.createAudit.bind(repository);
    const count = await prisma.recorrencia.count({ where: { perfilId: profiles[0] } });
    let spy = jest.spyOn(repository, 'createAudit').mockImplementation((data, tx) => original({ ...data, perfilId: randomUUID() }, tx));
    try { expect((await post('/recurrences', template({ proximaOcorrencia: '2026-10-12T12:00:00Z' }))).statusCode).toBe(500); }
    finally { spy.mockRestore(); }
    expect(await prisma.recorrencia.count({ where: { perfilId: profiles[0] } })).toBe(count);
    const created = await post('/recurrences', template({ proximaOcorrencia: '2026-10-12T12:00:00Z' }));
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    const before = await rows(id);
    const record = await prisma.recorrencia.findUniqueOrThrow({ where: { id } });
    const audits = await prisma.auditoriaTransacao.count({ where: { perfilId: profiles[0] } });
    spy = jest.spyOn(repository, 'createAudit').mockImplementation((data, tx) => original({ ...data,
      ...(data.operacao === 'CRIACAO' && { perfilId: randomUUID() }) }, tx));
    try { await processAt('2026-10-12T12:00:00Z'); } finally { spy.mockRestore(); }
    expect(await rows(id)).toEqual(before);
    expect(await prisma.recorrencia.findUniqueOrThrow({ where: { id } })).toEqual(record);
    expect(await prisma.auditoriaTransacao.count({ where: { perfilId: profiles[0] } })).toBe(audits);
    await processor.processDue(now, profiles[0]);
    const processed = await rows(id);
    const processedRecord = await prisma.recorrencia.findUniqueOrThrow({ where: { id } });
    spy = jest.spyOn(repository, 'createAudit').mockImplementation((data, tx) => original({ ...data, perfilId: randomUUID() }, tx));
    try { expect((await patch(`/recurrences/${id}`, { valor: '99' })).statusCode).toBe(500); } finally { spy.mockRestore(); }
    expect(await rows(id)).toEqual(processed);
    expect(await prisma.recorrencia.findUniqueOrThrow({ where: { id } })).toEqual(processedRecord);
    await cancel(id);
  });

  it('US24: lembretes validam todas as origens, aceitam ambas e permitem alternar ativo', async () => {
    const date = now.toISOString();
    expect((await post('/reminders', { notificarEm: date })).statusCode).toBe(400);
    expect((await post('/reminders', { notificarEm: date, transacaoId: expenses[1] })).statusCode).toBe(400);
    expect((await post('/reminders', { notificarEm: date, recorrenciaId: otherRecurrence })).statusCode).toBe(400);
    expect((await post('/reminders', { notificarEm: date, transacaoId: expenses[0], recorrenciaId: otherRecurrence })).statusCode).toBe(400);
    const transaction = await post('/reminders', { notificarEm: date, transacaoId: expenses[0] });
    expect(transaction.statusCode).toBe(201);
    const recurring = await post('/reminders', { notificarEm: date, recorrenciaId: recurrence });
    expect(recurring.statusCode).toBe(201);
    const both = await post('/reminders', { notificarEm: date, transacaoId: expenses[0], recorrenciaId: recurrence });
    expect(both.statusCode).toBe(201);
    expect((await read('/reminders')).length).toBe(3);
    const id = transaction.json().id;
    expect((await patch(`/reminders/${id}`, { ativo: false })).json().ativo).toBe(false);
    expect((await patch(`/reminders/${id}`, { ativo: true })).json().ativo).toBe(true);
    expect((await patch(`/reminders/${id}`, { transacaoId: null })).statusCode).toBe(400);
    expect((await patch(`/reminders/${id}`, { recorrenciaId: otherRecurrence })).statusCode).toBe(400);
    expect((await patch(`/reminders/${id}`, {})).statusCode).toBe(400);
  });

  it('US12/19/24: JWT/ownership bloqueiam todos os endpoints e ids cruzados', async () => {
    const reflection = await post('/reflection-items', { descricao: 'Item B' }, 1);
    expect(reflection.statusCode).toBe(201);
    const paths = ['/reflection-items', `/reflection-items/${reflection.json().id}`, `/transactions/${expenses[1]}/receipts`, '/recurrences',
      `/recurrences/${otherRecurrence}`, '/reminders'];
    for (const path of paths) {
      expect((await app.inject({ method: 'GET', url: `${base(1)}${path}`, headers: headers() })).statusCode).toBe(403);
      expect((await app.inject({ method: 'GET', url: `${base()}${path}` })).statusCode).toBe(401);
    }
    for (const [path, payload] of [['/reflection-items', { descricao: 'Invasão' }], [`/transactions/${expenses[1]}/receipts`, { arquivoUrl: 'https://example.com/file' }],
      ['/recurrences', template()], ['/reminders', { notificarEm: now.toISOString(), recorrenciaId: otherRecurrence }]] as const) {
      expect((await app.inject({ method: 'POST', url: `${base(1)}${path}`, headers: headers(), payload })).statusCode).toBe(403);
    }
    for (const [path, payload] of [[`/reflection-items/${reflection.json().id}`, { descricao: 'Invasão' }],
      [`/recurrences/${otherRecurrence}`, { ativa: false }], [`/reminders/${otherReminder}`, { ativo: false }]] as const) {
      expect((await app.inject({ method: 'PATCH', url: `${base(1)}${path}`, headers: headers(), payload })).statusCode).toBe(403);
      expect((await patch(path, payload)).statusCode).toBe(404);
    }
    expect((await post(`/transactions/${expenses[1]}/receipts`, { arquivoUrl: 'https://example.com/file' })).statusCode).toBe(404);
    expect((await post('/recurrences', template({ subcategoriaId: subcategories[1] }))).statusCode).toBe(400);
    expect((await patch(`/recurrences/${recurrence}`, { subcategoriaId: subcategories[1] })).statusCode).toBe(400);
  });

  it('reversão remove recibos/lembretes por CASCADE e snapshots continuam escalares', async () => {
    const before = await prisma.transacao.findUniqueOrThrow({ where: { id: expenses[0] } });
    expect((await patch(`/transactions/${expenses[0]}`, { descricao: 'Despesa editada' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `${base()}/transactions/${expenses[0]}`, headers: headers() })).statusCode).toBe(204);
    expect(await prisma.anexoTransacao.count({ where: { transacaoId: expenses[0] } })).toBe(0);
    expect(await prisma.lembreteVencimento.count({ where: { transacaoId: expenses[0] } })).toBe(0);
    expect(await prisma.lembreteVencimento.count({ where: { perfilId: profiles[0], recorrenciaId: recurrence } })).toBe(1);
    const audits = await prisma.auditoriaTransacao.findMany({ where: { perfilId: profiles[0] } });
    for (const audit of audits) {
      for (const snapshot of [audit.estadoAnterior, audit.estadoNovo]) {
        if (snapshot) expect(Object.keys(snapshot).sort()).toEqual(Object.keys(before).sort());
      }
    }
    const exclusions = audits.filter((audit) => audit.operacao === 'EXCLUSAO');
    expect(exclusions.length).toBeGreaterThan(0);
    expect(exclusions.every((audit) => audit.transacaoId === null)).toBe(true);
    expect(await prisma.categoria.count()).toBe(7);
  });
});
