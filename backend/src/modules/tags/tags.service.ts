import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma, Tag } from '../../generated/prisma/client';
import { ProfilesService } from '../profiles/profiles.service';
import { TagsRepository } from './tags.repository';

@Injectable()
export class TagsService {
  constructor(private readonly tags: TagsRepository, private readonly profiles: ProfilesService) {}

  private present(tag: Tag) {
    return { id: tag.id, perfilId: tag.perfilId, nome: tag.nome, createdAt: tag.createdAt.toISOString() };
  }

  async list(userId: string, perfilId: string) {
    await this.profiles.assertOwnership(userId, perfilId);
    return (await this.tags.listByProfile(perfilId)).map((tag) => this.present(tag));
  }

  async create(userId: string, perfilId: string, nome: string) {
    await this.profiles.assertOwnership(userId, perfilId);
    if (!nome.trim()) throw new BadRequestException('Nome da tag obrigatório.');
    try {
      return this.present(await this.tags.create(perfilId, nome));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Tag já cadastrada neste perfil.');
      }
      throw error;
    }
  }
}
