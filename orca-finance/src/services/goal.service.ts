import { apiRequest, profilePath } from '@/services/api-client';
import { centsToDecimal, decimalToCents } from '@/utils/currency';
import { localDateTimeToISO } from '@/utils/date';
import type { GoalSuggestionFrequency } from '@/types';
export interface CreateGoalInput { name: string; targetCents: number; deadline: string; suggestionFrequency: GoalSuggestionFrequency }
export interface ApiGoal { id: string; perfilId: string; nome: string; valorAlvo: string; dataLimite: string; frequenciaSugestao: 'DIARIA' | 'SEMANAL'; valorAcumulado: string; valorRestante: string; percentualProgresso: string | null; atingida: boolean; vencida: boolean; periodosRestantes: number; sugestaoAtual: string | null }
export function mapGoal(g: ApiGoal) {
  return { id: g.id, profileId: g.perfilId, name: g.nome, targetCents: decimalToCents(g.valorAlvo), deadline: g.dataLimite,
    suggestionFrequency: g.frequenciaSugestao === 'DIARIA' ? 'daily' as const : 'weekly' as const,
    currentCents: decimalToCents(g.valorAcumulado), remainingCents: decimalToCents(g.valorRestante),
    progress: g.percentualProgresso === null ? 0 : Number(g.percentualProgresso) / 100, isExpired: g.vencida, achieved: g.atingida,
    suggestionCents: g.sugestaoAtual === null ? null : decimalToCents(g.sugestaoAtual) };
}
export async function getGoals() { return (await apiRequest<ApiGoal[]>(profilePath('goals'))).map(mapGoal); }
export async function getGoalById(id: string) { return mapGoal(await apiRequest<ApiGoal>(profilePath(`goals/${encodeURIComponent(id)}`))); }
export async function createGoal(input: CreateGoalInput, id?: string) {
  const row = await apiRequest<ApiGoal>(profilePath(`goals${id ? `/${encodeURIComponent(id)}` : ''}`), { method: id ? 'PATCH' : 'POST',
    body: { nome: input.name.trim(), valorAlvo: centsToDecimal(input.targetCents), dataLimite: input.deadline,
      frequenciaSugestao: input.suggestionFrequency === 'daily' ? 'DIARIA' : 'SEMANAL' } });
  return mapGoal(row);
}
export async function updateGoalDeadline(id: string, deadline: string) {
  return mapGoal(await apiRequest<ApiGoal>(profilePath(`goals/${encodeURIComponent(id)}`), { method: 'PATCH', body: { dataLimite: deadline } }));
}
export function addGoalContribution(input: { goalId: string; amountCents: number; date: string }) {
  return apiRequest<{ id: string; metaId: string; valor: string; dataHora: string }>(profilePath(`goals/${encodeURIComponent(input.goalId)}/contributions`), {
    method: 'POST', body: { valor: centsToDecimal(input.amountCents), dataHora: localDateTimeToISO(input.date, '00:00') } });
}

export async function getGoalContributions(id: string) {
  const items = await apiRequest<{ id: string; metaId: string; valor: string; dataHora: string }[]>(
    profilePath(`goals/${encodeURIComponent(id)}/contributions`));
  return items.map(item => ({ id: item.id, amountCents: decimalToCents(item.valor), timestamp: item.dataHora }));
}

export async function getGoalDetail(id: string) {
  const [goal, contributions] = await Promise.all([getGoalById(id), getGoalContributions(id)]);
  return { goal, contributions };
}
