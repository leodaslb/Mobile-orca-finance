import { categoriesMock, subcategoriesMock } from '@/data/mocks/categories.mock';
import { mockScenario } from '@/data/mocks/scenario.mock';
import { transactionsMock } from '@/data/mocks/transactions.mock';
import { transactionAuditMock } from '@/data/mocks/audit.mock';

import type { CreateTransactionInput, Transaction, } from '@/types/transaction';
import { formatTransactionDate } from '@/utils/date';
import { getSubcategoriesByCategory } from '@/services/category.service';
import { createTransactionRecord } from '@/services/transaction-write.service';
import { processRecurrences } from '@/services/recurrence.service';

export type TransactionRead = Transaction & {
  categoryName: string;
  subcategoryName: string | null;
};

function enrichTransaction(transaction: Transaction): TransactionRead {
  const category = categoriesMock.find((item) => item.id === transaction.categoryId);
  const subcategory = subcategoriesMock.find((item) =>
    item.id === transaction.subcategoryId &&
    item.categoryId === transaction.categoryId &&
    item.profileId === transaction.profileId
  );
  return {
    ...transaction,
    tags: [...transaction.tags],
    categoryName: category?.name ?? 'Sem categoria',
    subcategoryName: subcategory?.name ?? null,
  };
}

// TXR-07: estratégia técnica provisória, substituível após decisão de produto.
export function matchesTransactionDescription(description: string, query: string): boolean {
  const normalize = (value: string) => value.trim().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  return normalize(description).includes(normalize(query));
}

export function getTransactions(query = ''): TransactionRead[] {
  processRecurrences();
  return transactionsMock
    .filter((item) => item.profileId === mockScenario.activeProfileId &&
      matchesTransactionDescription(item.description, query))
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
    .map(enrichTransaction);
}

export function getTransactionById(id: string): TransactionRead | undefined {
  processRecurrences();
  const transaction = transactionsMock.find((item) =>
    item.id === id && item.profileId === mockScenario.activeProfileId);
  return transaction ? enrichTransaction(transaction) : undefined;
}

export function getTransactionDateLabel(date: string, referenceDate: string): string {
  if (date === referenceDate) return 'Hoje';
  const [year, month, day] = referenceDate.split('-').map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  return date === yesterday ? 'Ontem' : formatTransactionDate(date);
}

export function getTransactionSections(query = '') {
  const groups = new Map<string, { date: string; title: string; data: TransactionRead[] }>();
  for (const transaction of getTransactions(query)) {
    let group = groups.get(transaction.date);
    if (!group) {
      group = { date: transaction.date,
        title: getTransactionDateLabel(transaction.date, mockScenario.referenceDate), data: [] };
      groups.set(transaction.date, group);
    }
    group.data.push(transaction);
  }
  return [...groups.values()];
}
export function getTransactionCategories() {
  return categoriesMock.map((category) => ({
    id: category.id,
    name: category.name,
  }));
}


export function getTransactionSubcategories(
  categoryId: string,
) {
  return getSubcategoriesByCategory(categoryId)
    .map((subcategory) => ({
      id: subcategory.id,
      name: subcategory.name,
    }));
}

export function requiresPurchaseReflection(
  input: Pick<CreateTransactionInput, 'type' | 'essentiality'>,
): boolean {
  return input.type === 'expense' && input.essentiality === 'non_essential';
}

export function createTransaction(input: CreateTransactionInput): TransactionRead {
  return enrichTransaction(createTransactionRecord(input));
}

export function reverseTransaction(id: string, now = new Date()) {
  const index = transactionsMock.findIndex((item) =>
    item.id === id && item.profileId === mockScenario.activeProfileId);
  if (index < 0) throw new Error('Transação não encontrada.');
  const transaction = transactionsMock[index];
  transactionAuditMock.push({
    id: `audit-${String(transactionAuditMock.length + 1).padStart(3, '0')}`,
    profileId: transaction.profileId,
    operation: 'reversal',
    happenedAt: now.toISOString(),
    snapshot: { ...transaction, tags: [...transaction.tags] },
  });
  transactionsMock.splice(index, 1);
}

export function getTransactionAuditRecords() {
  return transactionAuditMock.filter((record) => record.profileId === mockScenario.activeProfileId)
    .map((record) => ({ ...record, snapshot: { ...record.snapshot, tags: [...record.snapshot.tags] } }));
}
