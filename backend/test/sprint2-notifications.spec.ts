import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Clock } from '../src/common/clock';
import { NotificationService } from '../src/modules/notifications/notification.service';
import { NotificationsRepository } from '../src/modules/notifications/notifications.repository';
import { ExpoPushProvider, PushPayload, PushProvider } from '../src/modules/notifications/push.provider';
import { WeeklySummaryJob } from '../src/modules/notifications/weekly-summary.job';
import { WeeklySummaryService } from '../src/modules/notifications/weekly-summary.service';
import { BudgetsService } from '../src/modules/budgets/budgets.service';
import { Prisma } from '../src/generated/prisma/client';

const now = new Date('2026-10-12T12:00:00Z'); const clock = { now: () => new Date(now) } as Clock;
const payload: PushPayload = { type: 'TRANSACTION_REMINDER', profileId: 'p', title: 'Orca Finance', body: 'Lembrete' };
describe('US16/54: push isolado, dispositivos e deduplicação RN-NOT-01', () => {
  const send = jest.fn(); const activeDevices = jest.fn(); const deactivate = jest.fn(); const find = jest.fn(); const register = jest.fn();
  const repo = { activeDevices, deactivate, find, register };
  let service: NotificationService;
  beforeEach(() => {
    jest.resetAllMocks(); send.mockResolvedValue('ACCEPTED'); activeDevices.mockResolvedValue([{ id: 'a', token: 'a' }, { id: 'b', token: 'b' }]);
    service = new NotificationService(repo as unknown as NotificationsRepository, { send } as PushProvider, clock);
  });
  it('envia a todos os ativos, deduplica por dispositivo/perfil/evento/janela, inclusive chamadas concorrentes', async () => {
    const expires = new Date('2026-10-19T00:00:00Z');
    await Promise.all([service.notify('u', payload, 'week', expires), service.notify('u', payload, 'week', expires)]);
    expect(send).toHaveBeenCalledTimes(2);
    await service.notify('u', { ...payload, profileId: 'other' }, 'week', expires); expect(send).toHaveBeenCalledTimes(4);
    await service.notify('u', payload, 'next-week', expires); expect(send).toHaveBeenCalledTimes(6);
    await service.notify('u', { ...payload, type: 'WEEKLY_SUMMARY' }, 'week', expires); expect(send).toHaveBeenCalledTimes(8);
  });
  it('ausência de aparelhos ativos e janela expirada não enviam', async () => {
    activeDevices.mockResolvedValue([]);
    expect(await service.notify('u', payload, 'w', new Date('2026-10-19Z'))).toEqual({ accepted: 0, failed: 0 });
    activeDevices.mockResolvedValue([{ id: 'a', token: 'a' }]);
    await service.notify('u', payload, 'w', new Date('2026-10-11Z')); expect(send).not.toHaveBeenCalled();
  });
  it('falha em um aparelho não impede os demais e pode ser retentada sem repetir sucesso', async () => {
    send.mockRejectedValueOnce(new Error('offline'));
    const expires = new Date('2026-10-19T00:00:00Z');
    expect(await service.notify('u', payload, 'w', expires)).toEqual({ accepted: 1, failed: 1 });
    expect(await service.notify('u', payload, 'w', expires)).toEqual({ accepted: 1, failed: 0 }); expect(send).toHaveBeenCalledTimes(3);
  });
  it('token não registrado é desativado sem expor credenciais', async () => {
    send.mockResolvedValueOnce('DEVICE_NOT_REGISTERED'); await service.notify('u', payload, 'w', new Date('2026-10-19Z'));
    expect(deactivate).toHaveBeenCalledWith('u', 'a');
  });
  it('dispositivo exige proprietário e registro não devolve token', async () => {
    find.mockResolvedValue({ usuarioId: 'other' }); await expect(service.deactivate('u', 'id')).rejects.toBeInstanceOf(ForbiddenException);
    expect(deactivate).not.toHaveBeenCalled();
    register.mockResolvedValue({ id: 'id', plataforma: 'ANDROID', ativo: true, token: 'secret', createdAt: now, updatedAt: now });
    expect(await service.register('u', { platform: 'ANDROID', token: 'secret' })).toEqual({ id: 'id', platform: 'ANDROID', active: true, createdAt: now.toISOString(), updatedAt: now.toISOString() });
    register.mockResolvedValue(null); await expect(service.register('u', { platform: 'ANDROID', token: 'other' })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('Expo provider: fetch sempre mockado, nenhum push real', () => {
  const original = global.fetch; const fetchMock = jest.fn();
  beforeEach(() => { global.fetch = fetchMock; fetchMock.mockReset(); }); afterEach(() => { global.fetch = original; });
  it('mapeia envelope Expo e confirma ticket, sem confundir com entrega', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { status: 'ok', id: 'ticket' } }) });
    expect(await new ExpoPushProvider().send('ExpoPushToken[fixture]', payload)).toBe('ACCEPTED');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ to: 'ExpoPushToken[fixture]', title: payload.title, body: payload.body,
      data: { type: payload.type, profileId: 'p' }, sound: 'default' });
  });
  it('trata token inválido, falha HTTP, falha de ticket e falha de rede', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } }) });
    expect(await new ExpoPushProvider().send('fixture', payload)).toBe('DEVICE_NOT_REGISTERED');
    for (const response of [{ ok: false }, { ok: true, json: async () => ({ data: { status: 'error' } }) }]) {
      fetchMock.mockResolvedValueOnce(response); await expect(new ExpoPushProvider().send('fixture', payload)).rejects.toThrow();
    }
    fetchMock.mockRejectedValueOnce(new Error('network')); await expect(new ExpoPushProvider().send('fixture', payload)).rejects.toThrow();
  });
});

describe('RF26 → US54: semana civil concluída, progresso reutilizado e isolamento', () => {
  it('read service delega orçamento e consulta somente despesas do perfil/período', async () => {
    const weeklyExpenses = jest.fn().mockResolvedValue([{ id: 't', descricao: 'Mercado', valor: new Prisma.Decimal(80), categoriaId: 'c' }]);
    const listBudgets = jest.fn().mockResolvedValue([{ id: 'b', nome: 'Mensal', dataInicio: '2026-10-01', dataFim: '2026-10-31', resumo: { valorPlanejado: '100', valorRealizado: '80' } }]);
    const summary = await new WeeklySummaryService({ weeklyExpenses } as unknown as NotificationsRepository, { listBudgets } as unknown as BudgetsService)
      .summary('u', 'p', new Date('2026-10-05Z'), new Date('2026-10-12Z'));
    expect(listBudgets).toHaveBeenCalledWith('u', 'p', { active: true, from: '2026-10-05', to: '2026-10-11' });
    expect(summary.largestExpenses[0].valor).toBe('80.00'); expect(summary.budgets[0]).toMatchObject({ valorRealizado: '80' });
    expect(weeklyExpenses).toHaveBeenCalledWith('p', new Date('2026-10-05Z'), new Date('2026-10-12Z'));
  });
  it('job mantém contextos distintos por perfil e continua após falha em um perfil', async () => {
    const recipientProfiles = jest.fn().mockResolvedValue([{ id: 'a', usuarioId: 'u' }, { id: 'b', usuarioId: 'u' }, { id: 'c', usuarioId: 'v' }]);
    const summary = jest.fn().mockRejectedValueOnce(new Error('read failed')).mockResolvedValue({ largestExpenses: [], budgets: [] }); const notify = jest.fn();
    const job = new WeeklySummaryJob({ recipientProfiles } as unknown as NotificationsRepository, { summary } as unknown as WeeklySummaryService,
      { notify } as unknown as NotificationService, clock);
    await job.tick(); expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenNthCalledWith(1, 'u', expect.objectContaining({ profileId: 'b', type: 'WEEKLY_SUMMARY', periodStart: '2026-10-05', periodEnd: '2026-10-11' }),
      '2026-10-05T00:00:00.000Z', new Date('2026-10-19Z'));
    expect(notify.mock.calls[1][1].profileId).toBe('c');
  });
});
