import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.usuario.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.usuario.findUnique({ where: { id } });
  }

  createWithFirstProfile(nome: string, email: string, senhaHash: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.usuario.create({ data: { nome, email, senhaHash } });
      const profile = await tx.perfilFinanceiro.create({
        data: { usuarioId: user.id, nome, moedaBase: 'BRL' },
      });
      return { user, profile };
    });
  }
}
