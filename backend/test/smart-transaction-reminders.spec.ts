import { Test } from '@nestjs/testing';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { Clock } from '../src/common/clock';
import { NotificationsRepository } from '../src/modules/notifications/notifications.repository';
import { NotificationService } from '../src/modules/notifications/notification.service';
import { SmartTransactionReminderService } from '../src/modules/notifications/smart-transaction-reminder.service';
import { SmartTransactionReminderJob } from '../src/modules/notifications/smart-transaction-reminder.job';

const now = new Date('2026-10-15T11:00:00Z');
function history(category: string, weeks: number[]) { return weeks.map(w => ({ dataHora: new Date(Date.UTC(2026, 9, 15 - 7 * w, 10)), categoria: { id: category, nome: category } })); }
describe('US16: prioridade entre perfis, cota durável e NotificationService', () => {
  const tx = {}; let claims: { user: string; profile: string; key: string; day: Date }[];
  const data = { recipientProfiles: jest.fn(), reminderMovements: jest.fn(), reminderTransaction: jest.fn(), lockReminderUser: jest.fn(), reminderCount: jest.fn(), reminderEvents: jest.fn(), reminderProfile: jest.fn(), reserveReminder: jest.fn() };
  const notify = jest.fn();
  const make = () => new SmartTransactionReminderService(data as unknown as NotificationsRepository, { notify } as unknown as NotificationService, { now: () => new Date(now) } as Clock);
  beforeEach(() => {
    jest.resetAllMocks(); claims = [];
    data.recipientProfiles.mockResolvedValue([{ id: 'p1', usuarioId: 'u' }, { id: 'p2', usuarioId: 'u' }]);
    data.reminderMovements.mockImplementation((profile: string) => Promise.resolve(profile === 'p1'
      ? [...history('a', [1, 2, 3, 4, 5]), ...history('b', [1, 2, 3, 4]), ...history('c', [1, 2, 3]), ...history('d', [3, 4, 5])]
      : history('other-profile', [1, 2, 3, 4, 5, 6])));
    data.reminderTransaction.mockImplementation(fn => fn(tx));
    data.reminderCount.mockImplementation((user, day) => Promise.resolve(claims.filter(c => c.user === user && c.day.getTime() === day.getTime()).length));
    data.reminderEvents.mockImplementation((user, keys) => Promise.resolve(claims.filter(c => c.user === user && keys.includes(c.key)).map(c => ({ chaveEvento: c.key }))));
    data.reminderProfile.mockResolvedValue({ id: 'owned' });
    data.reserveReminder.mockImplementation((user, profile, key, day) => { claims.push({ user, profile, key, day }); return Promise.resolve({}); });
    notify.mockResolvedValue({ accepted: 2, failed: 0 });
  });
  it('top 3 global por usuário, não três por perfil; payload neutro e perfil correto', async () => {
    expect(await make().run()).toEqual({ candidates: 5, reserved: 3, acceptedEvents: 3 });
    expect(notify.mock.calls.map(c => c[1].categoriaId)).toEqual(['other-profile', 'a', 'b']);
    expect(notify.mock.calls[0]).toEqual(['u', expect.objectContaining({ type: 'TRANSACTION_REMINDER', profileId: 'p2', referenceDate: '2026-10-15', title: 'Orca Finance', body: 'Confira se falta registrar alguma movimentação em other-profile.' }), expect.any(String), new Date('2026-10-16Z')]);
    expect(data.lockReminderUser).toHaveBeenCalledWith('u', tx); expect(data.reserveReminder.mock.invocationCallOrder[2]).toBeLessThan(notify.mock.invocationCallOrder[0]);
  });
  it('nova instância do serviço respeita reservas existentes e não envia além da cota', async () => {
    await make().run(); await make().run(); expect(notify).toHaveBeenCalledTimes(3); expect(claims).toHaveLength(3);
  });
  it('cota parcialmente usada admite só as vagas restantes e respeita prioridade', async () => {
    claims.push({ user: 'u', profile: 'p1', key: JSON.stringify(['p1', 'c', '2026-10-15']), day: new Date('2026-10-15Z') });
    expect((await make().run()).reserved).toBe(2);
    expect(notify.mock.calls.map(c => c[1].categoriaId)).toEqual(['other-profile', 'a']); expect(claims).toHaveLength(3);
  });
  it('falha/incerteza de provider não libera reserva para duplicar ou ultrapassar limite', async () => {
    notify.mockResolvedValue({ accepted: 0, failed: 1 });
    expect((await make().run()).acceptedEvents).toBe(0); await make().run(); expect(notify).toHaveBeenCalledTimes(3); expect(claims).toHaveLength(3);
  });
  it('perfil sem dispositivo ativo não é consultado e perfil não pertencente ao usuário não é reservado', async () => {
    data.recipientProfiles.mockResolvedValue([]); expect((await make().run()).reserved).toBe(0); expect(data.reminderMovements).not.toHaveBeenCalled();
    data.recipientProfiles.mockResolvedValue([{ id: 'p1', usuarioId: 'u' }]); data.reminderProfile.mockResolvedValue(null);
    expect((await make().run()).reserved).toBe(0); expect(notify).not.toHaveBeenCalled();
  });
  it('falha de leitura de um perfil não interrompe os outros e consultas recebem limites de data', async () => {
    data.reminderMovements.mockRejectedValueOnce(new Error('private SQL detail'));
    expect((await make().run()).reserved).toBe(1);
    expect(data.reminderMovements).toHaveBeenCalledWith('p2', new Date('2026-08-19Z'), now);
  });
});

describe('US16: scheduler concreto', () => {
  it('Nest registra execução horária UTC com proteção contra sobreposição e delega ao serviço', async () => {
    const run = jest.fn().mockResolvedValue({});
    const module = await Test.createTestingModule({ imports: [ScheduleModule.forRoot()], providers: [SmartTransactionReminderJob,
      { provide: SmartTransactionReminderService, useValue: { run } }] }).compile();
    await module.init();
    try {
      const jobs = [...module.get(SchedulerRegistry).getCronJobs().values()]; expect(jobs).toHaveLength(1);
      expect(jobs[0].cronTime.source).toBe('0 * * * *'); expect(jobs[0].waitForCompletion).toBe(true);
      await jobs[0].fireOnTick(); expect(run).toHaveBeenCalledTimes(1);
    } finally { await module.close(); }
  });
});
