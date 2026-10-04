import { apiRequest, profilePath } from '@/services/api-client';
import { getTransactionCatalog } from '@/services/category.service';
import { mapTransaction, type ApiTransaction } from '@/services/transaction.service';
import { decimalToCents } from '@/utils/currency';
import { localDate, calendarPeriod } from '@/utils/date';

interface DashboardResponse {
  saldoAtual: string; gastosDoMes: string;
  comparacaoComMesAnterior: { gastosMesAnterior: string; diferenca: string };
  progressoDasMetas: { id: string; nome: string; valorAlvo: string; valorAcumulado: string; percentualProgresso: string }[];
  transacoesRecentes: ApiTransaction[];
}
interface CategoryExpenses { categorias: { categoriaId: string | null; nome: string; valor: string }[] }
function categoryItems(expenses: CategoryExpenses) {
  return expenses.categorias.map(c => ({ categoryId: c.categoriaId ?? 'uncategorized',
    categoryName: c.nome, totalCents: decimalToCents(c.valor) })).sort((a, b) => b.totalCents - a.totalCents);
}
export async function getRemoteCategorySpending(period: string) {
  const { startDate, endDate } = calendarPeriod(period);
  return categoryItems(await apiRequest<CategoryExpenses>(`${profilePath('reports/expenses')}?startDate=${startDate}&endDate=${endDate}`));
}
export async function getRemoteDashboardData(reference = new Date(), includeCategoryExpenses = true) {
  const year = reference.getFullYear(); const month = reference.getMonth() + 1;
  const { startDate, endDate } = calendarPeriod(localDate(reference).slice(0, 7));
  const [summary, expenses, profile, catalog] = await Promise.all([
    apiRequest<DashboardResponse>(`${profilePath('dashboard')}?year=${year}&month=${month}`),
    includeCategoryExpenses
      ? apiRequest<CategoryExpenses>(`${profilePath('reports/expenses')}?startDate=${startDate}&endDate=${endDate}`)
      : Promise.resolve<CategoryExpenses>({ categorias: [] }),
    apiRequest<{ id: string; nome: string; moedaBase: string }>(profilePath('').replace(/\/$/, '')),
    getTransactionCatalog(),
  ]);
  const goal = summary.progressoDasMetas[0];
  return {
    referenceDate: localDate(reference), profile: { id: profile.id, name: profile.nome,
      initials: profile.nome.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() },
    balanceCents: decimalToCents(summary.saldoAtual), currentMonthExpensesCents: decimalToCents(summary.gastosDoMes),
    previousMonthExpensesCents: decimalToCents(summary.comparacaoComMesAnterior.gastosMesAnterior),
    monthComparisonCents: decimalToCents(summary.comparacaoComMesAnterior.diferenca),
    expensesByCategory: categoryItems(expenses),
    goal: goal ? { id: goal.id, name: goal.nome, targetCents: decimalToCents(goal.valorAlvo),
      currentCents: decimalToCents(goal.valorAcumulado), progress: Number(goal.percentualProgresso) / 100 } : null,
    recentTransactions: summary.transacoesRecentes.map(item => mapTransaction(item, catalog)),
  };
}
