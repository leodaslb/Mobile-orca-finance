import { Prisma } from '../../generated/prisma/client';
import { normalizeDescription } from '../analytics/insights-math';

// RN-DES-02: orientações, sem comparação externa de produtos/preços.
export function challengeSuggestions(reference: Prisma.Decimal, target: Prisma.Decimal,
  history: { descricao: string; valor: Prisma.Decimal }[]) {
  const suggestions: Record<string, unknown>[] = [{ type: 'WEEKLY_TARGET', valorSemanalAproximado: target.div(4).toFixed(2), semanasAproximadas: 4 }];
  if (!history.length) return suggestions;
  const total = history.reduce((sum, r) => sum.plus(r.valor), new Prisma.Decimal(0));
  const mean = total.div(history.length);
  // Meta global e média abrangem todo o histórico; a descrição foca sua maior parcela.
  suggestions.push({ type: 'AVERAGE_TRANSACTION', quantidadeTransacoes: history.length,
    valorMedioHistorico: mean.toFixed(2), valorMedioSugerido: mean.mul(target).div(reference).toFixed(2) });
  const groups = new Map<string, { descricao: string; total: Prisma.Decimal; count: number }>();
  for (const row of history) {
    const key = normalizeDescription(row.descricao); const item = groups.get(key);
    if (item) { item.total = item.total.plus(row.valor); item.count++; }
    else groups.set(key, { descricao: row.descricao, total: row.valor, count: 1 });
  }
  const highest = [...groups.values()].sort((a, b) => b.total.comparedTo(a.total) || b.count - a.count || a.descricao.localeCompare(b.descricao))[0];
  suggestions.push({ type: 'HIGH_IMPACT_DESCRIPTION', descricao: highest.descricao, valorTotal: highest.total.toFixed(2), quantidadeTransacoes: highest.count,
    participacaoPercentual: highest.total.div(total).mul(100).toDecimalPlaces(4).toNumber() });
  return suggestions;
}
