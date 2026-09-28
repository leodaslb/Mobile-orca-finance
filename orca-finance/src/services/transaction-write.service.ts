// Escrita compartilhada por transações e recorrências, sem ciclo entre services.
import { categoriesMock, subcategoriesMock } from '@/data/mocks/categories.mock';
import { mockScenario } from '@/data/mocks/scenario.mock';
import { transactionsMock } from '@/data/mocks/transactions.mock';
import type { CreateTransactionInput, Transaction } from '@/types/transaction';
import { isValidTime } from '@/utils/date';

let nextTransactionNumber = 1;

function createNextTransactionId(): string {
  const highestId = transactionsMock.reduce(
    (highest, transaction) => {
      const match = transaction.id.match(
        /^tx-(\d+)$/,
      );

      if (!match) {
        return highest;
      }

      return Math.max(
        highest,
        Number(match[1]),
      );
    },
    0,
  );

  nextTransactionNumber = Math.max(nextTransactionNumber, highestId + 1);
  return `tx-${String(nextTransactionNumber++).padStart(3, '0')}`;
}

function isValidISODate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateCreateTransactionInput(
  input: CreateTransactionInput,
): void {
  if (input.type !== 'income' && input.type !== 'expense') {
    throw new Error('Tipo de transação inválido.');
  }

  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error('O valor deve ser informado em centavos inteiros positivos.');
  }

  if (!isValidISODate(input.date)) {
    throw new Error('Data da transação inválida.');
  }

  if (!isValidTime(input.time)) {
    throw new Error('Hora da transação inválida.');
  }

  if (!input.description.trim()) {
    throw new Error('Descrição da transação é obrigatória.');
  }

  if (input.categoryId === null && !(input.type === 'expense' && input.freeSpending)) {
    throw new Error('Categoria da transação é obrigatória, exceto para gasto livre.');
  }
  if (input.categoryId !== null && !categoriesMock.some((category) => category.id === input.categoryId)) {
    throw new Error('Categoria da transação inválida.');
  }

  if (input.freeSpending && input.type !== 'expense') {
    throw new Error('Somente despesa pode ser marcada como gasto livre.');
  }

  if (
    input.subcategoryId &&
    !subcategoriesMock.some(
      (subcategory) =>
        subcategory.id === input.subcategoryId &&
        subcategory.categoryId === input.categoryId &&
        subcategory.profileId === mockScenario.activeProfileId,
    )
  ) {
    throw new Error('Subcategoria não pertence à categoria selecionada.');
  }
}

export function createTransactionRecord(
  input: CreateTransactionInput,
): Transaction {
  validateCreateTransactionInput(input);

  const transaction: Transaction = {
    id: createNextTransactionId(),

    profileId:
      mockScenario.activeProfileId,

    type: input.type,

    amountCents: input.amountCents,

    date: input.date,
    time: input.time,

    description: input.description.trim(),

    categoryId: input.categoryId,

    subcategoryId:
      input.subcategoryId ?? null,

    paymentMethod:
      input.paymentMethod ?? null,

    tags: [...(input.tags ?? [])],

    notes:
      input.notes ?? null,

    essentiality:
      input.type === 'expense'
        ? input.essentiality ?? null
        : null,

    receiptUri:
      input.receiptUri ?? null,

    freeSpending: input.type === 'expense' && input.freeSpending === true,

    status:
      input.date >
      mockScenario.referenceDate
        ? 'scheduled'
        : 'effective',
  };

  transactionsMock.push(transaction);

  return { ...transaction, tags: [...transaction.tags] };
}

