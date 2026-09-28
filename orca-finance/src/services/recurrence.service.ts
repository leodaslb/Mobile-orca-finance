import { recurrencesMock, type RecurrenceRule } from '@/data/mocks/recurrences.mock';
import { mockScenario } from '@/data/mocks/scenario.mock';
import { transactionsMock } from '@/data/mocks/transactions.mock';
import { createTransactionRecord as createTransaction } from '@/services/transaction-write.service';
import type { CreateTransactionInput, RecurrenceConfiguration } from '@/types/transaction';

let nextRuleNumber = 1;

function nextMonthlyDate(anchor: string, months: number) {
  const [year, month, day] = anchor.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  // Decisão de produto: dias 29–31 usam o último dia do mês quando necessário.
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay)))
    .toISOString().slice(0, 10);
}

function cloneRule(rule: RecurrenceRule): RecurrenceRule {
  return { ...rule, template: { ...rule.template, tags: [...(rule.template.tags ?? [])] },
    configuration: { ...rule.configuration }, generatedDates: [...rule.generatedDates] };
}

export function saveRecurrence(baseTransactionId: string, input: CreateTransactionInput, configuration: RecurrenceConfiguration) {
  if (!configuration.recurring && !configuration.reminder) return null;
  if (configuration.recurring && (!configuration.nextOccurrence || Number.isNaN(Date.parse(configuration.nextOccurrence)))) {
    throw new Error('Informe a próxima ocorrência.');
  }
  const base = transactionsMock.find((item) => item.id === baseTransactionId && item.profileId === mockScenario.activeProfileId);
  if (!base) throw new Error('Transação base não encontrada.');
  const rule: RecurrenceRule = {
    id: `recurrence-${String(nextRuleNumber++).padStart(3, '0')}`,
    profileId: mockScenario.activeProfileId,
    baseTransactionId,
    template: { ...input, tags: [...(input.tags ?? [])] },
    configuration: { ...configuration },
    generatedDates: configuration.nextOccurrence === base.date ? [base.date] : [],
  };
  base.recurrenceId = rule.id;
  recurrencesMock.push(rule);
  processRecurrences();
  return cloneRule(rule);
}

export function createTransactionWithRecurrence(input: CreateTransactionInput, configuration: RecurrenceConfiguration) {
  if (configuration.recurring && (!configuration.nextOccurrence || Number.isNaN(Date.parse(configuration.nextOccurrence)))) {
    throw new Error('Informe a próxima ocorrência.');
  }
  const created = createTransaction(input);
  saveRecurrence(created.id, input, configuration);
  return created;
}

export function processRecurrences(referenceDate = mockScenario.referenceDate) {
  for (const rule of recurrencesMock) {
    if (rule.profileId !== mockScenario.activeProfileId || !rule.configuration.recurring || !rule.configuration.nextOccurrence) continue;
    for (const transaction of transactionsMock) {
      if (transaction.recurrenceId === rule.id && transaction.date <= referenceDate) transaction.status = 'effective';
    }
    const anchor = rule.configuration.nextOccurrence;
    for (let month = 0; month < 1200; month += 1) {
      const occurrenceDate = nextMonthlyDate(anchor, month);
      if (!rule.generatedDates.includes(occurrenceDate)) {
        const created = createTransaction({ ...rule.template, date: occurrenceDate });
        const stored = transactionsMock.find((item) => item.id === created.id);
        if (stored) {
          stored.recurrenceId = rule.id;
          stored.status = occurrenceDate <= referenceDate ? 'effective' : 'scheduled';
        }
        rule.generatedDates.push(occurrenceDate);
      }
      if (occurrenceDate > referenceDate) break;
    }
  }
}

export function getRecurrenceForTransaction(transactionId: string) {
  const rule = recurrencesMock.find((item) => item.profileId === mockScenario.activeProfileId &&
    (item.baseTransactionId === transactionId || transactionsMock.some((transaction) =>
      transaction.id === transactionId && transaction.recurrenceId === item.id)));
  return rule ? cloneRule(rule) : undefined;
}

export function updateRecurrence(ruleId: string, configuration: RecurrenceConfiguration) {
  const rule = recurrencesMock.find((item) => item.id === ruleId && item.profileId === mockScenario.activeProfileId);
  if (!rule) throw new Error('Recorrência não encontrada.');
  if (configuration.recurring && (!configuration.nextOccurrence || configuration.nextOccurrence <= mockScenario.referenceDate)) {
    throw new Error('A próxima ocorrência deve ser futura.');
  }
  for (let index = transactionsMock.length - 1; index >= 0; index -= 1) {
    const item = transactionsMock[index];
    if (item.recurrenceId === ruleId && item.date > mockScenario.referenceDate && item.id !== rule.baseTransactionId) {
      transactionsMock.splice(index, 1);
    }
  }
  rule.generatedDates = rule.generatedDates.filter((date) => date <= mockScenario.referenceDate);
  rule.configuration = { ...configuration };
  processRecurrences();
  return cloneRule(rule);
}
