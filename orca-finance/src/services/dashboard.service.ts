import { categoriesMock } from '@/data/mocks/categories.mock';
import {
  goalContributionsMock,
  goalsMock,
} from '@/data/mocks/goals.mock';
import { profilesMock } from '@/data/mocks/profile.mock';
import { mockScenario } from '@/data/mocks/scenario.mock';
import { transactionsMock } from '@/data/mocks/transactions.mock';
import { Transaction } from '@/types';
import { processRecurrences } from '@/services/recurrence.service';

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function getPreviousMonthKey(date: string) {
  const [year, month] = date.split('-').map(Number);

  const previous = new Date(year, month - 2, 1);

  const previousYear = previous.getFullYear();
  const previousMonth = String(
    previous.getMonth() + 1
  ).padStart(2, '0');

  return `${previousYear}-${previousMonth}`;
}

function compareTransactionsByDateDesc(
  a: Transaction,
  b: Transaction
) {
  const aValue = `${a.date}T${a.time}`;
  const bValue = `${b.date}T${b.time}`;

  return bValue.localeCompare(aValue);
}

export function getDashboardData() {
  processRecurrences();
  const profile = profilesMock.find(
    (item) =>
      item.id === mockScenario.activeProfileId
  );

  if (!profile) {
    throw new Error('Perfil mock não encontrado.');
  }

  const activeTransactions = transactionsMock.filter(
    (transaction) =>
      transaction.profileId === profile.id &&
      transaction.status === 'effective'
  );

  const currentMonthKey = getMonthKey(
    mockScenario.referenceDate
  );

  const previousMonthKey = getPreviousMonthKey(
    mockScenario.referenceDate
  );

  const currentMonthExpensesCents =
    activeTransactions
      .filter(
        (transaction) =>
          transaction.type === 'expense' &&
          getMonthKey(transaction.date) ===
            currentMonthKey
      )
      .reduce(
        (total, transaction) =>
          total + transaction.amountCents,
        0
      );

  const previousMonthExpensesCents =
    activeTransactions
      .filter(
        (transaction) =>
          transaction.type === 'expense' &&
          getMonthKey(transaction.date) ===
            previousMonthKey
      )
      .reduce(
        (total, transaction) =>
          total + transaction.amountCents,
        0
      );

  const balanceCents =
    profile.initialBalanceCents +
    activeTransactions.reduce(
      (total, transaction) => {
        if (transaction.type === 'income') {
          return total + transaction.amountCents;
        }

        return total - transaction.amountCents;
      },
      0
    );

  const expensesByCategory = [...categoriesMock, { id: 'uncategorized', name: 'Sem categoria' }]
    .map((category) => {
      const totalCents = activeTransactions
        .filter(
          (transaction) =>
            transaction.type === 'expense' &&
            (transaction.categoryId ?? 'uncategorized') ===
              category.id &&
            getMonthKey(transaction.date) ===
              currentMonthKey
        )
        .reduce(
          (total, transaction) =>
            total + transaction.amountCents,
          0
        );

      return {
        categoryId: category.id,
        categoryName: category.name,
        totalCents,
      };
    })
    .filter((item) => item.totalCents > 0)
    .sort(
      (a, b) =>
        b.totalCents - a.totalCents
    );

  const goal = goalsMock.find((item) => item.profileId === profile.id);

  const goalCurrentCents = goal
    ? goalContributionsMock
      .filter(
        (contribution) =>
          contribution.goalId === goal.id && contribution.profileId === profile.id
      )
      .reduce(
        (total, contribution) =>
          total + contribution.amountCents,
        0
      ) : 0;

  const recentTransactions =
    [...activeTransactions]
      .sort(compareTransactionsByDateDesc)
      .slice(0, 2)
      .map((transaction) => {
        const category = categoriesMock.find(
          (item) =>
            item.id === transaction.categoryId
        );

        return {
          id: transaction.id,
          categoryId: transaction.categoryId,
          description: transaction.description,
          type: transaction.type,
          amountCents: transaction.amountCents,
          date: transaction.date,
          time: transaction.time,
          categoryName:
            category?.name ?? 'Sem categoria',
        };
      });

  return {
    referenceDate: mockScenario.referenceDate,

    profile,

    balanceCents,

    currentMonthExpensesCents,

    previousMonthExpensesCents,

    monthComparisonCents:
      currentMonthExpensesCents -
      previousMonthExpensesCents,

    expensesByCategory,

    goal: goal ? {
      id: goal.id,
      name: goal.name,
      targetCents: goal.targetCents,
      currentCents: goalCurrentCents,

      progress:
        goal.targetCents === 0
          ? 0
          : goalCurrentCents /
            goal.targetCents,
    } : null,

    recentTransactions,
  };
}
