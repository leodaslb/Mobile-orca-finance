import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ProfilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByUser(usuarioId: string) {
    return this.prisma.perfilFinanceiro.findMany({
      where: { usuarioId }, orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.perfilFinanceiro.findUnique({ where: { id } });
  }

  create(usuarioId: string, nome: string) {
    return this.prisma.perfilFinanceiro.create({
      data: { usuarioId, nome, moedaBase: 'BRL' },
    });
  }

  rename(id: string, nome: string) {
    return this.prisma.perfilFinanceiro.update({ where: { id }, data: { nome } });
  }
}
