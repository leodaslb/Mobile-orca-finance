import { Prisma } from '../../generated/prisma/client';

export function budgetMetrics(planejado: Prisma.Decimal, realizado: Prisma.Decimal) {
  const percentual = planejado.greaterThan(0) ? realizado.div(planejado).mul(100) : null;
  return {
    valorPlanejado: planejado.toFixed(2), valorRealizado: realizado.toFixed(2),
    desvio: realizado.minus(planejado).toFixed(2),
    percentualConsumido: percentual?.toFixed(2) ?? null,
    estado: percentual === null ? null : percentual.lessThan(75) ? 'NORMAL'
      : percentual.lessThanOrEqualTo(100) ? 'PROXIMO_LIMITE' : 'EXCEDIDO',
  };
}
