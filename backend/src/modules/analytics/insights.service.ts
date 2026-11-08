import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { Clock } from '../../common/clock';
import { ProfilesService } from '../profiles/profiles.service';
import { AnalyticsRepository } from './analytics.repository';
import { MetricsQueryDto } from './insights.dto';
import { dailyAverage, normalizeDescription, signed, spendingTrend } from './insights-math';
import { reportPeriod } from './report-period';
import { monthlyPeriod } from '../budgets/planning-period';

@Injectable()
export class InsightsService {
  constructor(private readonly data: AnalyticsRepository, private readonly profiles: ProfilesService, private readonly clock: Clock) {}
  // RF22 → US25 → RN-MET-01/02.
  async metrics(user: string, profile: string, dto: MetricsQueryDto) {
    await this.profiles.assertOwnership(user, profile);
    if ((dto.startDate === undefined) !== (dto.endDate === undefined)) throw new BadRequestException('Informe startDate e endDate juntos.');
    const year = this.clock.now().getUTCFullYear();
    const startDate = dto.startDate ?? `${year}-01-01`; const endDate = dto.endDate ?? `${year}-12-31`;
    const range = reportPeriod(startDate, endDate);
    const [totals, rows] = await Promise.all([this.data.openingTotals(profile, range.start), this.data.effectiveMovements(profile, range)]);
    const opening = totals.reduce((sum, r) => sum.plus(signed(r._sum.valor ?? new Prisma.Decimal(0), r.tipo)), new Prisma.Decimal(0));
    const income = rows.filter(r => r.tipo === 'RECEITA').reduce((s, r) => s.plus(r.valor), new Prisma.Decimal(0));
    const expense = rows.filter(r => r.tipo === 'DESPESA').reduce((s, r) => s.plus(r.valor), new Prisma.Decimal(0));
    return { period: { startDate, endDate }, savingsRate: { value: income.isZero() ? null : income.minus(expense).div(income).mul(100).toDecimalPlaces(4).toNumber(), calculable: !income.isZero() },
      averageDailyBalance: dailyAverage(opening, rows, range) };
  }
  // RF44 → US35 → RN-MET-04: média mensal do trimestre anterior x mês atual até agora.
  async trends(user: string, profile: string) {
    await this.profiles.assertOwnership(user, profile);
    const now = this.clock.now();
    const current = monthlyPeriod(now.getUTCFullYear(), now.getUTCMonth() + 1);
    const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
    const previous = { start: new Date(quarterStart), end: quarterStart }; previous.start.setUTCMonth(previous.start.getUTCMonth() - 3);
    // TIMESTAMPTZ(3): limite exclusivo de 1 ms inclui o instante da consulta.
    const accumulated = { start: current.start, end: new Date(now.getTime() + 1) };
    const [before, after, catalog] = await Promise.all([this.data.expensesByCategory(profile, previous), this.data.expensesByCategory(profile, accumulated), this.data.trendCategories()]);
    const a = new Map(before.map(r => [r.categoriaId, r._sum.valor ?? new Prisma.Decimal(0)]));
    const b = new Map(after.map(r => [r.categoriaId, r._sum.valor ?? new Prisma.Decimal(0)]));
    const categories: { id: string | null; nome: string }[] = catalog;
    if (a.has(null) || b.has(null)) categories.push({ id: null, nome: 'Sem categoria' });
    const period = (p: typeof current) => ({ startDate: p.start.toISOString().slice(0, 10), endDate: new Date(p.end.getTime() - 86400000).toISOString().slice(0, 10) });
    return { referenceQuarter: period(previous), currentMonth: { startDate: current.start.toISOString().slice(0, 10),
      asOfDate: now.toISOString(), partial: now.getUTCDate() !== new Date(current.end.getTime() - 86400000).getUTCDate() }, categories: categories.map(c => {
      const prev = (a.get(c.id) ?? new Prisma.Decimal(0)).div(3); const next = b.get(c.id) ?? new Prisma.Decimal(0);
      return { categoriaId: c.id, categoriaNome: c.nome, referenceMonthlyAverage: prev.toFixed(2), currentMonthTotal: next.toFixed(2), ...spendingTrend(prev, next) };
    }) };
  }
  // RF33 → US48 → RN-CAT-04. Similaridade: igualdade após normalizar caixa/espaços.
  async suggest(user: string, profile: string, description: string) {
    await this.profiles.assertOwnership(user, profile);
    const normalized = normalizeDescription(description); const counts = new Map<string, { count: number; category: { id: string; nome: string } }>();
    for (const row of await this.data.categoryHistory(profile, this.clock.now())) {
      if (!row.categoria || normalizeDescription(row.descricao) !== normalized) continue;
      const old = counts.get(row.categoria.id); counts.set(row.categoria.id, { count: (old?.count ?? 0) + 1, category: row.categoria });
    }
    const ranked = [...counts.values()].sort((a, b) => b.count - a.count);
    const category = ranked.length && (ranked.length === 1 || ranked[0].count > ranked[1].count) ? ranked[0].category : null;
    return { suggested: category !== null, category };
  }
}
