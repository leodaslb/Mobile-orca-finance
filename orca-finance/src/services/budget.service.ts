import { apiRequest, profilePath } from './api-client';
import type { ApiTransaction } from './transaction.service';
import { centsToDecimal, decimalToCents } from '@/utils/currency';
export type BudgetType = 'MENSAL' | 'PERIODO' | 'TEMPORARIO' | 'EVENTO' | 'ZERO_BASED';
export interface BudgetInput { nome: string | null; tipo: BudgetType; dataInicio: string; dataFim: string; categorias: { categoriaId: string; valorPlanejado: string }[] }
export interface Budget extends BudgetInput {
  categorias: { categoriaId: string; valorPlanejado: string; valorRealizado: string; percentualConsumido: number | null }[];
  id: string; ativo: boolean; updatedAt: string;
  resumo: { valorPlanejado: string; valorRealizado: string; percentualConsumido: number | null; estado: string | null };
  zeroBased?: { rendaPeriodo: string; totalAlocado: string; diferenca: string; status: string; planejamentoIncompleto: boolean };
  transacoesVinculadas?: { id: string; descricao: string; tipo: string; status: string; dataHora: string; valor: string }[];
}
export interface BudgetFilters { type?: BudgetType; active?: boolean; from?: string; to?: string }
// A listagem não contém categorias/vínculos; esses campos pertencem ao GET de detalhe.
export type BudgetSummary = Omit<Budget, 'categorias' | 'transacoesVinculadas'>;
export function getBudgets(filters: BudgetFilters = {}) {
  const query = new URLSearchParams();
  if (filters.type) query.set('type', filters.type);
  if (filters.active !== undefined) query.set('active', String(filters.active));
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  return apiRequest<BudgetSummary[]>(`${profilePath('budgets')}${query.size ? `?${query}` : ''}`);
}
export const getBudget = (id: string) => apiRequest<Budget>(profilePath(`budgets/${encodeURIComponent(id)}`));
export const setBudgetActive = (id: string, ativo: boolean) => apiRequest<Budget>(profilePath(`budgets/${encodeURIComponent(id)}`), { method: 'PATCH', body: { ativo } });
export function saveBudget(input: BudgetInput, id?: string) {
  const { tipo, ...editable } = input;
  return apiRequest<Budget>(profilePath(`budgets${id ? `/${encodeURIComponent(id)}` : ''}`), { method: id ? 'PATCH' : 'POST', body: id ? editable : { tipo, ...editable } });
}
export const linkBudgetTransaction = (budget: string, transaction: string, linked: boolean) => apiRequest<void>(profilePath(`budgets/${encodeURIComponent(budget)}/transactions/${encodeURIComponent(transaction)}`), { method: linked ? 'PUT' : 'DELETE' });
// Prévia do editor US09. A resposta do budget salvo continua autoritativa.
export async function getRegisteredBudgetIncome(startDate: string, endDate: string) {
  const rows = await apiRequest<ApiTransaction[]>(`${profilePath('transactions')}?${new URLSearchParams({ dataInicial: `${startDate}T00:00:00Z`, dataFinal: `${endDate}T23:59:59.999Z` })}`);
  const cents = rows.filter(r => r.tipo === 'RECEITA' && (r.status === 'EFETIVADA' || r.status === 'PREVISTA')).reduce((sum, r) => sum + decimalToCents(r.valor), 0);
  return centsToDecimal(cents);
}
