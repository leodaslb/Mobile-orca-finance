import { reflectionItemsMock, type ReflectionItem } from '@/data/mocks/reflection.mock';
import { mockScenario } from '@/data/mocks/scenario.mock';
import { createMockTransaction as createTransaction, matchesTransactionDescription } from '@/services/transaction.mock-service';
import { createTransactionWithRecurrence } from '@/services/recurrence.mock-service';
import type { CreateTransactionInput, RecurrenceConfiguration } from '@/types/transaction';

let nextReflectionNumber = 1;

export function placeInReflection(input: CreateTransactionInput, durationHours = 48, now = new Date(), recurrence: RecurrenceConfiguration | null = null) {
  if (input.type !== 'expense' || input.essentiality !== 'non_essential') {
    throw new Error('A reflexão exige despesa explicitamente não essencial.');
  }
  if (!Number.isSafeInteger(durationHours) || durationHours <= 0) {
    throw new Error('Informe uma duração válida em horas.');
  }
  const item: ReflectionItem = {
    id: `reflection-${String(nextReflectionNumber++).padStart(3, '0')}`,
    profileId: mockScenario.activeProfileId,
    transaction: { ...input, tags: [...(input.tags ?? [])] },
    recurrence: recurrence ? { ...recurrence } : null,
    enteredAt: now.toISOString(),
    durationHours,
    releaseAt: new Date(now.getTime() + durationHours * 3600000).toISOString(),
  };
  reflectionItemsMock.push(item);
  return item;
}

export function getReflectionItems(query = '') {
  return reflectionItemsMock.filter((item) => item.profileId === mockScenario.activeProfileId &&
    matchesTransactionDescription(item.transaction.description, query))
    .map((item) => ({ ...item, transaction: { ...item.transaction, tags: [...(item.transaction.tags ?? [])] },
      recurrence: item.recurrence ? { ...item.recurrence } : null }));
}

export function isReflectionReleased(item: ReflectionItem, now = new Date()) {
  return now.getTime() >= Date.parse(item.releaseAt);
}

export function finalizeReflectionItem(id: string, now = new Date()) {
  const index = reflectionItemsMock.findIndex((item) => item.id === id && item.profileId === mockScenario.activeProfileId);
  if (index < 0) throw new Error('Item em reflexão não encontrado.');
  const item = reflectionItemsMock[index];
  if (!isReflectionReleased(item, now)) throw new Error('O período de reflexão ainda não terminou.');
  const created = item.recurrence
    ? createTransactionWithRecurrence(item.transaction, item.recurrence)
    : createTransaction(item.transaction);
  reflectionItemsMock.splice(index, 1);
  return created;
}
