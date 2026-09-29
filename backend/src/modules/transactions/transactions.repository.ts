import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TransactionQueryDto } from './dto/transaction-query.dto';

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(perfilId: string, data: Omit<Prisma.TransacaoUncheckedCreateInput, 'perfilId'>) {
    return this.prisma.transacao.create({ data: { ...data, perfilId } });
  }

  findManyByProfile(perfilId: string, filters: TransactionQueryDto) {
    const where: Prisma.TransacaoWhereInput = { perfilId };
    if (filters.dataInicial || filters.dataFinal) {
      where.dataHora = {
        ...(filters.dataInicial && { gte: new Date(filters.dataInicial) }),
        ...(filters.dataFinal && { lte: new Date(filters.dataFinal) }),
      };
    }
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.categoriaId) where.categoriaId = filters.categoriaId;
    if (filters.metodoPagamento) where.metodoPagamento = filters.metodoPagamento;
    if (filters.status) where.status = filters.status;
    if (filters.descricao) where.descricao = { contains: filters.descricao, mode: 'insensitive' };
    if (filters.valor) where.valor = new Prisma.Decimal(filters.valor);
    return this.prisma.transacao.findMany({
      where,
      orderBy: [{ dataHora: 'desc' }, { id: 'desc' }],
    });
  }

  findByProfileAndId(perfilId: string, id: string) {
    return this.prisma.transacao.findFirst({ where: { id, perfilId } });
  }

  async updateByProfileAndId(
    perfilId: string,
    id: string,
    data: Prisma.TransacaoUncheckedUpdateManyInput,
  ) {
    const result = await this.prisma.transacao.updateMany({ where: { id, perfilId }, data });
    if (!result.count) return null;
    return this.findByProfileAndId(perfilId, id);
  }
}
