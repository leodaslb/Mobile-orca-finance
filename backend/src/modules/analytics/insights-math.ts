import { Prisma, TipoTransacao } from '../../generated/prisma/client';
import { DateRange } from '../budgets/budgets.repository';

export function signed(value: Prisma.Decimal, type: TipoTransacao) { return type === 'RECEITA' ? value : value.negated(); }

export function dailyAverage(opening: Prisma.Decimal, rows: { dataHora: Date; tipo: TipoTransacao; valor: Prisma.Decimal }[], range: DateRange) {
  const days = (range.end.getTime() - range.start.getTime()) / 86400000;
  // Cada movimento contribui para o fechamento de seu dia e de todos os dias seguintes.
  // Evita criar/persistir um saldo por dia ou percorrer anos vazios.
  let weighted = opening.mul(days);
  for (const row of rows) {
    const day = new Date(row.dataHora.toISOString().slice(0, 10) + 'T00:00:00Z');
    weighted = weighted.plus(signed(row.valor, row.tipo).mul((range.end.getTime() - day.getTime()) / 86400000));
  }
  return weighted.div(days).toFixed(2);
}

export function spendingTrend(previous: Prisma.Decimal, current: Prisma.Decimal) {
  const variation = previous.greaterThan(0) ? current.minus(previous).div(previous).mul(100) : null;
  return { variationPercentage: variation?.toDecimalPlaces(4).toNumber() ?? null,
    trend: variation === null ? current.greaterThan(0) ? 'AUMENTANDO' : 'ESTAVEL'
      : variation.greaterThan(10) ? 'AUMENTANDO' : variation.lessThan(-10) ? 'DIMINUINDO' : 'ESTAVEL' };
}

export function normalizeDescription(value: string) { return value.toLowerCase().trim().replace(/\s+/g, ' '); }
