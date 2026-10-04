import { apiRequest, ApiError, profilePath } from '@/services/api-client';
import { centsToDecimal, decimalToCents } from '@/utils/currency';
import { calendarPeriod, localDate } from '@/utils/date';

export type BudgetVisualStatus = 'normal' | 'warning' | 'exceeded' | null;
interface Metrics { valorPlanejado: string; valorRealizado: string; desvio: string; percentualConsumido: string | null; estado: 'NORMAL' | 'PROXIMO_LIMITE' | 'EXCEDIDO' | null }
interface MonthlyBudget { id: string; perfilId: string; ano: number; mes: number; categorias: (Metrics & { categoria: { id: string; nome: string } })[]; totais: Metrics; inicio: string; fimExclusivo: string }
function metrics(row: Metrics) {
  return { limitCents: decimalToCents(row.valorPlanejado), spentCents: decimalToCents(row.valorRealizado),
    differenceCents: decimalToCents(row.desvio), progress: row.percentualConsumido === null ? 0 : Number(row.percentualConsumido) / 100,
    percentage: row.percentualConsumido, status: ({ NORMAL: 'normal', PROXIMO_LIMITE: 'warning', EXCEDIDO: 'exceeded' } as const)[row.estado!] ?? null };
}
export async function getMonthlyPlanningData(periodKey = localDate().slice(0, 7)) {
  const { year, month } = calendarPeriod(periodKey);
  let row: MonthlyBudget;
  try { row = await apiRequest<MonthlyBudget>(profilePath(`budgets/monthly/${year}/${month}`)); }
  catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  const totals = metrics(row.totais);
  return { id: row.id, profileId: row.perfilId, periodKey, referenceDate: `${periodKey}-01`,
    totalBudgetCents: totals.limitCents, totalSpentCents: totals.spentCents,
    differenceCents: totals.differenceCents, progress: totals.progress, percentage: totals.percentage, status: totals.status,
    categories: row.categorias.map(c => ({ categoryId: c.categoria.id, categoryName: c.categoria.nome, ...metrics(c) })) };
}
export const getPlannedVsActualData = getMonthlyPlanningData;
export async function saveMonthlyBudget(periodKey: string, categories: { categoryId: string; limitCents: number }[]) {
  const { year, month } = calendarPeriod(periodKey);
  return apiRequest(profilePath(`budgets/monthly/${year}/${month}`), { method: 'PUT',
    body: { categorias: categories.map(c => ({ categoriaId: c.categoryId, valorPlanejado: centsToDecimal(c.limitCents) })) } });
}
interface Quota { id: string; perfilId: string; ano: number; mes: number; valorLimite: string; valorConsumido: string; valorRestante: string }
export async function getFreeSpendingAllowance(periodKey = localDate().slice(0, 7)) {
  const { year, month } = calendarPeriod(periodKey);
  try {
    const row = await apiRequest<Quota>(profilePath(`free-spending-quota/${year}/${month}`));
    return { id: row.id, profileId: row.perfilId, periodKey, limitCents: decimalToCents(row.valorLimite), usedCents: decimalToCents(row.valorConsumido), remainingCents: decimalToCents(row.valorRestante) };
  } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
}
export async function saveFreeSpendingAllowance(limitCents: number, periodKey = localDate().slice(0, 7)) {
  const { year, month } = calendarPeriod(periodKey);
  return apiRequest<Quota>(profilePath(`free-spending-quota/${year}/${month}`), { method: 'PUT', body: { valorLimite: centsToDecimal(limitCents) } });
}
export type RulePeriod = 'DIARIO' | 'SEMANAL' | 'MENSAL' | 'ANUAL';
export type RuleChannel = 'PUSH' | 'EMAIL';
export interface SpendingRule { id: string; perfilId: string; tipo: 'LIMITE_DIARIO' | 'LIMITE_CATEGORIA' | 'PERCENTUAL_RENDA'; periodo: RulePeriod; categoriaId: string | null; ativa: boolean; valorLimite: string | null; valorConsumido: string; percentualConsumido: string | null; limiteAtingido: boolean; alertaAtivo: boolean; canais: RuleChannel[]; inicio: string; fimExclusivo: string }
export interface SpendingRuleInput { tipo: 'LIMITE_DIARIO' | 'LIMITE_CATEGORIA'; categoriaId: string | null; limitCents: number; periodo: RulePeriod; canais: RuleChannel[]; ativa: boolean }
export function getSpendingRules() { return apiRequest<SpendingRule[]>(profilePath('spending-rules')); }
export function saveSpendingRule(input: SpendingRuleInput, id?: string) {
  return apiRequest<SpendingRule>(profilePath(`spending-rules${id ? `/${encodeURIComponent(id)}` : ''}`), { method: id ? 'PATCH' : 'POST',
    body: { tipo: input.tipo, categoriaId: input.tipo === 'LIMITE_DIARIO' ? null : input.categoriaId, valorLimite: centsToDecimal(input.limitCents),
      periodo: input.tipo === 'LIMITE_DIARIO' ? 'DIARIO' : input.periodo, canais: input.canais, ativa: input.ativa } });
}
