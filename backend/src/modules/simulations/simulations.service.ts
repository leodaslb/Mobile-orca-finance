import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { ProfilesService } from '../profiles/profiles.service';
import { CategoriesRepository } from '../categories/categories.repository';
import { BudgetsService } from '../budgets/budgets.service';
import { AnalyticsRepository } from '../analytics/analytics.repository';
import { CashFlowService } from '../analytics/cash-flow.service';
import { monthlyPeriod } from '../budgets/planning-period';
import { budgetDate } from '../budgets/budget-period';
import { PurchaseImpactDto } from './purchase-impact.dto';

export function installmentValues(total: Prisma.Decimal, count: number) {
  const cents = total.mul(100);
  if (!cents.isInteger() || !Number.isSafeInteger(count) || count < 1) throw new BadRequestException('Valor ou quantidade de parcelas inválidos.');
  const base = cents.div(count).floor(); const remainder = cents.minus(base.mul(count)).toNumber();
  return Array.from({ length: count }, (_, i) => base.plus(i < remainder ? 1 : 0).div(100));
}

@Injectable()
export class SimulationsService {
  constructor(private readonly profiles: ProfilesService, private readonly categories: CategoriesRepository, private readonly budgets: BudgetsService,
    private readonly data: AnalyticsRepository, private readonly cashFlow: CashFlowService) {}
  // RF25/60 → US27 → RN-TRANS-05. Apenas leituras, sem escrita de parcelas.
  async purchase(user: string, profile: string, dto: PurchaseImpactDto) {
    await this.profiles.assertOwnership(user, profile);
    const total = new Prisma.Decimal(dto.valor);
    if (!total.isFinite() || !total.greaterThan(0) || !Number.isInteger(dto.parcelas) || dto.parcelas < 1 || dto.parcelas > 1200) throw new BadRequestException('Valor ou quantidade de parcelas inválidos.');
    const first = budgetDate(dto.dataPrimeiraParcela);
    const category = dto.categoriaId?.toLowerCase();
    if (category && !await this.categories.findCategory(category)) throw new NotFoundException('Categoria não encontrada.');
    const values = installmentValues(total, dto.parcelas);
    const months = [];
    for (let i = 0; i < values.length; i++) {
      const date = new Date(first); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + i);
      const year = date.getUTCFullYear(); const month = date.getUTCMonth() + 1; const range = monthlyPeriod(year, month);
      const [effective, projected] = await Promise.all([this.data.effectiveMovements(profile, range), this.cashFlow.movements(profile, range)]);
      const income = [...effective, ...projected].filter(r => r.tipo === 'RECEITA').reduce((s, r) => s.plus(r.valor), new Prisma.Decimal(0));
      const projectedCategory = projected.filter(r => r.tipo === 'DESPESA' && r.categoriaId === category).reduce((s, r) => s.plus(r.valor), new Prisma.Decimal(0));
      months.push({ competencia: range.start.toISOString().slice(0, 7), valorParcela: values[i].toFixed(2), rendaProjetada: income.toFixed(2),
        percentualRendaComprometida: income.greaterThan(0) ? values[i].div(income).mul(100).toDecimalPlaces(4).toNumber() : null,
        impactoOrcamentoCategoria: category ? await this.budgets.simulationImpact(user, profile, year, month, category, values[i].plus(projectedCategory)) : null });
    }
    return { valorTotal: total.toFixed(2), quantidadeParcelas: dto.parcelas, valorParcela: total.div(dto.parcelas).toFixed(2), criaTransacoes: false, meses: months };
  }
}
