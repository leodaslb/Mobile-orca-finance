import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class LargePurchasePlansRepository {
  constructor(private readonly prisma: PrismaService) {}
  list(perfilId: string) { return this.prisma.planoGrandeCompra.findMany({ where: { perfilId }, orderBy: [{ dataInicio: 'asc' }, { id: 'asc' }] }); }
  find(perfilId: string, id: string, tx: Prisma.TransactionClient = this.prisma) { return tx.planoGrandeCompra.findFirst({ where: { perfilId, id } }); }
  create(perfilId: string, data: Omit<Prisma.PlanoGrandeCompraUncheckedCreateInput, 'perfilId'>) { return this.prisma.planoGrandeCompra.create({ data: { ...data, perfilId } }); }
  update(perfilId: string, id: string, data: Prisma.PlanoGrandeCompraUncheckedUpdateManyInput, tx: Prisma.TransactionClient = this.prisma) { return tx.planoGrandeCompra.updateMany({ where: { perfilId, id }, data }); }
  transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) { return this.prisma.$transaction(operation); }
  async lock(perfilId: string, id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM plano_grande_compra WHERE perfil_id = ${perfilId}::uuid AND id = ${id}::uuid FOR UPDATE`;
  }
}
