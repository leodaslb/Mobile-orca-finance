import { FrequenciaSugestao, Prisma } from '../../generated/prisma/client';

export function goalMetrics(target: Prisma.Decimal, accumulated: Prisma.Decimal, deadline: Date,
  frequency: FrequenciaSugestao, reference = new Date()) {
  const today = new Date(reference);
  today.setUTCHours(0, 0, 0, 0);
  const days = Math.max(Math.round((deadline.getTime() - today.getTime()) / 86400000) + 1, 0);
  const periods = frequency === 'DIARIA' ? days : Math.ceil(days / 7);
  const remaining = Prisma.Decimal.max(target.minus(accumulated), 0);
  const achieved = accumulated.greaterThanOrEqualTo(target);
  return { valorAcumulado: accumulated.toFixed(2), valorRestante: remaining.toFixed(2),
    percentualProgresso: target.greaterThan(0) ? accumulated.div(target).mul(100).toFixed(2) : null,
    atingida: achieved, vencida: !achieved && days === 0, periodosRestantes: periods,
    sugestaoAtual: achieved ? '0.00' : periods > 0 ? remaining.div(periods).toFixed(2) : null };
}
