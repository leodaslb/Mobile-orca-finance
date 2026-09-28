import {
    Category,
    Subcategory,
} from '@/types';

export const categoriesMock: Category[] = [
  {
    id: 'category-food',
    name: 'Alimentação',
  },
  {
    id: 'category-transport',
    name: 'Transporte',
  },
  {
    id: 'category-housing',
    name: 'Moradia',
  },
  {
    id: 'category-leisure',
    name: 'Lazer',
  },
  {
    id: 'category-other',
    name: 'Outros',
  },
  {
    id: 'category-income',
    name: 'Renda fixa',
  },
];

export const subcategoriesMock: Subcategory[] = [
  {
    id: 'subcategory-supermarket',
    profileId: 'profile-001',
    categoryId: 'category-food',
    name: 'Supermercado',
  },
];