import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RecurrencesRepository {
  constructor(private readonly prisma: PrismaService) {}
  transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) { return this.prisma.$transaction(operation, { timeout: 15000 }); }
  async lock(profile: string, id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM recorrencia WHERE id = ${id}::uuid AND perfil_id = ${profile}::uuid FOR UPDATE`;
  }
  create(data: Prisma.RecorrenciaUncheckedCreateInput, tx: Prisma.TransactionClient) { return tx.recorrencia.create({ data }); }
  find(perfilId: string, id: string, tx: Prisma.TransactionClient = this.prisma) { return tx.recorrencia.findFirst({ where: { perfilId, id } }); }
  list(perfilId: string) { return this.prisma.recorrencia.findMany({ where: { perfilId }, orderBy: [{ proximaOcorrencia: 'asc' }, { id: 'asc' }] }); }
  async update(perfilId: string, id: string, data: Prisma.RecorrenciaUncheckedUpdateManyInput, tx: Prisma.TransactionClient) {
    await tx.recorrencia.updateMany({ where: { perfilId, id }, data });
    return tx.recorrencia.findFirstOrThrow({ where: { perfilId, id } });
  }
  due(now: Date, perfilId?: string) {
    return this.prisma.recorrencia.findMany({ where: { ativa: true, proximaOcorrencia: { lte: now }, ...(perfilId && { perfilId }) }, select: { id: true, perfilId: true } });
  }
  future(perfilId: string, recorrenciaId: string, now: Date, tx: Prisma.TransactionClient) {
    return tx.transacao.findMany({ where: { perfilId, recorrenciaId, status: 'PREVISTA', ocorrenciaReferencia: { gt: now } }, select: { id: true, ocorrenciaReferencia: true } });
  }
  findTransaction(perfilId: string, id: string, tx: Prisma.TransactionClient) { return tx.transacao.findFirst({ where: { perfilId, id }, select: { id: true } }); }
}
