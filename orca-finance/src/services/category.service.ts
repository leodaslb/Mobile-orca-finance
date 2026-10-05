import { apiRequest, profilePath } from '@/services/api-client';

export interface CatalogCategory { id: string; name: string; active: boolean }
export interface CatalogSubcategory { id: string; name: string; categoryId: string; active: boolean }
export async function createRemoteSubcategory(categoryId: string, name: string) {
  const item = await apiRequest<{ id: string; nome: string; categoriaId: string; ativa: boolean }>(profilePath('subcategories'), { method: 'POST', body: { categoriaId: categoryId, nome: name.trim() } });
  return { id: item.id, name: item.nome, categoryId: item.categoriaId, active: item.ativa } satisfies CatalogSubcategory;
}
export async function updateRemoteSubcategory(id: string, input: { name?: string; active?: boolean }) {
  return apiRequest(profilePath(`subcategories/${encodeURIComponent(id)}`), { method: 'PATCH', body: {
    ...(input.name !== undefined && { nome: input.name.trim() }),
    ...(input.active !== undefined && { ativa: input.active }),
  } });
}
export async function getTransactionCatalog(profileId?: string) {
  const [categories, subcategories] = await Promise.all([
    apiRequest<{ id: string; nome: string; ativa: boolean }[]>('/categories'),
    apiRequest<{ id: string; nome: string; categoriaId: string; ativa: boolean }[]>(profilePath('subcategories', profileId)),
  ]);
  return {
    categories: categories.map(c => ({ id: c.id, name: c.nome, active: c.ativa })),
    subcategories: subcategories.map(c => ({ id: c.id, name: c.nome, categoryId: c.categoriaId, active: c.ativa })),
  };
}
