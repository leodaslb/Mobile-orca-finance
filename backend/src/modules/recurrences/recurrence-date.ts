import { FrequenciaRecorrencia } from '../../generated/prisma/client';

export function nextOccurrence(reference: Date, frequency: FrequenciaRecorrencia) {
  const next = new Date(reference);
  if (frequency === 'SEMANAL') next.setUTCDate(next.getUTCDate() + 7);
  else {
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + (frequency === 'MENSAL' ? 1 : 12));
    const last = new Date(next);
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    next.setUTCDate(Math.min(day, last.getUTCDate()));
  }
  return next;
}

export function withinEnd(reference: Date, end: Date | null) {
  return !end || reference.toISOString().slice(0, 10) <= end.toISOString().slice(0, 10);
}
