import type { ReceiptFile } from './receipt';

export type TransactionType =
  | 'income'
  | 'expense';

export type TransactionStatus =
  | 'effective'
  | 'scheduled';

export type Essentiality =
  | 'essential'
  | 'non_essential'
  | 'unclassified';

export type PaymentMethod =
  | 'cash'
  | 'debit_card'
  | 'credit_card'
  | 'pix'
  | 'bank_transfer'
  | 'other';

export interface RecurrenceConfiguration {
  recurring: boolean;
  frequency: 'weekly' | 'monthly' | 'yearly';
  nextOccurrence: string | null;
  endDate?: string | null;
  description?: string;
  amountCents?: number;
  reminder: boolean;
  dueDate: string | null;
  reminderTime?: string | null;
}

export interface Transaction {
  id: string;
  profileId: string;

  type: TransactionType;
  amountCents: number;

  date: string;
  time: string;

  description: string;

  categoryId: string | null;
  subcategoryId: string | null;

  paymentMethod: PaymentMethod | null;

  tags: string[];
  notes: string | null;

  essentiality: Essentiality | null;

  receiptUri: string | null;

  freeSpending?: boolean;
  recurrenceId?: string | null;

  status: TransactionStatus;
}

export interface CreateTransactionInput {
  type: TransactionType;
  amountCents: number;

  date: string;
  time: string;

  description: string;

  categoryId: string | null;
  subcategoryId?: string | null;

  paymentMethod?: PaymentMethod | null;

  tags?: string[];
  notes?: string | null;

  essentiality?: Essentiality | null;

  receiptUri?: string | null;
  receiptFile?: ReceiptFile | null;
  freeSpending?: boolean;
}
