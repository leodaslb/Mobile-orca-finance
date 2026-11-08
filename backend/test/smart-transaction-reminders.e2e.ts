import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { Clock } from '../src/common/clock';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { PushProvider } from '../src/modules/notifications/push.provider';
import { NotificationService } from '../src/modules/notifications/notification.service';
import { NotificationsRepository } from '../src/modules/notifications/notifications.repository';
import { SmartTransactionReminderService } from '../src/modules/notifications/smart-transaction-reminder.service';
import { SmartTransactionReminderJob } from '../src/modules/notifications/smart-transaction-reminder.job';

describe('RF09 → US16 → RN-NOT-03: histórico PostgreSQL e push fake', () => {
  let app: NestFastifyApplication; let db: PrismaService; let repo: NotificationsRepository; let secondProfile: string; let cats: string[];
  let now = new Date('2026-10-15T11:00:00Z'); const clock = { now: () => new Date(now) } as Clock;
  const users: string[] = []; const profiles: string[] = []; const auth: string[] = [];
  const emails = [0, 1, 2].map(() => `us16-${randomUUID()}@example.test`);
  const aTokens = [0, 1].map(() => `ExpoPushToken[${randomUUID()}]`); const bToken = `ExpoPushToken[${randomUUID()}]`;
  const push = { send: jest.fn().mockResolvedValue('ACCEPTED') };
  const fresh = () => new SmartTransactionReminderService(repo, new NotificationService(repo, push as unknown as PushProvider, clock), clock);
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(clock).overrideProvider(PushProvider).useValue(push).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter()); app.useLogger(false); configureApp(app);
    await app.init(); await app.getHttpAdapter().getInstance().ready(); db = app.get(PrismaService); repo = app.get(NotificationsRepository);
    cats = (await db.categoria.findMany({ where: { ativa: true }, select: { id: true }, orderBy: { id: 'asc' }, take: 6 })).map(c => c.id); expect(cats).toHaveLength(6);
    for (const email of emails) {
      const registered = await app.inject({ method: 'POST', url: '/auth/register', payload: { nome: 'US16', email, senha: 'senha de teste' } });
      expect(registered.statusCode).toBe(201); users.push(registered.json().user.id); profiles.push(registered.json().profile.id);
      const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha: 'senha de teste' } }); expect(login.statusCode).toBe(201); auth.push(login.json().accessToken);
    }
    const other = await app.inject({ method: 'POST', url: '/profiles', headers: { authorization: `Bearer ${auth[0]}` }, payload: { nome: 'Segundo perfil US16' } }); expect(other.statusCode).toBe(201); secondProfile = other.json().id;
    for (const [user, token, ativo] of [[users[0], aTokens[0], true], [users[0], aTokens[1], true], [users[0], `ExpoPushToken[${randomUUID()}]`, false],
      [users[1], bToken, true], [users[2], `ExpoPushToken[${randomUUID()}]`, false]] as const) {
      await db.dispositivoPush.create({ data: { usuarioId: user, token, plataforma: 'ANDROID', ativo } });
    }
    const rows: Prisma.TransacaoCreateManyInput[] = [];
    const add = (profile: string, category: string, weeks: number[], hour = 10, status: 'EFETIVADA' | 'PREVISTA' = 'EFETIVADA') => {
      for (const week of weeks) rows.push({ perfilId: profile, categoriaId: category, tipo: 'DESPESA', valor: '1', descricao: 'Histórico de teste US16', status,
        dataHora: new Date(Date.UTC(2026, 9, 15 - 7 * week, hour, 15)) });
    };
    add(profiles[0], cats[0], [1, 2, 3, 4, 5]); add(profiles[0], cats[1], [1, 2, 3, 4]); add(profiles[0], cats[2], [1, 2, 3]); add(profiles[0], cats[3], [3, 4, 5]);
    add(profiles[0], cats[4], [...Array<number>(30).fill(1), 2, 9]); // muitos lançamentos, só duas semanas dentro da janela.
    add(profiles[0], cats[5], [1, 2, 3], 10, 'PREVISTA');
    add(secondProfile, cats[0], [1, 2, 3, 4, 5, 6]);
    add(secondProfile, cats[1], [1, 2, 3, 4, 5, 6, 7, 8]); add(secondProfile, cats[1], [0]); // já registrado hoje, não lembra.
    add(secondProfile, cats[2], [1, 2, 3, 4, 5, 6, 7, 8], 18); // faixa ainda aberta/futura às 11h.
    add(profiles[1], cats[0], [1], 8); add(profiles[1], cats[0], [2], 12); add(profiles[1], cats[0], [3], 16); // fallback diário.
    add(profiles[1], cats[1], [1, 2, 3]); add(profiles[1], cats[1], [0], 10, 'PREVISTA'); // prevista não satisfaz.
    add(profiles[2], cats[0], [1, 2, 3, 4, 5, 6, 7, 8]); // usuário sem aparelho ativo.
    rows.find(row => row.perfilId === profiles[1] && row.categoriaId === cats[1] && row.status === 'EFETIVADA')!.tipo = 'RECEITA';
    await db.transacao.createMany({ data: rows });
    // O teste mantém o filtro real de aparelhos ativos e restringe a execução aos seus usuários únicos.
    const original = repo.recipientProfiles.bind(repo);
    jest.spyOn(repo, 'recipientProfiles').mockImplementation(async () => (await original()).filter(p => users.includes(p.usuarioId)));
  }, 90000);
  afterAll(async () => {
    try {
      if (db) {
        const ids = (await db.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } })).map(r => r.id);
        const p = await db.perfilFinanceiro.findMany({ where: { usuarioId: { in: ids } }, select: { id: true } }); const perfilId = { in: p.map(r => r.id) };
        await db.reservaLembreteTransacao.deleteMany({ where: { usuarioId: { in: ids } } }); await db.transacao.deleteMany({ where: { perfilId } });
        await db.dispositivoPush.deleteMany({ where: { usuarioId: { in: ids } } }); await db.perfilFinanceiro.deleteMany({ where: { usuarioId: { in: ids } } });
        await db.usuario.deleteMany({ where: { id: { in: ids } } });
      }
    } finally { await app?.close(); }
  }, 90000);
  it('duas instâncias concorrentes respeitam top 3 global entre perfis e contam evento, não aparelhos', async () => {
    const count = await db.transacao.count({ where: { perfilId: { in: [...profiles, secondProfile] } } });
    const results = await Promise.all([app.get(SmartTransactionReminderService).run(), fresh().run()]);
    expect(results.reduce((n, r) => n + r.reserved, 0)).toBe(4); // três do usuário A e um do B.
    const aCalls = push.send.mock.calls.filter(c => aTokens.includes(c[0])); expect(aCalls).toHaveLength(6);
    const events = new Set(aCalls.map(c => `${c[1].profileId}:${c[1].categoriaId}`));
    expect(events).toEqual(new Set([`${secondProfile}:${cats[0]}`, `${profiles[0]}:${cats[0]}`, `${profiles[0]}:${cats[1]}`]));
    expect(push.send.mock.calls.filter(c => c[0] === bToken)).toHaveLength(1);
    expect(await db.reservaLembreteTransacao.count({ where: { usuarioId: users[0], diaEnvio: new Date('2026-10-15Z') } })).toBe(3);
    expect(await db.reservaLembreteTransacao.count({ where: { usuarioId: users[2] } })).toBe(0);
    expect(await db.transacao.count({ where: { perfilId: { in: [...profiles, secondProfile] } } })).toBe(count);
    for (const [, payload] of push.send.mock.calls) expect(payload).toMatchObject({ type: 'TRANSACTION_REMINDER', title: 'Orca Finance', referenceDate: '2026-10-15', body: expect.stringContaining('Confira se falta registrar') });
  });
  it('reinício lógico e faixa que encerra mais tarde não ultrapassam três no mesmo dia', async () => {
    const before = push.send.mock.calls.length; now = new Date('2026-10-15T19:00:00Z');
    expect((await fresh().run()).reserved).toBe(0); expect(push.send).toHaveBeenCalledTimes(before);
    expect(await db.reservaLembreteTransacao.count({ where: { usuarioId: users[0], diaEnvio: new Date('2026-10-15Z') } })).toBe(3);
  });
  it('no fechamento diário avalia fallback sem horário, com cota nova e sem repetir evento já reservado', async () => {
    const before = push.send.mock.calls.length; now = new Date('2026-10-16T00:00:00Z');
    await app.get(SmartTransactionReminderJob).tick();
    const calls = push.send.mock.calls.slice(before); expect(calls.filter(c => c[0] === bToken)).toHaveLength(1);
    expect(calls.find(c => c[0] === bToken)![1]).toMatchObject({ profileId: profiles[1], categoriaId: cats[0], referenceDate: '2026-10-15' });
    expect(await db.reservaLembreteTransacao.count({ where: { usuarioId: users[0], diaEnvio: new Date('2026-10-16Z') } })).toBe(3);
    const after = push.send.mock.calls.length; await fresh().run(); expect(push.send).toHaveBeenCalledTimes(after);
  });
  it('falha do provider mantém reservas, não expõe erro e não é repetida por nova instância', async () => {
    now = new Date('2026-10-22T11:00:00Z'); push.send.mockRejectedValue(new Error('private-provider-token-secret'));
    const warnings = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      await fresh().run(); const attempts = push.send.mock.calls.length; await fresh().run(); expect(push.send).toHaveBeenCalledTimes(attempts);
      expect(await db.reservaLembreteTransacao.count({ where: { usuarioId: users[0], diaEnvio: new Date('2026-10-22Z') } })).toBe(3);
      expect(warnings.mock.calls.flat().join(' ')).not.toContain('private-provider-token-secret');
    } finally { warnings.mockRestore(); }
  });
});
