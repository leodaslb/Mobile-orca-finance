import { apiRequest, profilePath } from './api-client';
import type { ExpenseReport } from './report.service';
import type { ApiTransaction } from './transaction.service';
export interface Metrics { period: { startDate: string; endDate: string }; savingsRate: { value: number | null; calculable: boolean }; averageDailyBalance: string }
export interface Trends { referenceQuarter: { startDate: string; endDate: string }; currentMonth: { startDate: string; asOfDate: string; partial: boolean }; categories: { categoriaId: string | null; categoriaNome: string; referenceMonthlyAverage: string; currentMonthTotal: string; variationPercentage: number | null; trend: 'ESTAVEL' | 'AUMENTANDO' | 'DIMINUINDO' }[] }
export interface Projection { saldoAtual: string; saldoProjetadoFimMes: string; next30Days: { startDate: string; endDate: string; entradasPrevistas: string; saidasPrevistas: string; saldoProjetadoFinal: string; movimentos: { data: string; tipo: 'RECEITA' | 'DESPESA'; valor: string; descricao: string; origem: 'RECORRENCIA' | 'TRANSACAO_PREVISTA' }[] } }
export interface Completion { window: '6m' | '12m'; startDate: string; endDate: string; closedGoals: number; completedGoals: number; completionRate: number | null }
export const getMetrics = (startDate?: string, endDate?: string) => apiRequest<Metrics>(`${profilePath('metrics')}${startDate && endDate ? `?${new URLSearchParams({ startDate, endDate })}` : ''}`);
export const getTrends = () => apiRequest<Trends>(profilePath('analytics/spending-trends'));
export const getProjection = () => apiRequest<Projection>(profilePath('cash-flow/projection'));
export const getCompletion = (window: '6m' | '12m') => apiRequest<Completion>(`${profilePath('goals/completion-rate')}?window=${window}`);
export const getPeriodExpenses = (startDate: string, endDate: string) => apiRequest<ExpenseReport>(`${profilePath('reports/expenses')}?${new URLSearchParams({ startDate, endDate })}`);
export const getPeriodTransactions = (startDate: string, endDate: string) => apiRequest<ApiTransaction[]>(`${profilePath('transactions')}?${new URLSearchParams({ dataInicial: `${startDate}T00:00:00Z`, dataFinal: `${endDate}T23:59:59.999Z` })}`);
