import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}
  register(user: string, token: string, platform: string) {
    return this.prisma.$transaction(async tx => {
      // Todos os registros do mesmo token são serializados, inclusive entre usuários.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${token}, 0))`;
      const existing = await tx.dispositivoPush.findFirst({ where: { token }, orderBy: { createdAt: 'asc' } });
      if (existing && existing.usuarioId !== user) return null;
      return existing ? tx.dispositivoPush.update({ where: { id: existing.id }, data: { ativo: true, plataforma: platform } })
        : tx.dispositivoPush.create({ data: { usuarioId: user, token, plataforma: platform } });
    });
  }
  find(id: string) { return this.prisma.dispositivoPush.findUnique({ where: { id } }); }
  deactivate(user: string, id: string) { return this.prisma.dispositivoPush.updateMany({ where: { id, usuarioId: user }, data: { ativo: false } }); }
  activeDevices(user: string) { return this.prisma.dispositivoPush.findMany({ where: { usuarioId: user, ativo: true }, orderBy: { id: 'asc' } }); }
  async recipientProfiles() {
    return this.prisma.perfilFinanceiro.findMany({ where: { usuario: { dispositivosPush: { some: { ativo: true } } } }, select: { id: true, usuarioId: true }, orderBy: { id: 'asc' } });
  }
  weeklyExpenses(profile: string, start: Date, end: Date) {
    return this.prisma.transacao.findMany({ where: { perfilId: profile, tipo: 'DESPESA', status: 'EFETIVADA', dataHora: { gte: start, lt: end } },
      select: { id: true, descricao: true, valor: true, categoriaId: true }, orderBy: [{ valor: 'desc' }, { id: 'asc' }], take: 5 });
  }
  reminderMovements(profile: string, start: Date, now: Date) {
    return this.prisma.transacao.findMany({ where: { perfilId: profile, status: 'EFETIVADA', categoriaId: { not: null }, dataHora: { gte: start, lte: now } },
      select: { dataHora: true, categoria: { select: { id: true, nome: true } } }, orderBy: [{ dataHora: 'asc' }, { id: 'asc' }] });
  }
  reminderTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(operation, { maxWait: 10000, timeout: 15000 });
  }
  async lockReminderUser(user: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM usuario WHERE id = ${user}::uuid FOR UPDATE`;
  }
  reminderCount(user: string, day: Date, tx: Prisma.TransactionClient) {
    return tx.reservaLembreteTransacao.count({ where: { usuarioId: user, diaEnvio: day } });
  }
  reminderEvents(user: string, keys: string[], tx: Prisma.TransactionClient) {
    return tx.reservaLembreteTransacao.findMany({ where: { usuarioId: user, chaveEvento: { in: keys } }, select: { chaveEvento: true } });
  }
  reminderProfile(user: string, profile: string, tx: Prisma.TransactionClient) {
    return tx.perfilFinanceiro.findFirst({ where: { id: profile, usuarioId: user }, select: { id: true } });
  }
  reserveReminder(user: string, profile: string, key: string, day: Date, tx: Prisma.TransactionClient) {
    return tx.reservaLembreteTransacao.create({ data: { usuarioId: user, perfilId: profile, chaveEvento: key, diaEnvio: day } });
  }
}
