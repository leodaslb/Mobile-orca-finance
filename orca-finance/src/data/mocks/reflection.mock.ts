import type { CreateTransactionInput, RecurrenceConfiguration } from '@/types/transaction';

export interface ReflectionItem {
  id: string;
  profileId: string;
  transaction: CreateTransactionInput;
  recurrence: RecurrenceConfiguration | null;
  enteredAt: string;
  durationHours: number;
  releaseAt: string;
}

export const reflectionItemsMock: ReflectionItem[] = [];
