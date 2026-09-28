import type { Transaction } from '@/types/transaction';

export interface TransactionAuditRecord {
  id: string;
  profileId: string;
  operation: 'reversal';
  happenedAt: string;
  snapshot: Transaction;
}

export const transactionAuditMock: TransactionAuditRecord[] = [];
