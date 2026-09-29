import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listCategories() {
    return this.prisma.categoria.findMany({
      where: { ativa: true }, orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });
  }

  findCategory(id: string) {
    return this.prisma.categoria.findUnique({ where: { id } });
  }

  listSubcategories(profileId: string) {
    return this.prisma.subcategoria.findMany({
      where: { perfilId: profileId }, orderBy: [{ categoriaId: 'asc' }, { nome: 'asc' }],
    });
  }

  findSubcategory(profileId: string, id: string) {
    return this.prisma.subcategoria.findFirst({ where: { id, perfilId: profileId } });
  }

  createSubcategory(profileId: string, categoriaId: string, nome: string) {
    return this.prisma.subcategoria.create({
      data: { perfilId: profileId, categoriaId, nome },
    });
  }

  updateSubcategory(id: string, data: { nome?: string; ativa?: boolean }) {
    return this.prisma.subcategoria.update({ where: { id }, data });
  }
}
