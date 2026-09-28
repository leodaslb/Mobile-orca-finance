import { Transaction } from '@/types';

export const transactionsMock: Transaction[] = [
  // SETEMBRO 2026

  {
    id: 'tx-001',
    profileId: 'profile-001',

    type: 'expense',
    amountCents: 18700,

    date: '2026-09-13',
    time: '14:32',

    description: 'Supermercado Extra',

    categoryId: 'category-food',
    subcategoryId: 'subcategory-supermarket',

    paymentMethod: 'debit_card',

    tags: ['mercado'],
    notes: null,

    essentiality: 'essential',

    receiptUri: 'mock://receipt/tx-001',

    status: 'effective',
  },

  {
    id: 'tx-002',
    profileId: 'profile-001',

    type: 'expense',
    amountCents: 12000,

    date: '2026-09-13',
    time: '10:20',

    description: 'Combustível',

    categoryId: 'category-transport',
    subcategoryId: null,

    paymentMethod: 'credit_card',

    tags: [],
    notes: null,

    essentiality: 'essential',

    receiptUri: null,

    status: 'effective',
  },

  {
    id: 'tx-003',
    profileId: 'profile-001',

    type: 'income',
    amountCents: 250000,

    date: '2026-09-01',
    time: '08:00',

    description: 'Salário',

    categoryId: 'category-income',
    subcategoryId: null,

    paymentMethod: null,

    tags: [],
    notes: null,

    essentiality: null,

    receiptUri: null,

    status: 'effective',
  },

  {
    id: 'tx-004',
    profileId: 'profile-001',

    type: 'expense',
    amountCents: 17300,

    date: '2026-09-10',
    time: '12:15',

    description: 'Restaurante',

    categoryId: 'category-food',
    subcategoryId: null,

    paymentMethod: 'credit_card',

    tags: [],
    notes: null,

    essentiality: 'non_essential',

    receiptUri: null,

    status: 'effective',
  },

  {
    id: 'tx-005',
    profileId: 'profile-001',

    type: 'expense',
    amountCents: 28000,

    date: '2026-09-05',
    time: '09:00',

    description: 'Conta de moradia',

    categoryId: 'category-housing',
    subcategoryId: null,

    paymentMethod: 'pix',

    tags: [],
    notes: null,

    essentiality: 'essential',

    receiptUri: null,

    status: 'effective',
  },

  {
    id: 'tx-006',
    profileId: 'profile-001',

    type: 'expense',
    amountCents: 11000,

    date: '2026-09-08',
    time: '18:20',

    description: 'Transporte por aplicativo',

    categoryId: 'category-transport',
    subcategoryId: null,

    paymentMethod: 'credit_card',

    tags: [],
    notes: null,

    essentiality: 'essential',

    receiptUri: null,

    status: 'effective',
  },

  {
    id: 'tx-007',
    profileId: 'profile-001',

    type: 'expense',
    amountCents: 8000,

    date: '2026-09-06',
    time: '20:00',

    description: 'Cinema',

    categoryId: 'category-leisure',
    subcategoryId: null,

    paymentMethod: 'credit_card',

    tags: [],
    notes: null,

    essentiality: 'non_essential',

    receiptUri: null,

    status: 'effective',
  },

  {
    id: 'tx-008',
    profileId: 'profile-001',

    type: 'expense',
    amountCents: 11000,

    date: '2026-09-03',
    time: '08:00',

    description: 'Streaming',

    categoryId: 'category-leisure',
    subcategoryId: null,

    paymentMethod: 'credit_card',

    tags: [],
    notes: null,

    essentiality: 'non_essential',

    receiptUri: null,

    status: 'effective',
  },

  {
    id: 'tx-009',
    profileId: 'profile-001',

    type: 'expense',
    amountCents: 12000,

    date: '2026-09-02',
    time: '16:00',

    description: 'Outros gastos',

    categoryId: 'category-other',
    subcategoryId: null,

    paymentMethod: 'debit_card',

    tags: [],
    notes: null,

    essentiality: 'unclassified',

    receiptUri: null,

    status: 'effective',
  },

  // AGOSTO 2026

  {
    id: 'tx-010',
    profileId: 'profile-001',

    type: 'income',
    amountCents: 250000,

    date: '2026-08-01',
    time: '08:00',

    description: 'Salário',

    categoryId: 'category-income',
    subcategoryId: null,

    paymentMethod: null,

    tags: [],
    notes: null,

    essentiality: null,

    receiptUri: null,

    status: 'effective',
  },

  {
    id: 'tx-011',
    profileId: 'profile-001',

    type: 'expense',
    amountCents: 60000,

    date: '2026-08-04',
    time: '09:00',

    description: 'Moradia',

    categoryId: 'category-housing',
    subcategoryId: null,

    paymentMethod: 'pix',

    tags: [],
    notes: null,

    essentiality: 'essential',

    receiptUri: null,

    status: 'effective',
  },

  {
    id: 'tx-012',
    profileId: 'profile-001',

    type: 'expense',
    amountCents: 32000,

    date: '2026-08-08',
    time: '13:00',

    description: 'Alimentação',

    categoryId: 'category-food',
    subcategoryId: null,

    paymentMethod: 'debit_card',

    tags: [],
    notes: null,

    essentiality: 'essential',

    receiptUri: null,

    status: 'effective',
  },

  {
    id: 'tx-013',
    profileId: 'profile-001',

    type: 'expense',
    amountCents: 24700,

    date: '2026-08-14',
    time: '10:30',

    description: 'Transporte',

    categoryId: 'category-transport',
    subcategoryId: null,

    paymentMethod: 'credit_card',

    tags: [],
    notes: null,

    essentiality: 'essential',

    receiptUri: null,

    status: 'effective',
  },

  {
    id: 'tx-014',
    profileId: 'profile-001',

    type: 'expense',
    amountCents: 20000,

    date: '2026-08-20',
    time: '19:00',

    description: 'Lazer',

    categoryId: 'category-leisure',
    subcategoryId: null,

    paymentMethod: 'credit_card',

    tags: [],
    notes: null,

    essentiality: 'non_essential',

    receiptUri: null,

    status: 'effective',
  },
];