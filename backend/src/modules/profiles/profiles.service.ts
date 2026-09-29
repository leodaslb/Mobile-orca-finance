import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PerfilFinanceiro } from '../../generated/prisma/client';
import { ProfilesRepository } from './profiles.repository';

@Injectable()
export class ProfilesService {
  constructor(private readonly profiles: ProfilesRepository) {}

  private present(profile: PerfilFinanceiro) {
    return {
      id: profile.id, nome: profile.nome, moedaBase: profile.moedaBase,
      createdAt: profile.createdAt, updatedAt: profile.updatedAt,
    };
  }

  async assertOwnership(userId: string, profileId: string): Promise<PerfilFinanceiro> {
    const profile = await this.profiles.findById(profileId);
    if (!profile) throw new NotFoundException('Perfil não encontrado.');
    if (profile.usuarioId !== userId) throw new ForbiddenException('Sem acesso ao perfil.');
    return profile;
  }

  async list(userId: string) {
    return (await this.profiles.listByUser(userId)).map((profile) => this.present(profile));
  }

  async create(userId: string, nome: string) {
    return this.present(await this.profiles.create(userId, nome));
  }

  async get(userId: string, profileId: string) {
    return this.present(await this.assertOwnership(userId, profileId));
  }

  async rename(userId: string, profileId: string, nome: string) {
    await this.assertOwnership(userId, profileId);
    return this.present(await this.profiles.rename(profileId, nome));
  }
}
