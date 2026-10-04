import type { CreateTransactionInput, RecurrenceConfiguration } from '@/types/transaction';
import { apiRequest, getApiSession, profilePath } from '@/services/api-client';
import { transactionPayload } from '@/services/transaction.service';
import { localDateTimeToISO, timestampToLocal } from '@/utils/date';
import { centsToDecimal, decimalToCents } from '@/utils/currency';

export const recurrenceEnums = { weekly: 'SEMANAL', monthly: 'MENSAL', yearly: 'ANUAL' } as const;
export const recurrenceLabels = { weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' } as const;
export interface RemoteRecurrence { id: string; frequencia: 'SEMANAL' | 'MENSAL' | 'ANUAL'; ativa: boolean; proximaOcorrencia: string; dataTermino: string | null; descricao: string; valor: string }
export interface RemoteReminder { id: string; transacaoId: string | null; recorrenciaId: string | null; notificarEm: string; ativo: boolean }
export function getRemoteRecurrences() { return apiRequest<RemoteRecurrence[]>(profilePath('recurrences')); }
export function getRemoteReminders() { return apiRequest<RemoteReminder[]>(profilePath('reminders')); }
export function recurrenceConfiguration(item: RemoteRecurrence): RecurrenceConfiguration {
  return { recurring: item.ativa, frequency: item.frequencia === 'SEMANAL' ? 'weekly' : item.frequencia === 'ANUAL' ? 'yearly' : 'monthly',
    nextOccurrence: timestampToLocal(item.proximaOcorrencia).date, endDate: item.dataTermino,
    description: item.descricao, amountCents: item.valor === undefined ? undefined : decimalToCents(item.valor), reminder: false, dueDate: null };
}
export function updateRemoteReminder(id: string, input: { active: boolean; date?: string; time?: string }) {
  return apiRequest<RemoteReminder>(profilePath(`reminders/${encodeURIComponent(id)}`), { method: 'PATCH', body: {
    ativo: input.active, ...(input.date && input.time && { notificarEm: localDateTimeToISO(input.date, input.time) }),
  } });
}
export function getRemoteRecurrence(id: string) {
  return apiRequest<RemoteRecurrence>(profilePath(`recurrences/${encodeURIComponent(id)}`));
}
export function updateRemoteRecurrence(original: RemoteRecurrence, configuration: RecurrenceConfiguration) {
  const local = timestampToLocal(original.proximaOcorrencia);
  return apiRequest<RemoteRecurrence>(profilePath(`recurrences/${encodeURIComponent(original.id)}`), {
    method: 'PATCH', body: {
      ativa: configuration.recurring,
      ...(configuration.description !== undefined && configuration.description.trim() !== original.descricao && { descricao: configuration.description.trim() }),
      ...(configuration.amountCents !== undefined && centsToDecimal(configuration.amountCents) !== original.valor && { valor: centsToDecimal(configuration.amountCents) }),
      ...(recurrenceEnums[configuration.frequency] !== original.frequencia && { frequencia: recurrenceEnums[configuration.frequency] }),
      ...(configuration.endDate !== undefined && configuration.endDate !== original.dataTermino && { dataTermino: configuration.endDate }),
      ...(configuration.recurring && configuration.nextOccurrence && configuration.nextOccurrence !== local.date && {
        proximaOcorrencia: localDateTimeToISO(configuration.nextOccurrence, local.time),
      }),
    },
  });
}
export async function configureRemoteRecurrence(transactionId: string, input: CreateTransactionInput,
  config: RecurrenceConfiguration, profileId: string) {
  let recurrence: RemoteRecurrence | undefined;
  if (config.recurring) {
    if (!config.nextOccurrence) throw new Error('Informe a próxima ocorrência.');
    const payload = transactionPayload(input);
    recurrence = await apiRequest<RemoteRecurrence>(profilePath('recurrences', profileId), { method: 'POST', body: {
      tipoTransacao: payload.tipo, valor: payload.valor, descricao: payload.descricao,
      categoriaId: payload.categoriaId, subcategoriaId: payload.subcategoriaId, metodoPagamento: payload.metodoPagamento,
      frequencia: recurrenceEnums[config.frequency], proximaOcorrencia: localDateTimeToISO(config.nextOccurrence, input.time), dataTermino: config.endDate ?? null,
    } });
  }
  if (config.reminder) {
    if (!config.dueDate || !config.reminderTime) throw new Error('Informe data e horário do lembrete.');
    await apiRequest(profilePath('reminders', profileId), { method: 'POST', body: {
      ...(recurrence ? { recorrenciaId: recurrence.id } : { transacaoId: transactionId }),
      notificarEm: localDateTimeToISO(config.dueDate, config.reminderTime),
    } });
  }
  return recurrence;
}
