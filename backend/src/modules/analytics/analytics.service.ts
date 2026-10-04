import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { ProfilesService } from '../profiles/profiles.service';
import { GoalsService } from '../goals/goals.service';
import { monthlyPeriod } from '../budgets/planning-period';
import { AnalyticsRepository } from './analytics.repository';
import { DashboardQueryDto, ExpenseReportQueryDto, ExportQueryDto } from './dto/analytics-query.dto';
import { reportPeriod } from './report-period';
import { csvFile, xlsxFile } from './transaction-export';

@Injectable()
export class AnalyticsService {
  constructor(private readonly analytics: AnalyticsRepository, private readonly profiles: ProfilesService,
    private readonly goals: GoalsService) {}

  async expenses(user: string, profile: string, dto: ExpenseReportQueryDto) {
    await this.profiles.assertOwnership(user, profile);
    const range = reportPeriod(dto.startDate, dto.endDate);
    const sums = await this.analytics.expensesByCategory(profile, range);
    const categories = await this.analytics.categories(sums.flatMap((row) => row.categoriaId ? [row.categoriaId] : []));
    const names = new Map(categories.map((row) => [row.id, row.nome]));
    const total = sums.reduce((value, row) => value.plus(row._sum.valor ?? 0), new Prisma.Decimal(0));
    return { periodo: { startDate: dto.startDate, endDate: dto.endDate, inicio: range.start.toISOString(), fimExclusivo: range.end.toISOString() },
      totalGasto: total.toFixed(2), categorias: sums.map((row) => ({ categoriaId: row.categoriaId,
        nome: row.categoriaId ? names.get(row.categoriaId) ?? null : 'Sem categoria', valor: (row._sum.valor ?? new Prisma.Decimal(0)).toFixed(2),
        percentualDoTotal: total.greaterThan(0) ? (row._sum.valor ?? new Prisma.Decimal(0)).div(total).mul(100).toFixed(2) : '0.00' }))
        .sort((a, b) => (a.categoriaId ?? '').localeCompare(b.categoriaId ?? '')) };
  }

  async export(user: string, profile: string, dto: ExportQueryDto) {
    await this.profiles.assertOwnership(user, profile);
    if ((dto.startDate === undefined) !== (dto.endDate === undefined)) throw new BadRequestException('Informe startDate e endDate juntos.');
    const range = dto.startDate !== undefined && dto.endDate !== undefined ? reportPeriod(dto.startDate, dto.endDate) : undefined;
    const transactions = await this.analytics.exportTransactions(profile, range);
    const rows = transactions.map((row) => [row.dataHora.toISOString(), row.tipo, row.descricao, row.valor.toFixed(2),
      row.categoria?.nome ?? '', row.subcategoria?.perfilId === profile.toLowerCase() ? row.subcategoria.nome : '', row.metodoPagamento ?? '',
      row.essencialidade, row.status, row.ehGastoLivre ? 'Sim' : 'Não', row.anotacao ?? '', row.transacaoTags.map((tag) => tag.tag.nome).join('; ')]);
    return { buffer: dto.format === 'csv' ? csvFile(rows) : await xlsxFile(rows),
      contentType: dto.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `transacoes-${profile}.${dto.format}` };
  }

  async dashboard(user: string, profile: string, dto: DashboardQueryDto) {
    await this.profiles.assertOwnership(user, profile);
    const current = monthlyPeriod(dto.year, dto.month);
    const previous = dto.year === 1 && dto.month === 1 ? null
      : monthlyPeriod(dto.month === 1 ? dto.year - 1 : dto.year, dto.month === 1 ? 12 : dto.month - 1);
    const [totals, currentExpenses, previousExpenses, goals, recent] = await Promise.all([
      this.analytics.totals(profile), this.analytics.expenseTotal(profile, current),
      previous ? this.analytics.expenseTotal(profile, previous) : Promise.resolve({ _sum: { valor: null } }),
      this.goals.list(user, profile), this.analytics.recent(profile),
    ]);
    const income = totals.find((row) => row.tipo === 'RECEITA')?._sum.valor ?? new Prisma.Decimal(0);
    const expenses = totals.find((row) => row.tipo === 'DESPESA')?._sum.valor ?? new Prisma.Decimal(0);
    const now = currentExpenses._sum.valor ?? new Prisma.Decimal(0);
    const before = previousExpenses._sum.valor ?? new Prisma.Decimal(0);
    const difference = now.minus(before);
    return { ano: dto.year, mes: dto.month, saldoAtual: income.minus(expenses).toFixed(2), gastosDoMes: now.toFixed(2),
      comparacaoComMesAnterior: { gastosMesAtual: now.toFixed(2), gastosMesAnterior: before.toFixed(2), diferenca: difference.toFixed(2),
        percentualVariacao: before.greaterThan(0) ? difference.div(before).mul(100).toFixed(2) : null },
      progressoDasMetas: goals,
      transacoesRecentes: recent.map((row) => ({ ...row, valor: row.valor.toFixed(2), dataHora: row.dataHora.toISOString() })) };
  }
}
