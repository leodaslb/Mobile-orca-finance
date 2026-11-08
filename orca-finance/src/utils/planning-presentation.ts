import type { BudgetType } from '@/services/budget.service';

export const budgetTypeLabels: Record<BudgetType, string> = {
  MENSAL: 'Mensal', PERIODO: 'Por período', TEMPORARIO: 'Temporário', EVENTO: 'Evento', ZERO_BASED: 'Orçamento zero',
};

// DATE de calendário: formatar sem converter para o fuso do aparelho.
export const displayDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value;
