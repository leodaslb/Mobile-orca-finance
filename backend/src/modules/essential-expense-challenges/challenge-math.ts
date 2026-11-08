import { Prisma } from '../../generated/prisma/client';

// RF65 → US59 → RN-DES-02. Comparações usam Decimal sem arredondar percentuais.
export function challengeProposal(planned: Prisma.Decimal, realized: Prisma.Decimal) {
  if (!planned.greaterThan(0) || !realized.greaterThan(planned)) return null;
  const excess = realized.minus(planned);
  const overspend = excess.div(planned).mul(100);
  if (overspend.lessThan(5)) return null;
  const needed = excess.div(realized).mul(100);
  const suggested = Prisma.Decimal.min(needed, 20);
  // Evita erro de retorno ao orçamento por arredondar 16,666…% prematuramente.
  const target = needed.lessThanOrEqualTo(20) ? planned : realized.mul('0.8').toDecimalPlaces(2);
  return { planned, realized, excess, overspend, needed, suggested, target };
}

export function challengeProgress(reference: Prisma.Decimal, target: Prisma.Decimal, spent: Prisma.Decimal, end: Date, now: Date) {
  const endExclusive = new Date(end.getTime() + 86400000);
  return { valorReferencia: reference.toFixed(2), valorMeta: target.toFixed(2), valorGastoAtual: spent.toFixed(2),
    valorDisponivelAteMeta: target.minus(spent).toFixed(2),
    percentualPeriodoConsumido: spent.div(target).mul(100).toDecimalPlaces(4).toNumber(),
    status: now < endExclusive ? 'EM_ANDAMENTO' : spent.lessThanOrEqualTo(target) ? 'CONCLUIDO' : 'NAO_ATINGIDO' };
}

export function rankChallengeCandidates<T extends { categoriaId: string; overspend: Prisma.Decimal; excess: Prisma.Decimal }>(candidates: T[]) {
  return [...candidates].sort((a, b) => b.overspend.comparedTo(a.overspend) || b.excess.comparedTo(a.excess) || a.categoriaId.localeCompare(b.categoriaId)).slice(0, 3);
}
