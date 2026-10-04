import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class GoalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(perfilId: string, data: Omit<Prisma.MetaUncheckedCreateInput, 'perfilId'>) {
    return this.prisma.meta.create({ data: { ...data, perfilId } });
  }

  list(perfilId: string) {
    return this.prisma.meta.findMany({ where: { perfilId }, orderBy: [{ dataLimite: 'asc' }, { id: 'asc' }] });
  }

  find(perfilId: string, id: string) {
    return this.prisma.meta.findFirst({ where: { perfilId, id } });
  }

  update(perfilId: string, id: string, data: Prisma.MetaUncheckedUpdateManyInput) {
    return this.prisma.meta.updateMany({ where: { perfilId, id }, data });
  }

  accumulated(perfilId: string, ids: string[]) {
    return this.prisma.aporteMeta.groupBy({ by: ['metaId'], where: { metaId: { in: ids }, meta: { perfilId } }, _sum: { valor: true } });
  }

  contribute(perfilId: string, id: string, valor: Prisma.Decimal, dataHora: Date) {
    return this.prisma.aporteMeta.create({ data: { valor, dataHora, meta: { connect: { id, perfilId } } } });
  }

  contributions(perfilId: string, metaId: string) {
    return this.prisma.aporteMeta.findMany({
      where: { metaId, meta: { perfilId } },
      select: { id: true, metaId: true, valor: true, dataHora: true },
      orderBy: [{ dataHora: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}
