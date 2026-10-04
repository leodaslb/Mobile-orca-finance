import { categoriesMock } from '@/data/mocks/categories.mock';
import { mockScenario } from '@/data/mocks/scenario.mock';
import { transactionsMock } from '@/data/mocks/transactions.mock';
import { processRecurrences } from '@/services/recurrence.mock-service';

export type ReportWindowMonths = 1 | 3 | 6;

function monthStart(monthKey: string): Date {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    throw new Error('Período de relatório inválido.');
  }
  return new Date(`${monthKey}-01T00:00:00Z`);
}

export function getAvailableReportMonths(): string[] {
  processRecurrences();
  const referenceMonth = mockScenario.referenceDate.slice(0, 7);
  return [...new Set([
    referenceMonth,
    ...transactionsMock
      .filter((transaction) => transaction.profileId === mockScenario.activeProfileId &&
        transaction.status === 'effective' && transaction.date <= mockScenario.referenceDate)
      .map((transaction) => transaction.date.slice(0, 7)),
  ])].sort((a, b) => b.localeCompare(a));
}

export function getReportData(
  endMonth = mockScenario.referenceDate.slice(0, 7),
  windowMonths: ReportWindowMonths = 1,
) {
  if (![1, 3, 6].includes(windowMonths) || !getAvailableReportMonths().includes(endMonth)) {
    throw new Error('Período de relatório inválido.');
  }
  const start = monthStart(endMonth);
  start.setUTCMonth(start.getUTCMonth() - windowMonths + 1);
  const startDate = start.toISOString().slice(0, 10);
  const end = monthStart(endMonth);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  const endDate = end.toISOString().slice(0, 10);

  const expenses = transactionsMock.filter((transaction) =>
    transaction.profileId === mockScenario.activeProfileId &&
    transaction.type === 'expense' && transaction.status === 'effective' &&
    transaction.date >= startDate && transaction.date <= endDate &&
    transaction.date <= mockScenario.referenceDate);
  const totalCents = expenses.reduce((sum, transaction) => sum + transaction.amountCents, 0);
  const amountByCategory = new Map<string, number>();
  for (const transaction of expenses) {
    const categoryId = transaction.categoryId ?? 'uncategorized';
    amountByCategory.set(categoryId,
      (amountByCategory.get(categoryId) ?? 0) + transaction.amountCents);
  }
  const categories = [...amountByCategory].map(([categoryId, amountCents]) => ({
    categoryId,
    categoryName: categoryId === 'uncategorized' ? 'Sem categoria'
      : categoriesMock.find((category) => category.id === categoryId)?.name ?? 'Sem categoria',
    amountCents,
    percentage: totalCents === 0 ? 0 : amountCents / totalCents,
  })).sort((a, b) => b.amountCents - a.amountCents || a.categoryName.localeCompare(b.categoryName));

  return { startDate, endDate, endMonth, windowMonths, totalCents, categories };
}

export function generateFinancialExport(
  format: 'csv' | 'excel',
  endMonth = mockScenario.referenceDate.slice(0, 7),
  windowMonths: ReportWindowMonths = 1,
) {
  const period = getReportData(endMonth, windowMonths);
  const delimiter = format === 'csv' ? ',' : '\t';
  const rows = transactionsMock.filter((transaction) =>
    transaction.profileId === mockScenario.activeProfileId &&
    transaction.status === 'effective' && transaction.date <= mockScenario.referenceDate &&
    transaction.date >= period.startDate && transaction.date <= period.endDate)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const cell = (value: string | number) => {
    const text = typeof value === 'string' && /^[=+\-@]/.test(value.trimStart())
      ? `'${value}` : String(value);
    return format === 'csv' ? `"${text.replace(/"/g, '""')}"` : text.replace(/[\t\r\n]/g, ' ');
  };
  const header = ['Data', 'Hora', 'Tipo', 'Descrição', 'Categoria', 'Valor (centavos)'];
  const lines = [header.map(cell).join(delimiter), ...rows.map((transaction) => [
    transaction.date,
    transaction.time,
    transaction.type === 'expense' ? 'Despesa' : 'Receita',
    transaction.description,
    categoriesMock.find((category) => category.id === transaction.categoryId)?.name ?? 'Sem categoria',
    transaction.type === 'expense' ? -transaction.amountCents : transaction.amountCents,
  ].map(cell).join(delimiter))];
  return {
    fileName: `orca-finance-${period.startDate}-${period.endDate}.${format === 'csv' ? 'csv' : 'tsv'}`,
    mimeType: format === 'csv' ? 'text/csv' : 'text/tab-separated-values',
    content: `${format === 'excel' ? '\uFEFF' : ''}${lines.join('\r\n')}\r\n`,
    rowCount: rows.length,
  };
}
