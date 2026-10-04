import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DateRange } from '../budgets/budgets.repository';

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  expensesByCategory(perfilId: string, range: DateRange) {
    return this.prisma.transacao.groupBy({ by: ['categoriaId'],
      where: { perfilId, tipo: 'DESPESA', status: 'EFETIVADA', dataHora: { gte: range.start, lt: range.end } }, _sum: { valor: true } });
  }

  categories(ids: string[]) {
    return this.prisma.categoria.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } });
  }

  totals(perfilId: string) {
    return this.prisma.transacao.groupBy({ by: ['tipo'], where: { perfilId, status: 'EFETIVADA' }, _sum: { valor: true } });
  }

  expenseTotal(perfilId: string, range: DateRange) {
    return this.prisma.transacao.aggregate({ where: { perfilId, tipo: 'DESPESA', status: 'EFETIVADA',
      dataHora: { gte: range.start, lt: range.end } }, _sum: { valor: true } });
  }

  recent(perfilId: string) {
    return this.prisma.transacao.findMany({ where: { perfilId }, take: 5, orderBy: [{ dataHora: 'desc' }, { id: 'desc' }],
      select: { id: true, tipo: true, descricao: true, valor: true, dataHora: true, status: true, categoriaId: true } });
  }

  exportTransactions(perfilId: string, range?: DateRange) {
    return this.prisma.transacao.findMany({ where: { perfilId, ...(range && { dataHora: { gte: range.start, lt: range.end } }) },
      orderBy: [{ dataHora: 'asc' }, { id: 'asc' }],
      select: { dataHora: true, tipo: true, descricao: true, valor: true, metodoPagamento: true, essencialidade: true,
        status: true, ehGastoLivre: true, anotacao: true,
        categoria: { select: { nome: true } }, subcategoria: { select: { nome: true, perfilId: true } },
        transacaoTags: { where: { tag: { perfilId } }, select: { tag: { select: { nome: true } } }, orderBy: { tag: { nome: 'asc' } } } } });
  }
}
