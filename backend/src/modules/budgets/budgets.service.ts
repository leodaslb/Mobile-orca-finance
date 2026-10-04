import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CanalNotificacao, PeriodoRegra, Prisma, TipoRegraGasto } from '../../generated/prisma/client';
import { ProfilesService } from '../profiles/profiles.service';
import { UsersRepository } from '../users/users.repository';
import { BudgetsRepository } from './budgets.repository';
import { budgetMetrics } from './budget-metrics';
import { monthlyPeriod, rulePeriod } from './planning-period';
import { MonthlyBudgetDto } from './dto/monthly-budget.dto';
import { CreateSpendingRuleDto, UpdateSpendingRuleDto } from './dto/spending-rule.dto';

type RuleState = {
  tipo: TipoRegraGasto; categoriaId: string | null; valorLimite: Prisma.Decimal;
  periodo: PeriodoRegra; ativa: boolean;
};

@Injectable()
export class BudgetsService {
  constructor(private readonly budgets: BudgetsRepository, private readonly profiles: ProfilesService,
    private readonly users: UsersRepository) {}

  private positive(value: string) {
    const decimal = new Prisma.Decimal(value);
    if (!decimal.isFinite() || !decimal.greaterThan(0)) throw new BadRequestException('Valor deve ser positivo.');
    return decimal;
  }

  private singleMonthly<T>(items: T[]): T | undefined {
    if (items.length > 1) throw new ConflictException('Há múltiplos orçamentos mensais para este perfil e mês.');
    return items[0];
  }

  async putMonthly(userId: string, perfilId: string, ano: number, mes: number, dto: MonthlyBudgetDto) {
    await this.profiles.assertOwnership(userId, perfilId);
    const range = monthlyPeriod(ano, mes);
    const lastDay = new Date(range.end.getTime() - 86400000);
    const categories = dto.categorias.map((item) => ({ categoriaId: item.categoriaId.toLowerCase(), valorPlanejado: this.positive(item.valorPlanejado) }));
    const ids = categories.map((item) => item.categoriaId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Categoria duplicada no orçamento.');
    await this.budgets.transaction(async (tx) => {
      await this.budgets.lockProfile(perfilId, tx);
      const existing = this.singleMonthly(await this.budgets.findMonthly(perfilId, range.start, lastDay, tx));
      const valid = await this.budgets.categories(ids, tx);
      if (valid.length !== ids.length) throw new BadRequestException('Categoria inválida.');
      if (valid.some((category) => !category.ativa && !existing?.orcamentoCategorias.some((item) => item.categoriaId === category.id))) {
        throw new ConflictException('Categoria inativa para nova associação.');
      }
      const budget = existing ?? await this.budgets.createMonthly(perfilId, range.start, lastDay, tx);
      await this.budgets.replaceCategories(budget.id, categories, tx);
    });
    return this.getMonthly(userId, perfilId, ano, mes);
  }

  async getMonthly(userId: string, perfilId: string, ano: number, mes: number) {
    await this.profiles.assertOwnership(userId, perfilId);
    const range = monthlyPeriod(ano, mes);
    const item = this.singleMonthly(await this.budgets.findMonthly(perfilId, range.start, new Date(range.end.getTime() - 86400000)));
    if (!item) throw new NotFoundException('Orçamento mensal não encontrado.');
    const sums = await this.budgets.spentByCategory(perfilId, range);
    const spent = new Map(sums.map((row) => [row.categoriaId, row._sum.valor ?? new Prisma.Decimal(0)]));
    let planejado = new Prisma.Decimal(0);
    let realizado = new Prisma.Decimal(0);
    const categorias = item.orcamentoCategorias.map((category) => {
      const value = spent.get(category.categoriaId) ?? new Prisma.Decimal(0);
      planejado = planejado.plus(category.valorPlanejado);
      realizado = realizado.plus(value);
      return { categoria: category.categoria, ...budgetMetrics(category.valorPlanejado, value) };
    });
    return { id: item.id, perfilId, ano, mes, ativo: item.ativo, categorias,
      totais: budgetMetrics(planejado, realizado), inicio: range.start.toISOString(), fimExclusivo: range.end.toISOString() };
  }

  async putQuota(userId: string, perfilId: string, ano: number, mes: number, value: string) {
    await this.profiles.assertOwnership(userId, perfilId);
    monthlyPeriod(ano, mes);
    await this.budgets.putQuota(perfilId, ano, mes, this.positive(value));
    return this.getQuota(userId, perfilId, ano, mes);
  }

  async getQuota(userId: string, perfilId: string, ano: number, mes: number) {
    await this.profiles.assertOwnership(userId, perfilId);
    const range = monthlyPeriod(ano, mes);
    const quota = await this.budgets.quota(perfilId, ano, mes);
    if (!quota) throw new NotFoundException('Cota não encontrada.');
    const consumed = await this.budgets.spent(perfilId, range, { ehGastoLivre: true });
    return { id: quota.id, perfilId, ano, mes, valorLimite: quota.valorLimite.toFixed(2),
      valorConsumido: consumed.toFixed(2), valorRestante: quota.valorLimite.minus(consumed).toFixed(2) };
  }

  private async validateRule(userId: string, state: RuleState, channels: CanalNotificacao[], tx: Prisma.TransactionClient,
    currentCategory?: string | null) {
    if (![TipoRegraGasto.LIMITE_DIARIO, TipoRegraGasto.LIMITE_CATEGORIA].includes(state.tipo as 'LIMITE_DIARIO' | 'LIMITE_CATEGORIA')) {
      throw new BadRequestException('Tipo de regra fora desta versão.');
    }
    if (!state.valorLimite.greaterThan(0)) throw new BadRequestException('Limite deve ser positivo.');
    if (state.tipo === 'LIMITE_DIARIO' && (state.periodo !== 'DIARIO' || state.categoriaId)) {
      throw new BadRequestException('Limite diário exige período DIARIO e não possui categoria.');
    }
    if (state.tipo === 'LIMITE_CATEGORIA') {
      if (!state.categoriaId) throw new BadRequestException('Limite de categoria exige categoria.');
      const category = (await this.budgets.categories([state.categoriaId], tx))[0];
      if (!category) throw new BadRequestException('Categoria inválida.');
      if (!category.ativa && category.id !== currentCategory) throw new ConflictException('Categoria inativa.');
    }
    if (channels.includes(CanalNotificacao.EMAIL)) {
      const user = await this.users.findById(userId);
      if (!user?.email) throw new BadRequestException('Canal EMAIL exige e-mail associado à conta.');
    }
  }

  async createRule(userId: string, perfilId: string, dto: CreateSpendingRuleDto) {
    await this.profiles.assertOwnership(userId, perfilId);
    const state: RuleState = { tipo: dto.tipo, periodo: dto.periodo, categoriaId: dto.categoriaId?.toLowerCase() ?? null,
      valorLimite: this.positive(dto.valorLimite), ativa: dto.ativa ?? true };
    const id = await this.budgets.transaction(async (tx) => {
      await this.validateRule(userId, state, dto.canais, tx);
      const rule = await this.budgets.createRule(perfilId, state, tx);
      await this.budgets.replaceChannels(rule.id, dto.canais, tx);
      return rule.id;
    });
    return (await this.listRules(userId, perfilId)).find((rule) => rule.id === id);
  }

  async updateRule(userId: string, perfilId: string, id: string, dto: UpdateSpendingRuleDto) {
    await this.profiles.assertOwnership(userId, perfilId);
    if (!Object.values(dto).some((value) => value !== undefined)) throw new BadRequestException('Informe ao menos um campo.');
    await this.budgets.transaction(async (tx) => {
      const current = await this.budgets.findRule(perfilId, id, tx);
      if (!current) throw new NotFoundException('Regra não encontrada.');
      const state: RuleState = {
        tipo: dto.tipo ?? current.tipo, periodo: dto.periodo ?? current.periodo,
        categoriaId: dto.categoriaId !== undefined ? dto.categoriaId?.toLowerCase() ?? null : current.categoriaId,
        valorLimite: dto.valorLimite !== undefined ? this.positive(dto.valorLimite) : current.valorLimite ?? new Prisma.Decimal(0),
        ativa: dto.ativa ?? current.ativa,
      };
      const channels = dto.canais ?? current.canais.map((channel) => channel.canal);
      await this.validateRule(userId, state, channels, tx, current.categoriaId);
      await this.budgets.updateRule(perfilId, id, state, tx);
      if (dto.canais !== undefined) await this.budgets.replaceChannels(id, channels, tx);
    });
    return (await this.listRules(userId, perfilId)).find((rule) => rule.id === id);
  }

  async listRules(userId: string, perfilId: string, reference = new Date()) {
    await this.profiles.assertOwnership(userId, perfilId);
    return Promise.all((await this.budgets.listRules(perfilId)).map(async (rule) => {
      const range = rulePeriod(rule.periodo, reference);
      const consumed = await this.budgets.spent(perfilId, range, rule.categoriaId ? { categoriaId: rule.categoriaId } : {});
      const limit = rule.valorLimite;
      const hit = limit !== null && (rule.tipo === 'LIMITE_DIARIO' ? consumed.greaterThanOrEqualTo(limit) : consumed.greaterThan(limit));
      return { id: rule.id, perfilId, tipo: rule.tipo, periodo: rule.periodo, categoriaId: rule.categoriaId, ativa: rule.ativa,
        valorLimite: limit?.toFixed(2) ?? null, valorConsumido: consumed.toFixed(2),
        percentualConsumido: limit?.greaterThan(0) ? consumed.div(limit).mul(100).toFixed(2) : null,
        limiteAtingido: hit, alertaAtivo: rule.ativa && hit, canais: rule.canais.map((channel) => channel.canal).sort(),
        inicio: range.start.toISOString(), fimExclusivo: range.end.toISOString() };
    }));
  }
}
