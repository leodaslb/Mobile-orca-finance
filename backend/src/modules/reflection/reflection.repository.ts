import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReflectionRepository {
  constructor(private readonly prisma: PrismaService) {}
  create(perfilId: string, descricao: string, entradaEm: Date, duracaoHoras: number) {
    return this.prisma.itemReflexao.create({ data: { perfilId, descricao, entradaEm, duracaoHoras } });
  }
  list(perfilId: string) {
    return this.prisma.itemReflexao.findMany({ where: { perfilId }, orderBy: [{ entradaEm: 'desc' }, { id: 'desc' }] });
  }
  find(perfilId: string, id: string, tx: Prisma.TransactionClient = this.prisma) { return tx.itemReflexao.findFirst({ where: { perfilId, id } }); }
  transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) { return this.prisma.$transaction(operation); }
  async lock(perfilId: string, id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM item_reflexao WHERE id = ${id}::uuid AND perfil_id = ${perfilId}::uuid FOR UPDATE`;
  }
  async remove(perfilId: string, id: string, tx: Prisma.TransactionClient) {
    return tx.itemReflexao.deleteMany({ where: { perfilId, id } });
  }
  update(perfilId: string, id: string, data: { descricao?: string; duracaoHoras?: number }) {
    return this.prisma.itemReflexao.updateMany({ where: { perfilId, id }, data });
  }
}
