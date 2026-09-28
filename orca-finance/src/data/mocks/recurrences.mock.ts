import type { CreateTransactionInput, RecurrenceConfiguration } from '@/types/transaction';

export interface RecurrenceRule {
  id: string;
  profileId: string;
  baseTransactionId: string;
  template: CreateTransactionInput;
  configuration: RecurrenceConfiguration;
  generatedDates: string[];
}

export const recurrencesMock: RecurrenceRule[] = [];
