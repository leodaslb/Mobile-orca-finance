import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Subcategoria } from '../../generated/prisma/client';
import { ProfilesService } from '../profiles/profiles.service';
import { CategoriesRepository } from './categories.repository';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categories: CategoriesRepository,
    private readonly profiles: ProfilesService,
  ) {}

  private presentSubcategory(item: Subcategoria) {
    return {
      id: item.id, perfilId: item.perfilId, categoriaId: item.categoriaId,
      nome: item.nome, ativa: item.ativa,
      createdAt: item.createdAt, updatedAt: item.updatedAt,
    };
  }

  async listCategories() {
    return (await this.categories.listCategories()).map((category) => ({
      id: category.id, nome: category.nome, icone: category.icone,
      cor: category.cor, ordem: category.ordem, ativa: category.ativa,
    }));
  }

  async listSubcategories(userId: string, profileId: string) {
    await this.profiles.assertOwnership(userId, profileId);
    return (await this.categories.listSubcategories(profileId))
      .map((item) => this.presentSubcategory(item));
  }

  async createSubcategory(userId: string, profileId: string, categoriaId: string, nome: string) {
    await this.profiles.assertOwnership(userId, profileId);
    const category = await this.categories.findCategory(categoriaId);
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    if (!category.ativa) throw new ConflictException('Categoria inativa.');
    try {
      return this.presentSubcategory(
        await this.categories.createSubcategory(profileId, categoriaId, nome),
      );
    } catch (error) {
      this.throwIfDuplicate(error);
      throw error;
    }
  }

  async updateSubcategory(userId: string, profileId: string, subcategoryId: string, dto: UpdateSubcategoryDto) {
    await this.profiles.assertOwnership(userId, profileId);
    const current = await this.categories.findSubcategory(profileId, subcategoryId);
    if (!current) throw new NotFoundException('Subcategoria não encontrada.');
    const data: { nome?: string; ativa?: boolean } = {};
    if (dto.nome != null) data.nome = dto.nome;
    if (dto.ativa != null) data.ativa = dto.ativa;
    if (!Object.keys(data).length) throw new BadRequestException('Informe nome ou ativa.');
    try {
      return this.presentSubcategory(await this.categories.updateSubcategory(current.id, data));
    } catch (error) {
      this.throwIfDuplicate(error);
      throw error;
    }
  }

  private throwIfDuplicate(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Subcategoria já cadastrada neste perfil e categoria.');
    }
  }
}
