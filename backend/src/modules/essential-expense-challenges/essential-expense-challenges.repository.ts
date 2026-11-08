import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DateRange } from '../budgets/budgets.repository';

@Injectable()
export class EssentialExpenseChallengesRepository {
  constructor(private readonly prisma: PrismaService) {}
  transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(operation, { timeout: 15000 });
  }
  async lockProfile(profile: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM perfil_financeiro WHERE id = ${profile}::uuid FOR UPDATE`;
  }
  essentialCategories(profile: string, range: DateRange, tx: Prisma.TransactionClient = this.prisma) {
    return tx.transacao.findMany({ where: { perfilId: profile, tipo: 'DESPESA', status: 'EFETIVADA', essencialidade: 'ESSENCIAL',
      categoriaId: { not: null }, dataHora: { gte: range.start, lt: range.end } }, distinct: ['categoriaId'], select: { categoriaId: true } });
  }
  active(profile: string, today: Date, tx: Prisma.TransactionClient) {
    return tx.desafioEconomia.findFirst({ where: { perfilId: profile, dataFim: { gte: today } }, select: { id: true } });
  }
  create(profile: string, data: Omit<Prisma.DesafioEconomiaUncheckedCreateInput, 'perfilId'>, tx: Prisma.TransactionClient) {
    return tx.desafioEconomia.create({ data: { ...data, perfilId: profile } });
  }
  list(profile: string) {
    return this.prisma.desafioEconomia.findMany({ where: { perfilId: profile, categoriaId: { not: null } },
      include: { categoria: { select: { id: true, nome: true } } }, orderBy: [{ dataInicio: 'desc' }, { id: 'asc' }] });
  }
  find(profile: string, id: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.desafioEconomia.findFirst({ where: { perfilId: profile, id, categoriaId: { not: null } },
      include: { categoria: { select: { id: true, nome: true } } } });
  }
  updateName(profile: string, id: string, nome: string, tx: Prisma.TransactionClient) {
    return tx.desafioEconomia.updateMany({ where: { perfilId: profile, id, categoriaId: { not: null } }, data: { nome } });
  }
  async spending(profile: string, category: string, range: DateRange) {
    const total = await this.prisma.transacao.aggregate({ where: { perfilId: profile, categoriaId: category, tipo: 'DESPESA', status: 'EFETIVADA',
      dataHora: { gte: range.start, lt: range.end } }, _sum: { valor: true } });
    return total._sum.valor ?? new Prisma.Decimal(0);
  }
  history(profile: string, category: string, range: DateRange) {
    return this.prisma.transacao.findMany({ where: { perfilId: profile, categoriaId: category, tipo: 'DESPESA', status: 'EFETIVADA',
      dataHora: { gte: range.start, lt: range.end } }, select: { descricao: true, valor: true }, orderBy: { id: 'asc' } });
  }
}
