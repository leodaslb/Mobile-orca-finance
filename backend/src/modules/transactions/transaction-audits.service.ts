import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaTransacao, Prisma } from '../../generated/prisma/client';
import { ProfilesService } from '../profiles/profiles.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { TransactionAuditsRepository } from './transaction-audits.repository';

// RF23 → US04 → RN-AUD-01 / RN-TRANS-03.
@Injectable()
export class TransactionAuditsService {
  constructor(private readonly audits: TransactionAuditsRepository, private readonly profiles: ProfilesService) {}

  private present(item: AuditoriaTransacao) {
    return { id: item.id, transacaoId: item.transacaoId, perfilId: item.perfilId, operacao: item.operacao,
      estadoAnterior: item.estadoAnterior, estadoNovo: item.estadoNovo, realizadoEm: item.realizadoEm.toISOString() };
  }

  async list(user: string, profile: string, dto: AuditQueryDto) {
    await this.profiles.assertOwnership(user, profile);
    const from = dto.from ? new Date(dto.from) : undefined;
    const to = dto.to ? new Date(dto.to) : undefined;
    const end = to && dto.to?.length === 10 ? new Date(to.getTime() + 86400000) : to;
    if (from && end && (dto.to?.length === 10 ? from >= end : from > end)) {
      throw new BadRequestException('Intervalo de auditoria inválido.');
    }
    const where: Prisma.AuditoriaTransacaoWhereInput = {};
    if (dto.operation) where.operacao = dto.operation;
    if (from || to) {
      // Datas puras incluem o último dia inteiro em UTC. Instantes usam limite inclusivo.
      where.realizadoEm = { ...(from && { gte: from }),
        ...(end && (dto.to?.length === 10 ? { lt: end } : { lte: end })) };
    }
    if (dto.transactionId) {
      const id = dto.transactionId.toLowerCase();
      // SET NULL remove a FK após exclusão; o ID persistido nos snapshots mantém o filtro útil.
      where.OR = [{ transacaoId: id }, { estadoAnterior: { path: ['id'], equals: id } },
        { estadoNovo: { path: ['id'], equals: id } }];
    }
    return (await this.audits.list(profile, where)).map((item) => this.present(item));
  }

  async detail(user: string, profile: string, id: string) {
    await this.profiles.assertOwnership(user, profile);
    const item = await this.audits.find(profile, id);
    if (!item) throw new NotFoundException('Auditoria não encontrada.');
    return this.present(item);
  }
}
