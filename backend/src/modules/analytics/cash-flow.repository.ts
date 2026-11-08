import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DateRange } from '../budgets/budgets.repository';

@Injectable()
export class CashFlowRepository {
  constructor(private readonly prisma: PrismaService) {}
  inputs(perfilId: string, range: DateRange) {
    return this.prisma.$transaction([
      this.prisma.transacao.findMany({ where: { perfilId, status: 'PREVISTA', dataHora: { gte: range.start, lt: range.end } },
        select: { id: true, tipo: true, valor: true, descricao: true, dataHora: true, categoriaId: true, recorrenciaId: true } }),
      this.prisma.recorrencia.findMany({ where: { perfilId, ativa: true, proximaOcorrencia: { lt: range.end } },
        select: { id: true, tipoTransacao: true, valor: true, descricao: true, categoriaId: true, frequencia: true, proximaOcorrencia: true, dataTermino: true } }),
      this.prisma.transacao.findMany({ where: { perfilId, recorrenciaId: { not: null }, ocorrenciaReferencia: { gte: range.start, lt: range.end } },
        select: { recorrenciaId: true, ocorrenciaReferencia: true } }),
    ], { isolationLevel: 'RepeatableRead' });
  }
}
