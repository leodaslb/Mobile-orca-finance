import {
  freeSpendingAllowancesMock,
  monthlyBudgetsMock,
  spendingLimitsMock,
} from '@/data/mocks/budgets.mock';
import { categoriesMock } from '@/data/mocks/categories.mock';
import { mockScenario } from '@/data/mocks/scenario.mock';
import { transactionsMock } from '@/data/mocks/transactions.mock';
import type { SpendingLimitsConfiguration } from '@/types';
import { processRecurrences } from '@/services/recurrence.service';

export type BudgetVisualStatus = 'normal' | 'warning' | 'exceeded';

const additionalLimitsByProfile = new Map<string, SpendingLimitsConfiguration>();

export function getBudgetVisualStatus(progress: number): BudgetVisualStatus {
  if (progress > 1) return 'exceeded';
  if (progress >= 0.75) return 'warning';
  return 'normal';
}

function parsePeriodKey(periodKey: string) {
  const match = periodKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error('Período de planejamento inválido.');
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function getAvailablePlanningPeriods() {
  return [...new Set([mockScenario.referenceDate.slice(0, 7), ...monthlyBudgetsMock
    .filter((budget) => budget.profileId === mockScenario.activeProfileId)
    .map((budget) => `${budget.year}-${String(budget.month).padStart(2, '0')}`)])]
    .sort((a, b) => b.localeCompare(a));
}

export function getMonthlyPlanningData(
  periodKey = mockScenario.referenceDate.slice(0, 7),
) {
  processRecurrences();
  const { year, month } = parsePeriodKey(periodKey);
  const monthKey = periodKey;
  const budgets = monthlyBudgetsMock.filter((budget) =>
    budget.profileId === mockScenario.activeProfileId && budget.year === year && budget.month === month);
  const expenses = transactionsMock.filter((transaction) =>
    transaction.profileId === mockScenario.activeProfileId && transaction.status === 'effective' &&
    transaction.type === 'expense' && transaction.date.startsWith(monthKey));
  const categories = budgets.map((budget) => {
    const spentCents = expenses.filter((transaction) => transaction.categoryId === budget.categoryId)
      .reduce((total, transaction) => total + transaction.amountCents, 0);
    const progress = budget.limitCents === 0 ? 0 : spentCents / budget.limitCents;
    return {
      categoryId: budget.categoryId,
      categoryName: categoriesMock.find((category) => category.id === budget.categoryId)?.name ?? 'Sem categoria',
      limitCents: budget.limitCents,
      spentCents,
      progress,
      status: getBudgetVisualStatus(progress),
    };
  });
  const totalBudgetCents = categories.reduce((total, item) => total + item.limitCents, 0);
  // RF08/RF55: o total mensal também inclui despesas sem orçamento/categoria.
  const totalSpentCents = expenses.reduce((total, item) => total + item.amountCents, 0);
  const progress = totalBudgetCents === 0 ? 0 : totalSpentCents / totalBudgetCents;
  return {
    periodKey,
    referenceDate: periodKey === mockScenario.referenceDate.slice(0, 7)
      ? mockScenario.referenceDate
      : `${periodKey}-01`,
    totalBudgetCents,
    totalSpentCents,
    availableCents: totalBudgetCents - totalSpentCents,
    progress,
    status: getBudgetVisualStatus(progress),
    categories,
  };
}

export function getPlannedVsActualData(
  periodKey = mockScenario.referenceDate.slice(0, 7),
) {
  const planning = getMonthlyPlanningData(periodKey);
  const categories = planning.categories.map((category) => ({
    ...category,
    differenceCents: category.spentCents - category.limitCents,
  }));
  return {
    ...planning,
    differenceCents: planning.totalBudgetCents - planning.totalSpentCents,
    categories,
    largestDeviation: [...categories]
      .sort((a, b) => Math.abs(b.differenceCents) - Math.abs(a.differenceCents))[0] ?? null,
  };
}

export function getFreeSpendingAllowance(
  periodKey = mockScenario.referenceDate.slice(0, 7),
) {
  processRecurrences();
  const { year, month } = parsePeriodKey(periodKey);
  const allowance = freeSpendingAllowancesMock.find((item) =>
    item.profileId === mockScenario.activeProfileId &&
    item.year === year && item.month === month);
  const usedCents = transactionsMock.filter((transaction) =>
    transaction.profileId === mockScenario.activeProfileId &&
    transaction.type === 'expense' && transaction.status === 'effective' &&
    transaction.freeSpending === true && transaction.date.startsWith(periodKey))
    .reduce((total, transaction) => total + transaction.amountCents, 0);
  return {
    periodKey,
    limitCents: allowance?.limitCents ?? 0,
    usedCents,
    remainingCents: (allowance?.limitCents ?? 0) - usedCents,
  };
}

export function saveFreeSpendingAllowance(
  limitCents: number,
  periodKey = mockScenario.referenceDate.slice(0, 7),
) {
  if (!Number.isSafeInteger(limitCents) || limitCents <= 0) {
    throw new Error('Informe uma cota mensal válida.');
  }
  const { year, month } = parsePeriodKey(periodKey);
  let allowance = freeSpendingAllowancesMock.find((item) =>
    item.profileId === mockScenario.activeProfileId &&
    item.year === year && item.month === month);
  if (!allowance) {
    allowance = {
      id: `free-spending-${mockScenario.activeProfileId}-${periodKey}`,
      profileId: mockScenario.activeProfileId,
      year,
      month,
      limitCents,
    };
    freeSpendingAllowancesMock.push(allowance);
  } else {
    allowance.limitCents = limitCents;
  }
  return getFreeSpendingAllowance(periodKey);
}

export function getDailySpendingData() {
  processRecurrences();
  const configuration = getSpendingLimitsConfiguration();
  const spentCents = transactionsMock.filter((transaction) =>
    transaction.profileId === mockScenario.activeProfileId && transaction.status === 'effective' &&
    transaction.type === 'expense' && transaction.date === mockScenario.referenceDate)
    .reduce((total, transaction) => total + transaction.amountCents, 0);
  return { date: mockScenario.referenceDate, spentCents,
    limitCents: configuration.dailyLimitCents, enabled: configuration.dailyEnabled };
}

export function getSpendingLimitsConfiguration(): SpendingLimitsConfiguration {
  const profileId = mockScenario.activeProfileId;
  const configuration = profileId === spendingLimitsMock.profileId
    ? spendingLimitsMock
    : additionalLimitsByProfile.get(profileId) ?? {
      profileId,
      dailyEnabled: false,
      dailyLimitCents: 0,
      categoryLimits: [],
      pushEnabled: false,
      emailEnabled: false,
    };
  return { ...configuration,
    categoryLimits: configuration.categoryLimits.map((item) => ({ ...item })) };
}

export function saveSpendingLimitsConfiguration(
  configuration: SpendingLimitsConfiguration,
): SpendingLimitsConfiguration {
  if (configuration.profileId !== mockScenario.activeProfileId) {
    throw new Error('Perfil da configuração de limites inválido.');
  }
  if (configuration.dailyEnabled &&
    (!Number.isSafeInteger(configuration.dailyLimitCents) || configuration.dailyLimitCents <= 0)) {
    throw new Error('Informe um limite diário válido.');
  }
  const categoryIds = new Set<string>();
  for (const item of configuration.categoryLimits) {
    if (!categoriesMock.some((category) => category.id === item.categoryId)) {
      throw new Error('Categoria de limite inválida.');
    }
    if (categoryIds.has(item.categoryId)) {
      throw new Error('Há limites duplicados para a mesma categoria.');
    }
    if (!Number.isSafeInteger(item.limitCents) || item.limitCents <= 0) {
      throw new Error('Informe valores válidos para os limites por categoria.');
    }
    categoryIds.add(item.categoryId);
  }
  if (configuration.profileId !== spendingLimitsMock.profileId) {
    additionalLimitsByProfile.set(configuration.profileId, {
      ...configuration,
      categoryLimits: configuration.categoryLimits.map((item) => ({ ...item })),
    });
  } else {
    spendingLimitsMock.dailyEnabled = configuration.dailyEnabled;
    spendingLimitsMock.dailyLimitCents = configuration.dailyLimitCents;
    spendingLimitsMock.pushEnabled = configuration.pushEnabled;
    spendingLimitsMock.emailEnabled = configuration.emailEnabled;
    spendingLimitsMock.categoryLimits.splice(0, spendingLimitsMock.categoryLimits.length,
      ...configuration.categoryLimits.map((item) => ({ ...item })));
  }
  return getSpendingLimitsConfiguration();
}
