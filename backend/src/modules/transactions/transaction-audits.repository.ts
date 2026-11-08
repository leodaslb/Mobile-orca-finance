import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TransactionAuditsRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(perfilId: string, filters: Omit<Prisma.AuditoriaTransacaoWhereInput, 'perfilId'>) {
    return this.prisma.auditoriaTransacao.findMany({ where: { ...filters, perfilId },
      orderBy: [{ realizadoEm: 'desc' }, { id: 'desc' }] });
  }

  find(perfilId: string, id: string) {
    return this.prisma.auditoriaTransacao.findFirst({ where: { perfilId, id } });
  }
}
