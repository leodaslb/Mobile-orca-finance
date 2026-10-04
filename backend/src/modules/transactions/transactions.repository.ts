import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TransactionQueryDto } from './dto/transaction-query.dto';

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(operation);
  }

  create(perfilId: string, data: Omit<Prisma.TransacaoUncheckedCreateInput, 'perfilId'>, tx: Prisma.TransactionClient) {
    return tx.transacao.create({ data: { ...data, perfilId } });
  }

  createAudit(data: Prisma.AuditoriaTransacaoUncheckedCreateInput, tx: Prisma.TransactionClient) {
    return tx.auditoriaTransacao.create({ data });
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

  findByProfileAndId(perfilId: string, id: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.transacao.findFirst({ where: { id, perfilId } });
  }

  async updateByProfileAndId(
    perfilId: string,
    id: string,
    data: Prisma.TransacaoUncheckedUpdateManyInput,
    tx: Prisma.TransactionClient,
  ) {
    const result = await tx.transacao.updateMany({ where: { id, perfilId }, data });
    if (!result.count) return null;
    return this.findByProfileAndId(perfilId, id, tx);
  }

  async lock(perfilId: string, id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM transacao WHERE id = ${id}::uuid AND perfil_id = ${perfilId}::uuid FOR UPDATE`;
  }

  findOccurrence(perfilId: string, recorrenciaId: string, referencia: Date, tx: Prisma.TransactionClient) {
    return tx.transacao.findFirst({ where: { perfilId, recorrenciaId, ocorrenciaReferencia: referencia } });
  }

  findReceipts(perfilId: string, id: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.anexoTransacao.findMany({ where: { transacaoId: id, transacao: { perfilId }, tipo: 'RECIBO' },
      select: { id: true, transacaoId: true, tipo: true, arquivoUrl: true, mimeType: true, createdAt: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  }

  createReceipt(perfilId: string, id: string, arquivoUrl: string, mimeType: string | null, tx: Prisma.TransactionClient) {
    return tx.anexoTransacao.create({ data: { arquivoUrl, mimeType, tipo: 'RECIBO', transacao: { connect: { id, perfilId } } },
      select: { id: true, transacaoId: true, tipo: true, arquivoUrl: true, mimeType: true, createdAt: true } });
  }

  async deleteByProfileAndId(perfilId: string, id: string, tx: Prisma.TransactionClient) {
    return tx.transacao.deleteMany({ where: { id, perfilId } });
  }

  findTags(perfilId: string, id: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.transacaoTag.findMany({
      where: { transacaoId: id, transacao: { perfilId }, tag: { perfilId } },
      select: { tag: { select: { id: true, nome: true } } },
      orderBy: [{ tag: { nome: 'asc' } }, { tagId: 'asc' }],
    });
  }

  async replaceTags(perfilId: string, id: string, tagIds: string[], tx: Prisma.TransactionClient) {
    await tx.transacaoTag.deleteMany({ where: { transacaoId: id, transacao: { perfilId } } });
    if (tagIds.length) {
      await tx.transacaoTag.createMany({ data: tagIds.map((tagId) => ({ transacaoId: id, tagId })) });
    }
  }
}
