import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ImportRowDto } from './import.dto';

@Injectable()
export class ImportsRepository {
  constructor(private readonly prisma: PrismaService) {}
  categories() { return this.prisma.categoria.findMany({ where: { ativa: true }, select: { id: true, nome: true } }); }
  duplicate(profile: string, row: ImportRowDto, tx: Prisma.TransactionClient = this.prisma) {
    return tx.transacao.findFirst({ where: { perfilId: profile, tipo: row.tipo, valor: new Prisma.Decimal(row.valor),
      dataHora: new Date(row.dataHora), descricao: { equals: row.descricao.trim(), mode: 'insensitive' } }, select: { id: true } });
  }
  transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(operation, { maxWait: 10000, timeout: 60000 });
  }
  async lockProfile(profile: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM perfil_financeiro WHERE id = ${profile}::uuid FOR UPDATE`;
  }
}
