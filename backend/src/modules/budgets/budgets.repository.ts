import { Injectable } from '@nestjs/common';
import { BaseCalculo, PeriodoRegra, Prisma, TipoRegraGasto } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BudgetQueryDto } from './dto/budget.dto';

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

  listBudgets(perfilId: string, filters: BudgetQueryDto) {
    return this.prisma.orcamento.findMany({ where: { perfilId,
      ...(filters.type && { tipo: filters.type }), ...(filters.active !== undefined && { ativo: filters.active }),
      ...(filters.from && { dataFim: { gte: new Date(`${filters.from}T00:00:00Z`) } }),
      ...(filters.to && { dataInicio: { lte: new Date(`${filters.to}T00:00:00Z`) } }) },
    include: { orcamentoCategorias: { orderBy: { categoriaId: 'asc' } } },
    orderBy: [{ dataInicio: 'desc' }, { id: 'asc' }] });
  }

  findBudget(perfilId: string, id: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.orcamento.findFirst({ where: { perfilId, id },
      include: { orcamentoCategorias: { orderBy: { categoriaId: 'asc' } } } });
  }

  createBudget(perfilId: string, data: Omit<Prisma.OrcamentoUncheckedCreateInput, 'perfilId'>, tx: Prisma.TransactionClient) {
    return tx.orcamento.create({ data: { ...data, perfilId } });
  }

  updateBudget(perfilId: string, id: string, data: Prisma.OrcamentoUncheckedUpdateManyInput, tx: Prisma.TransactionClient) {
    return tx.orcamento.updateMany({ where: { perfilId, id }, data });
  }

  budgetSpending(perfilId: string, range: DateRange, contextualId?: string) {
    return this.prisma.transacao.groupBy({ by: ['categoriaId'], where: { perfilId, tipo: 'DESPESA', status: 'EFETIVADA',
      dataHora: { gte: range.start, lt: range.end },
      ...(contextualId && { transacaoOrcamentos: { some: { orcamentoId: contextualId } } }) }, _sum: { valor: true } });
  }

  async budgetIncome(perfilId: string, range: DateRange, tx: Prisma.TransactionClient = this.prisma) {
    // Decisão do usuário na Parte 1: receitas efetivadas + previstas já materializadas.
    const sum = await tx.transacao.aggregate({ where: { perfilId, tipo: 'RECEITA',
      status: { in: ['EFETIVADA', 'PREVISTA'] }, dataHora: { gte: range.start, lt: range.end } }, _sum: { valor: true } });
    return sum._sum.valor ?? new Prisma.Decimal(0);
  }

  async effectiveIncome(perfilId: string, range: DateRange, tx: Prisma.TransactionClient = this.prisma) {
    const result = await tx.transacao.aggregate({ where: { perfilId, tipo: 'RECEITA', status: 'EFETIVADA',
      dataHora: { gte: range.start, lt: range.end } }, _sum: { valor: true } });
    return result._sum.valor ?? new Prisma.Decimal(0);
  }

  linkedTransactions(perfilId: string, orcamentoId: string) {
    return this.prisma.transacao.findMany({ where: { perfilId, transacaoOrcamentos: { some: { orcamentoId, orcamento: { perfilId } } } },
      select: { id: true, categoriaId: true, tipo: true, valor: true, dataHora: true, status: true },
      orderBy: [{ dataHora: 'asc' }, { id: 'asc' }] });
  }

  findTransaction(perfilId: string, id: string, tx: Prisma.TransactionClient) {
    return tx.transacao.findFirst({ where: { perfilId, id }, select: { id: true } });
  }

  async lockTransaction(perfilId: string, id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM transacao WHERE id = ${id}::uuid AND perfil_id = ${perfilId}::uuid FOR UPDATE`;
  }

  linkTransaction(transacaoId: string, orcamentoId: string, tx: Prisma.TransactionClient) {
    return tx.transacaoOrcamento.upsert({ where: { transacaoId_orcamentoId: { transacaoId, orcamentoId } },
      create: { transacaoId, orcamentoId }, update: {} });
  }

  unlinkTransaction(perfilId: string, transacaoId: string, orcamentoId: string, tx: Prisma.TransactionClient) {
    return tx.transacaoOrcamento.deleteMany({ where: { transacaoId, orcamentoId, transacao: { perfilId }, orcamento: { perfilId } } });
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
    // O orçamento agregado mudou mesmo quando só seus itens foram substituídos.
    await tx.orcamento.update({ where: { id: orcamentoId }, data: { updatedAt: new Date() } });
    await tx.orcamentoCategoria.deleteMany({ where: { orcamentoId } });
    await tx.orcamentoCategoria.createMany({ data: categories.map((category) => ({ orcamentoId, ...category })) });
  }

  categories(ids: string[], tx: Prisma.TransactionClient) {
    return tx.categoria.findMany({ where: { id: { in: ids } }, select: { id: true, ativa: true } });
  }

  spentByCategory(perfilId: string, range: DateRange, tx: Prisma.TransactionClient = this.prisma) {
    return tx.transacao.groupBy({
      by: ['categoriaId'], where: { perfilId, tipo: 'DESPESA', status: 'EFETIVADA', dataHora: { gte: range.start, lt: range.end } },
      _sum: { valor: true },
    });
  }

  async spent(perfilId: string, range: DateRange, filters: { categoriaId?: string; ehGastoLivre?: boolean } = {}, tx: Prisma.TransactionClient = this.prisma) {
    const result = await tx.transacao.aggregate({
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

  listRules(perfilId: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.regraGasto.findMany({
      where: { perfilId },
      include: { canais: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  findRule(perfilId: string, id: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.regraGasto.findFirst({ where: { id, perfilId }, include: { canais: true } });
  }

  createRule(perfilId: string, data: { tipo: TipoRegraGasto; periodo: PeriodoRegra; categoriaId: string | null; valorLimite: Prisma.Decimal | null;
    percentualLimite: Prisma.Decimal | null; baseCalculo: BaseCalculo | null; ativa: boolean }, tx: Prisma.TransactionClient) {
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
