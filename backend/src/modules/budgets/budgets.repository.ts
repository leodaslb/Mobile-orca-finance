import { Injectable } from '@nestjs/common';
import { PeriodoRegra, Prisma, TipoRegraGasto } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type DateRange = { start: Date; end: Date };

@Injectable()
export class BudgetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(operation);
  }

  async lockProfile(perfilId: string, tx: Prisma.TransactionClient) {
    // Serializa PUTs sem adicionar uma constraint/migration ao orçamento mensal.
    await tx.$queryRaw`SELECT id FROM perfil_financeiro WHERE id = ${perfilId}::uuid FOR UPDATE`;
  }

  findMonthly(perfilId: string, start: Date, end: Date, tx: Prisma.TransactionClient = this.prisma) {
    return tx.orcamento.findMany({
      where: { perfilId, tipo: 'MENSAL', dataInicio: start, dataFim: end },
      include: { orcamentoCategorias: { include: { categoria: { select: { id: true, nome: true } } }, orderBy: { categoriaId: 'asc' } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  createMonthly(perfilId: string, start: Date, end: Date, tx: Prisma.TransactionClient) {
    return tx.orcamento.create({ data: { perfilId, tipo: 'MENSAL', dataInicio: start, dataFim: end } });
  }

  async replaceCategories(orcamentoId: string, categories: { categoriaId: string; valorPlanejado: Prisma.Decimal }[], tx: Prisma.TransactionClient) {
    await tx.orcamentoCategoria.deleteMany({ where: { orcamentoId } });
    await tx.orcamentoCategoria.createMany({ data: categories.map((category) => ({ orcamentoId, ...category })) });
  }

  categories(ids: string[], tx: Prisma.TransactionClient) {
    return tx.categoria.findMany({ where: { id: { in: ids } }, select: { id: true, ativa: true } });
  }

  spentByCategory(perfilId: string, range: DateRange) {
    return this.prisma.transacao.groupBy({
      by: ['categoriaId'], where: { perfilId, tipo: 'DESPESA', status: 'EFETIVADA', dataHora: { gte: range.start, lt: range.end } },
      _sum: { valor: true },
    });
  }

  async spent(perfilId: string, range: DateRange, filters: { categoriaId?: string; ehGastoLivre?: boolean } = {}) {
    const result = await this.prisma.transacao.aggregate({
      where: { perfilId, tipo: 'DESPESA', status: 'EFETIVADA', dataHora: { gte: range.start, lt: range.end }, ...filters },
      _sum: { valor: true },
    });
    return result._sum.valor ?? new Prisma.Decimal(0);
  }

  quota(perfilId: string, ano: number, mes: number) {
    return this.prisma.cotaGastoLivre.findUnique({ where: { perfilId_ano_mes: { perfilId, ano, mes } } });
  }

  putQuota(perfilId: string, ano: number, mes: number, valorLimite: Prisma.Decimal) {
    return this.prisma.cotaGastoLivre.upsert({
      where: { perfilId_ano_mes: { perfilId, ano, mes } },
      create: { perfilId, ano, mes, valorLimite }, update: { valorLimite },
    });
  }

  listRules(perfilId: string) {
    return this.prisma.regraGasto.findMany({
      where: { perfilId, tipo: { in: [TipoRegraGasto.LIMITE_DIARIO, TipoRegraGasto.LIMITE_CATEGORIA] } },
      include: { canais: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  findRule(perfilId: string, id: string, tx: Prisma.TransactionClient) {
    return tx.regraGasto.findFirst({ where: { id, perfilId, tipo: { in: ['LIMITE_DIARIO', 'LIMITE_CATEGORIA'] } }, include: { canais: true } });
  }

  createRule(perfilId: string, data: { tipo: TipoRegraGasto; periodo: PeriodoRegra; categoriaId: string | null; valorLimite: Prisma.Decimal; ativa: boolean }, tx: Prisma.TransactionClient) {
    return tx.regraGasto.create({ data: { perfilId, ...data } });
  }

  async updateRule(perfilId: string, id: string, data: Prisma.RegraGastoUncheckedUpdateManyInput, tx: Prisma.TransactionClient) {
    await tx.regraGasto.updateMany({ where: { perfilId, id }, data });
  }

  async replaceChannels(id: string, canais: ('PUSH' | 'EMAIL')[], tx: Prisma.TransactionClient) {
    await tx.regraGastoCanal.deleteMany({ where: { regraGastoId: id } });
    await tx.regraGastoCanal.createMany({ data: canais.map((canal) => ({ regraGastoId: id, canal })) });
  }
}
