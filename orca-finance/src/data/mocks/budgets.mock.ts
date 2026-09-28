import {
  MonthlyCategoryBudget,
  MonthlyFreeSpendingAllowance,
  SpendingLimitsConfiguration,
} from '@/types';

export const monthlyBudgetsMock: MonthlyCategoryBudget[] = [
  {
    id: 'budget-food-2026-09',
    profileId: 'profile-001',
    categoryId: 'category-food',
    year: 2026,
    month: 9,
    limitCents: 90000,
  },

  {
    id: 'budget-transport-2026-09',
    profileId: 'profile-001',
    categoryId: 'category-transport',
    year: 2026,
    month: 9,
    limitCents: 60000,
  },

  {
    id: 'budget-housing-2026-09',
    profileId: 'profile-001',
    categoryId: 'category-housing',
    year: 2026,
    month: 9,
    limitCents: 90000,
  },

  {
    id: 'budget-leisure-2026-09',
    profileId: 'profile-001',
    categoryId: 'category-leisure',
    year: 2026,
    month: 9,
    limitCents: 35000,
  },

  {
    id: 'budget-other-2026-09',
    profileId: 'profile-001',
    categoryId: 'category-other',
    year: 2026,
    month: 9,
    limitCents: 25000,
  },
];

// Cenário visual da tela 07. O período das regras por categoria permanece
// nulo até que a decisão de produto seja formalizada.
export const spendingLimitsMock: SpendingLimitsConfiguration = {
  profileId: 'profile-001',
  dailyEnabled: true,
  dailyLimitCents: 12000,
  categoryLimits: [
    { categoryId: 'category-food', limitCents: 70000, period: null },
    { categoryId: 'category-transport', limitCents: 40000, period: null },
    { categoryId: 'category-leisure', limitCents: 30000, period: null },
  ],
  pushEnabled: true,
  emailEnabled: true,
};

export const freeSpendingAllowancesMock: MonthlyFreeSpendingAllowance[] = [
  {
    id: 'free-spending-2026-09',
    profileId: 'profile-001',
    year: 2026,
    month: 9,
    limitCents: 40000,
  },
];
