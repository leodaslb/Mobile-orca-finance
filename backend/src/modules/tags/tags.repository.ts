import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByProfile(perfilId: string) {
    return this.prisma.tag.findMany({ where: { perfilId }, orderBy: [{ nome: 'asc' }, { id: 'asc' }] });
  }

  create(perfilId: string, nome: string) {
    return this.prisma.tag.create({ data: { perfilId, nome } });
  }

  findByProfileAndIds(perfilId: string, ids: string[], tx: Prisma.TransactionClient) {
    return tx.tag.findMany({ where: { perfilId, id: { in: ids } }, select: { id: true } });
  }
}
