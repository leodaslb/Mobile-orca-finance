import { apiRequest, ApiError, profilePath } from '@/services/api-client';
import { decimalToCents } from '@/utils/currency';
import { calendarPeriod, localDate } from '@/utils/date';
export type ReportWindowMonths = 1 | 3 | 6;
interface ExpenseReport { periodo: { startDate: string; endDate: string }; totalGasto: string; categorias: { categoriaId: string | null; nome: string; valor: string; percentualDoTotal: string }[] }
export async function getReportData(endMonth = localDate().slice(0, 7), windowMonths: ReportWindowMonths = 1) {
  const { startDate, endDate } = calendarPeriod(endMonth, windowMonths);
  const row = await apiRequest<ExpenseReport>(`${profilePath('reports/expenses')}?${new URLSearchParams({ startDate, endDate })}`);
  return { ...row.periodo, endMonth, windowMonths, totalCents: decimalToCents(row.totalGasto), categories: row.categorias.map(c => ({
    categoryId: c.categoriaId ?? 'uncategorized', categoryName: c.nome ?? 'Sem categoria', amountCents: decimalToCents(c.valor),
    percentage: Number(c.percentualDoTotal) / 100 })).sort((a, b) => b.amountCents - a.amountCents) };
}
export async function generateFinancialExport(format: 'csv' | 'excel', endMonth: string, windowMonths: ReportWindowMonths) {
  const { startDate, endDate } = calendarPeriod(endMonth, windowMonths);
  const apiFormat = format === 'excel' ? 'xlsx' : 'csv';
  const result = await apiRequest<{ bytes: Uint8Array; contentType: string }>(`${profilePath('exports/transactions')}?${new URLSearchParams({ format: apiFormat, startDate, endDate })}`, { responseType: 'file' });
  if (!result.bytes.length || (apiFormat === 'xlsx' ? !result.contentType.includes('spreadsheetml') || result.bytes[0] !== 80 || result.bytes[1] !== 75 : !result.contentType.includes('text/csv'))) throw new ApiError(0, 'Não foi possível preparar o arquivo. Tente novamente.');
  return { ...result, fileName: `orca-finance-${startDate}-${endDate}.${apiFormat}` };
}
