import {
  categoriesMock,
  subcategoriesMock,
} from '@/data/mocks/categories.mock';
import { mockScenario } from '@/data/mocks/scenario.mock';
import type { Subcategory } from '@/types';

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function createSubcategoryId(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'personalizada';
  const baseId = `subcategory-${slug}`;
  if (!subcategoriesMock.some((item) => item.id === baseId)) return baseId;
  let suffix = 2;
  while (subcategoriesMock.some((item) => item.id === `${baseId}-${suffix}`)) suffix += 1;
  return `${baseId}-${suffix}`;
}

export function getCategoriesWithSubcategories() {
  return categoriesMock.map((category) => ({
    ...category,
    subcategories: getSubcategoriesByCategory(category.id),
  }));
}

export function getSubcategoriesByCategory(categoryId: string) {
  return subcategoriesMock
    .filter((subcategory) => subcategory.categoryId === categoryId &&
      subcategory.profileId === mockScenario.activeProfileId)
    .map((subcategory) => ({ ...subcategory }));
}

export function createSubcategory(input: { categoryId: string; name: string }): Subcategory {
  if (!categoriesMock.some((category) => category.id === input.categoryId)) {
    throw new Error('Categoria principal inválida.');
  }
  const name = normalizeName(input.name);
  if (!name) throw new Error('Informe o nome da subcategoria.');
  const duplicate = subcategoriesMock.some((subcategory) =>
    subcategory.profileId === mockScenario.activeProfileId &&
    subcategory.categoryId === input.categoryId &&
    subcategory.name.localeCompare(name, 'pt-BR', { sensitivity: 'base' }) === 0);
  if (duplicate) throw new Error('Esta subcategoria já existe.');

  const subcategory: Subcategory = {
    id: createSubcategoryId(name),
    profileId: mockScenario.activeProfileId,
    categoryId: input.categoryId,
    name,
  };
  subcategoriesMock.push(subcategory);
  return { ...subcategory };
}
