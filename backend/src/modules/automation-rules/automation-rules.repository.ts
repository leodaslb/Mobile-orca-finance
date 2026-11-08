import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class AutomationRulesRepository {
  constructor(private readonly prisma: PrismaService) {}
  transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) { return this.prisma.$transaction(operation); }
  async lock(profile: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM perfil_financeiro WHERE id = ${profile}::uuid FOR UPDATE`;
  }
  list(perfilId: string, active?: boolean) {
    return this.prisma.regraAutomacao.findMany({ where: { perfilId, ...(active !== undefined && { ativa: active }) }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  }
  find(perfilId: string, id: string, tx: Prisma.TransactionClient = this.prisma) { return tx.regraAutomacao.findFirst({ where: { perfilId, id } }); }
  deactivate(perfilId: string, categoriaId: string | null, subcategoriaId: string | null, atributoAlvo: string, tx: Prisma.TransactionClient, except?: string) {
    return tx.regraAutomacao.updateMany({ where: { perfilId, categoriaId, subcategoriaId, atributoAlvo, ativa: true, ...(except && { id: { not: except } }) }, data: { ativa: false } });
  }
  create(perfilId: string, data: Omit<Prisma.RegraAutomacaoUncheckedCreateInput, 'perfilId'>, tx: Prisma.TransactionClient) { return tx.regraAutomacao.create({ data: { ...data, perfilId } }); }
  update(perfilId: string, id: string, data: Prisma.RegraAutomacaoUncheckedUpdateManyInput, tx: Prisma.TransactionClient) { return tx.regraAutomacao.updateMany({ where: { perfilId, id }, data }); }
  matching(perfilId: string, categoriaId: string | null, subcategoriaId: string | null) {
    const scopes: Prisma.RegraAutomacaoWhereInput[] = [];
    if (categoriaId) scopes.push({ categoriaId, subcategoriaId: null });
    if (subcategoriaId) scopes.push({ subcategoriaId, categoriaId: null });
    return this.prisma.regraAutomacao.findMany({ where: { perfilId, ativa: true, atributoAlvo: 'essencialidade', OR: scopes },
      select: { categoriaId: true, subcategoriaId: true, valorDestino: true } });
  }
}
