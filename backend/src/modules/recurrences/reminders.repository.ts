import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RemindersRepository {
  constructor(private readonly prisma: PrismaService) {}
  create(data: Prisma.LembreteVencimentoUncheckedCreateInput, tx: Prisma.TransactionClient) { return tx.lembreteVencimento.create({ data }); }
  list(perfilId: string) { return this.prisma.lembreteVencimento.findMany({ where: { perfilId }, orderBy: [{ notificarEm: 'asc' }, { id: 'asc' }] }); }
  find(perfilId: string, id: string, tx: Prisma.TransactionClient) { return tx.lembreteVencimento.findFirst({ where: { perfilId, id } }); }
  async lock(perfilId: string, id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM lembrete_vencimento WHERE id = ${id}::uuid AND perfil_id = ${perfilId}::uuid FOR UPDATE`;
  }
  async update(perfilId: string, id: string, data: Prisma.LembreteVencimentoUncheckedUpdateManyInput, tx: Prisma.TransactionClient) {
    await tx.lembreteVencimento.updateMany({ where: { perfilId, id }, data });
    return tx.lembreteVencimento.findFirstOrThrow({ where: { perfilId, id } });
  }
}
