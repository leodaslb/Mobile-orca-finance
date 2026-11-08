import { Injectable } from '@nestjs/common';
import { Prisma, TipoTransacao } from '../../generated/prisma/client';
import { Clock } from '../../common/clock';
import { ProfilesService } from '../profiles/profiles.service';
import { DateRange } from '../budgets/budgets.repository';
import { monthlyPeriod } from '../budgets/planning-period';
import { nextOccurrence, withinEnd } from '../recurrences/recurrence-date';
import { AnalyticsRepository } from './analytics.repository';
import { CashFlowRepository } from './cash-flow.repository';
import { signed } from './insights-math';

export type ProjectedMovement = { date: Date; tipo: TipoTransacao; valor: Prisma.Decimal; descricao: string; categoriaId: string | null; origem: 'RECORRENCIA' | 'TRANSACAO_PREVISTA' };

@Injectable()
export class CashFlowService {
  constructor(private readonly data: CashFlowRepository, private readonly analytics: AnalyticsRepository,
    private readonly profiles: ProfilesService, private readonly clock: Clock) {}
  // Reutilizado pela simulação; o chamador valida ownership antes de fornecer contexto de perfil.
  async movements(profile: string, range: DateRange): Promise<ProjectedMovement[]> {
    const [planned, recurrences, generated] = await this.data.inputs(profile, range);
    const keys = new Set(generated.map(r => `${r.recorrenciaId}/${r.ocorrenciaReferencia!.toISOString()}`));
    const result: ProjectedMovement[] = planned.map(r => ({ date: r.dataHora, tipo: r.tipo, valor: r.valor, descricao: r.descricao,
      categoriaId: r.categoriaId, origem: r.recorrenciaId ? 'RECORRENCIA' : 'TRANSACAO_PREVISTA' }));
    for (const r of recurrences) {
      for (let date = new Date(r.proximaOcorrencia); date < range.end && withinEnd(date, r.dataTermino); date = nextOccurrence(date, r.frequencia)) {
        if (date < range.start || keys.has(`${r.id}/${date.toISOString()}`)) continue;
        result.push({ date, tipo: r.tipoTransacao, valor: r.valor, descricao: r.descricao, categoriaId: r.categoriaId, origem: 'RECORRENCIA' });
      }
    }
    return result.sort((a, b) => a.date.getTime() - b.date.getTime() || a.descricao.localeCompare(b.descricao));
  }
  // RF14/38 → US32 → RN-TRANS-04. Projeção nunca materializa ocorrências.
  async projection(user: string, profile: string) {
    await this.profiles.assertOwnership(user, profile);
    const now = this.clock.now(); const start = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z');
    const end = new Date(start.getTime() + 30 * 86400000); const monthEnd = monthlyPeriod(now.getUTCFullYear(), now.getUTCMonth() + 1).end;
    const [totals, moves] = await Promise.all([this.analytics.totals(profile), this.movements(profile, { start, end: end > monthEnd ? end : monthEnd })]);
    const balance = totals.reduce((sum, r) => sum.plus(signed(r._sum.valor ?? new Prisma.Decimal(0), r.tipo)), new Prisma.Decimal(0));
    const next30 = moves.filter(r => r.date < end);
    const income = next30.filter(r => r.tipo === 'RECEITA').reduce((s, r) => s.plus(r.valor), new Prisma.Decimal(0));
    const expenses = next30.filter(r => r.tipo === 'DESPESA').reduce((s, r) => s.plus(r.valor), new Prisma.Decimal(0));
    return { generatedAt: now.toISOString(), saldoAtual: balance.toFixed(2),
      saldoProjetadoFimMes: moves.filter(r => r.date < monthEnd).reduce((s, r) => s.plus(signed(r.valor, r.tipo)), balance).toFixed(2),
      next30Days: { startDate: start.toISOString().slice(0, 10), endDate: new Date(end.getTime() - 86400000).toISOString().slice(0, 10),
        entradasPrevistas: income.toFixed(2), saidasPrevistas: expenses.toFixed(2), saldoProjetadoFinal: balance.plus(income).minus(expenses).toFixed(2),
        movimentos: next30.map(r => ({ data: r.date.toISOString().slice(0, 10), tipo: r.tipo, valor: r.valor.toFixed(2), descricao: r.descricao, origem: r.origem })) } };
  }
}
