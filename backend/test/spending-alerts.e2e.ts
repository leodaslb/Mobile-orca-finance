import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { Clock } from '../src/common/clock';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import { PushProvider } from '../src/modules/notifications/push.provider';
import { SpendingAlertsService } from '../src/modules/spending-alerts/spending-alerts.service';
import { BudgetsService } from '../src/modules/budgets/budgets.service';
import { BudgetsRepository } from '../src/modules/budgets/budgets.repository';
import { NotificationService } from '../src/modules/notifications/notification.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { RecurrencesService } from '../src/modules/recurrences/recurrences.service';

describe('RF71 → US52: push, rearme aprovado e persistência HTTP/PostgreSQL', () => {
  let app: NestFastifyApplication; let db: PrismaService; let token: string; let user: string; let profile: string; let category: string; let rule: string; let expense: string;
  const email = `spending-alert-${randomUUID()}@example.test`;
  let now = new Date('2026-11-06T12:00:00Z');
  const provider = { send: jest.fn().mockResolvedValue('ACCEPTED') };
  const request = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, payload?: object) => app.inject({ method, url: `/profiles/${profile}/${path}`, headers: { authorization: `Bearer ${token}` }, ...(payload && { payload }) });
  const createExpense = (value: string) => request('POST', 'transactions', { tipo: 'DESPESA', status: 'EFETIVADA', valor: value, descricao: 'Alerta de teste', categoriaId: category, dataHora: now.toISOString() });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue({ now: () => new Date(now) }).overrideProvider(PushProvider).useValue(provider).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter()); app.useLogger(false); configureApp(app); await app.init(); await app.getHttpAdapter().getInstance().ready(); db = app.get(PrismaService);
    const registration = await app.inject({ method: 'POST', url: '/auth/register', payload: { nome: 'Teste alertas', email, senha: 'test-alert-password' } });
    expect(registration.statusCode).toBe(201); user = registration.json().user.id; profile = registration.json().profile.id;
    token = (await app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha: 'test-alert-password' } })).json().accessToken;
    category = (await db.categoria.findFirstOrThrow({ where: { ativa: true } })).id;
    expect((await app.inject({ method: 'POST', url: '/me/push-devices', headers: { authorization: `Bearer ${token}` }, payload: { token: `ExpoPushToken[${randomUUID()}]`, platform: 'ANDROID' } })).statusCode).toBe(201);
    const created = await request('POST', 'spending-rules', { tipo: 'LIMITE_CATEGORIA', categoriaId: category, valorLimite: '100.00', periodo: 'MENSAL', canais: ['PUSH'], ativa: true });
    expect(created.statusCode).toBe(201); rule = created.json().id;
  }, 90000);
  afterAll(async () => {
    try {
      if (db && user) {
        await db.regraGastoCanal.deleteMany({ where: { regraGasto: { perfilId: profile } } });
        await db.regraGasto.deleteMany({ where: { perfilId: profile } });
        await db.transacao.deleteMany({ where: { perfilId: profile } }); await db.auditoriaTransacao.deleteMany({ where: { perfilId: profile } });
        await db.recorrencia.deleteMany({ where: { perfilId: profile } });
        await db.dispositivoPush.deleteMany({ where: { usuarioId: user } });
        await db.perfilFinanceiro.deleteMany({ where: { usuarioId: user } }); await db.usuario.delete({ where: { id: user } });
      }
    } finally { await app?.close(); }
  }, 90000);
  it('não envia abaixo/igual ao limite de categoria e envia uma vez depois do commit', async () => {
    expect((await createExpense('50.00')).statusCode).toBe(201); expect(provider.send).not.toHaveBeenCalled();
    expense = (await createExpense('50.00')).json().id; expect(provider.send).not.toHaveBeenCalled();
    expect((await createExpense('1.00')).statusCode).toBe(201); expect(provider.send).toHaveBeenCalledTimes(1);
    expect(provider.send.mock.calls[0][1]).toMatchObject({ type: 'SPENDING_LIMIT', profileId: profile, ruleId: rule });
    expect((await db.estadoAlertaRegraGasto.findUniqueOrThrow({ where: { regraGastoId: rule } })).ciclo).toBe(1);
    const state = await db.estadoAlertaRegraGasto.findUniqueOrThrow({ where: { regraGastoId: rule } });
    expect((await request('GET', 'spending-rules')).statusCode).toBe(200);
    expect((await db.estadoAlertaRegraGasto.findUniqueOrThrow({ where: { regraGastoId: rule } })).updatedAt).toEqual(state.updatedAt);
  });
  it('consumo retorna ao normal, rearma e nova violação gera outro aviso', async () => {
    expect((await request('PATCH', `transactions/${expense}`, { valor: '49.00' })).statusCode).toBe(200);
    expect((await db.estadoAlertaRegraGasto.findUniqueOrThrow({ where: { regraGastoId: rule } })).violada).toBe(false);
    expect((await request('PATCH', `transactions/${expense}`, { valor: '50.00' })).statusCode).toBe(200);
    expect(provider.send).toHaveBeenCalledTimes(1);
    expect((await createExpense('1.00')).statusCode).toBe(201); expect(provider.send).toHaveBeenCalledTimes(1);
  });
  it('duas gravações concorrentes reservam uma única transição', async () => {
    expect((await request('PATCH', `spending-rules/${rule}`, { valorLimite: '200.00' })).statusCode).toBe(200);
    const results = await Promise.all([createExpense('100.00'), createExpense('100.00')]); expect(results.map(r => r.statusCode)).toEqual([201, 201]);
    expect(provider.send).toHaveBeenCalledTimes(1);
  });
  it('falha do provedor não desfaz nem repete lançamento e não reenvia mesma violação', async () => {
    await request('PATCH', `spending-rules/${rule}`, { valorLimite: '500.00' }); provider.send.mockRejectedValueOnce(new Error('internal provider detail'));
    const response = await createExpense('250.00'); expect(response.statusCode).toBe(201); expect(response.body).not.toContain('provider detail');
    expect(await db.transacao.findUnique({ where: { id: response.json().id } })).not.toBeNull(); expect(provider.send).toHaveBeenCalledTimes(1);
    await createExpense('1.00'); expect(provider.send).toHaveBeenCalledTimes(1);
  });
  it('nova instância e estado inativo não repetem evento reservado; acesso alheio falha', async () => {
    const restarted = new SpendingAlertsService(db, app.get(BudgetsService), app.get(BudgetsRepository), app.get(NotificationService), app.get(ProfilesService));
    await restarted.evaluate(user, profile); expect(provider.send).not.toHaveBeenCalled();
    await restarted.evaluate(randomUUID(), profile); expect(provider.send).not.toHaveBeenCalled();
    await request('PATCH', `spending-rules/${rule}`, { ativa: false }); await createExpense('1.00'); expect(provider.send).not.toHaveBeenCalled();
    await request('PATCH', `spending-rules/${rule}`, { ativa: true }); expect(provider.send).not.toHaveBeenCalled();
  });
  it('DELETE rearma; dados inválidos não produzem efeito; nova janela tem estado próprio', async () => {
    await request('PATCH', `spending-rules/${rule}`, { valorLimite: '525.00' });
    expect((await request('POST', 'transactions', { tipo: 'DESPESA' })).statusCode).toBe(400); expect(provider.send).not.toHaveBeenCalled();
    expect((await request('DELETE', `transactions/${expense}`)).statusCode).toBe(204);
    expect((await db.estadoAlertaRegraGasto.findUniqueOrThrow({ where: { regraGastoId: rule } })).violada).toBe(false);
    now = new Date('2026-12-02T12:00:00Z'); await createExpense('1001.00'); expect(provider.send).toHaveBeenCalledTimes(1);
    expect((await db.estadoAlertaRegraGasto.findUniqueOrThrow({ where: { regraGastoId: rule } })).inicioPeriodo.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
  it('limite diário alerta ao atingir; EMAIL isolado não envia push', async () => {
    const before = provider.send.mock.calls.length;
    const daily = await request('POST', 'spending-rules', { tipo: 'LIMITE_DIARIO', valorLimite: '1001.00', periodo: 'DIARIO', canais: ['PUSH'], ativa: true });
    expect(daily.statusCode).toBe(201); expect(provider.send).toHaveBeenCalledTimes(before + 1);
    const emailOnly = await request('POST', 'spending-rules', { tipo: 'LIMITE_DIARIO', valorLimite: '1001.00', periodo: 'DIARIO', canais: ['EMAIL'], ativa: true });
    expect(emailOnly.statusCode).toBe(201); expect(provider.send).toHaveBeenCalledTimes(before + 1);
  });
  it('confirmação CSV avalia somente depois do commit do lote e rejeição não envia', async () => {
    await request('PATCH', `spending-rules/${rule}`, { valorLimite: '2010.00' });
    const rows = ['A', 'B'].map(suffix => ({ tipo: 'DESPESA', valor: '600.00', dataHora: now.toISOString(), descricao: `Import ${suffix}`, categoriaId: category }));
    const response = await request('POST', 'imports/transactions/confirm', { rows, confirmPossibleDuplicates: false });
    expect(response.statusCode).toBe(201); expect(response.json().created).toBe(2); expect(provider.send).toHaveBeenCalledTimes(1);
    expect((await request('POST', 'imports/transactions/confirm', { rows, confirmPossibleDuplicates: false })).statusCode).toBe(409);
    expect(provider.send).toHaveBeenCalledTimes(1);
  });
  it('materialização automática também avalia depois do commit', async () => {
    await request('PATCH', `spending-rules/${rule}`, { valorLimite: '3000.00' });
    const recurrence = await request('POST', 'recurrences', { tipoTransacao: 'DESPESA', valor: '1000.00', descricao: 'Recorrência de teste alerta', categoriaId: category,
      frequencia: 'MENSAL', proximaOcorrencia: '2026-12-03T12:00:00Z' });
    expect(recurrence.statusCode).toBe(201); expect(provider.send).not.toHaveBeenCalled();
    now = new Date('2026-12-03T12:00:00Z'); await app.get(RecurrencesService).processDue(now, profile);
    expect(provider.send).toHaveBeenCalledTimes(1);
    expect(await db.transacao.count({ where: { perfilId: profile, recorrenciaId: recurrence.json().id, status: 'EFETIVADA' } })).toBe(1);
  });
});
