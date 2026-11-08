import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseCalculo, CanalNotificacao, Orcamento, OrcamentoCategoria, PeriodoRegra, Prisma, TipoRegraGasto } from '../../generated/prisma/client';
import { ProfilesService } from '../profiles/profiles.service';
import { UsersRepository } from '../users/users.repository';
import { BudgetsRepository } from './budgets.repository';
import { budgetMetrics } from './budget-metrics';
import { monthlyPeriod, rulePeriod } from './planning-period';
import { MonthlyBudgetDto } from './dto/monthly-budget.dto';
import { CreateSpendingRuleDto, UpdateSpendingRuleDto } from './dto/spending-rule.dto';
import { BudgetQueryDto, CreateBudgetDto, UpdateBudgetDto } from './dto/budget.dto';
import { BudgetCategoryDto } from './dto/monthly-budget.dto';
import { budgetDate, budgetPeriod } from './budget-period';
import { Clock } from '../../common/clock';

type RuleState = {
  tipo: TipoRegraGasto; categoriaId: string | null; valorLimite: Prisma.Decimal | null;
  percentualLimite: Prisma.Decimal | null; baseCalculo: BaseCalculo | null;
  periodo: PeriodoRegra; ativa: boolean;
};

@Injectable()
export class BudgetsService {
  constructor(private readonly budgets: BudgetsRepository, private readonly profiles: ProfilesService,
    private readonly users: UsersRepository, private readonly clock: Clock = new Clock()) {}

  private positive(value: string) {
    const decimal = new Prisma.Decimal(value);
    if (!decimal.isFinite() || !decimal.greaterThan(0)) throw new BadRequestException('Valor deve ser positivo.');
    return decimal;
  }

  private contextual(tipo: Orcamento['tipo']) {
    return tipo === 'TEMPORARIO' || tipo === 'EVENTO';
  }

  private async assertMonthlyAvailable(profile: string, start: Date, end: Date, tx: Prisma.TransactionClient, currentId?: string) {
    // Decisão da Parte 1: um MENSAL por perfil/intervalo exato, inclusive inativo.
    // Todos os escritores de orçamento mensal usam o mesmo lock de perfil.
    const existing = await this.budgets.findMonthly(profile, start, end, tx);
    if (existing.some((item) => item.id !== currentId)) {
      throw new ConflictException('Já existe orçamento mensal para este perfil e período.');
    }
  }

  private async plannedCategories(dto: BudgetCategoryDto[], tx: Prisma.TransactionClient,
    current: OrcamentoCategoria[] = []) {
    const planned = dto.map((item) => ({ categoriaId: item.categoriaId.toLowerCase(), valorPlanejado: this.positive(item.valorPlanejado) }));
    const ids = planned.map((item) => item.categoriaId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Categoria duplicada no orçamento.');
    const categories = await this.budgets.categories(ids, tx);
    if (categories.length !== ids.length) throw new BadRequestException('Categoria inválida.');
    if (categories.some((category) => !category.ativa && !current.some((item) => item.categoriaId === category.id))) {
      throw new ConflictException('Categoria inativa para nova associação.');
    }
    return planned;
  }

  // RF34/42/63 → US07 → RN-ORC-02/03. RF46 → US09 → RN-ORC-04.
  async createBudget(user: string, profile: string, dto: CreateBudgetDto) {
    await this.profiles.assertOwnership(user, profile);
    budgetPeriod(dto.dataInicio, dto.dataFim);
    const id = await this.budgets.transaction(async (tx) => {
      await this.budgets.lockProfile(profile, tx);
      if (dto.tipo === 'MENSAL') {
        await this.assertMonthlyAvailable(profile, budgetDate(dto.dataInicio), budgetDate(dto.dataFim), tx);
      }
      const planned = await this.plannedCategories(dto.categorias, tx);
      const item = await this.budgets.createBudget(profile, { nome: dto.nome ?? null, tipo: dto.tipo,
        dataInicio: budgetDate(dto.dataInicio), dataFim: budgetDate(dto.dataFim) }, tx);
      await this.budgets.replaceCategories(item.id, planned, tx);
      return item.id;
    });
    return this.getBudget(user, profile, id);
  }

  async listBudgets(user: string, profile: string, dto: BudgetQueryDto) {
    await this.profiles.assertOwnership(user, profile);
    if (dto.from) budgetDate(dto.from);
    if (dto.to) budgetDate(dto.to);
    if (dto.from && dto.to && dto.from > dto.to) throw new BadRequestException('Intervalo de orçamentos inválido.');
    return Promise.all((await this.budgets.listBudgets(profile, dto)).map((item) => this.presentBudget(profile, item, false)));
  }

  async getBudget(user: string, profile: string, id: string) {
    await this.profiles.assertOwnership(user, profile);
    const item = await this.budgets.findBudget(profile, id);
    if (!item) throw new NotFoundException('Orçamento não encontrado.');
    return this.presentBudget(profile, item, true);
  }

  private async presentBudget(profile: string, item: Orcamento & { orcamentoCategorias: OrcamentoCategoria[] }, detail: boolean) {
    const dataInicio = item.dataInicio.toISOString().slice(0, 10);
    const dataFim = item.dataFim.toISOString().slice(0, 10);
    const range = budgetPeriod(dataInicio, dataFim);
    const contextual = this.contextual(item.tipo);
    const sums = await this.budgets.budgetSpending(profile, range, contextual ? item.id : undefined);
    const spent = new Map(sums.map((row) => [row.categoriaId, row._sum.valor ?? new Prisma.Decimal(0)]));
    let allocated = new Prisma.Decimal(0);
    let realized = new Prisma.Decimal(0);
    const categorias = item.orcamentoCategorias.map((category) => {
      const value = spent.get(category.categoriaId) ?? new Prisma.Decimal(0);
      allocated = allocated.plus(category.valorPlanejado);
      realized = realized.plus(value);
      const metrics = budgetMetrics(category.valorPlanejado, value);
      return { categoriaId: category.categoriaId, valorPlanejado: metrics.valorPlanejado,
        valorRealizado: metrics.valorRealizado, percentualConsumido: Number(metrics.percentualConsumido), estado: metrics.estado };
    });
    // O resumo contextual inclui todos os gastos vinculados, inclusive categoria ainda não planejada.
    if (contextual) realized = sums.reduce((sum, row) => sum.plus(row._sum.valor ?? 0), new Prisma.Decimal(0));
    const metrics = budgetMetrics(allocated, realized);
    const renda = item.tipo === 'ZERO_BASED' ? await this.budgets.budgetIncome(profile, range) : null;
    const status = renda === null ? null : allocated.equals(renda) ? 'COMPLETO' : allocated.lessThan(renda) ? 'FALTA_ALOCAR' : 'EXCEDIDO';
    const links = detail && contextual ? await this.budgets.linkedTransactions(profile, item.id) : [];
    return { id: item.id, perfilId: item.perfilId, nome: item.nome, tipo: item.tipo, dataInicio, dataFim, ativo: item.ativo,
      createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
      resumo: { valorPlanejado: metrics.valorPlanejado, valorRealizado: metrics.valorRealizado,
        percentualConsumido: metrics.percentualConsumido === null ? null : Number(metrics.percentualConsumido), estado: metrics.estado },
      ...(detail && { categorias }),
      ...(detail && contextual && { transacoesVinculadas: links.map((row) => ({ ...row, valor: row.valor.toFixed(2), dataHora: row.dataHora.toISOString() })) }),
      ...(renda !== null && { zeroBased: { rendaPeriodo: renda.toFixed(2), totalAlocado: allocated.toFixed(2),
        diferenca: renda.minus(allocated).toFixed(2), status, planejamentoIncompleto: status !== 'COMPLETO' } }) };
  }

  async updateBudget(user: string, profile: string, id: string, dto: UpdateBudgetDto) {
    await this.profiles.assertOwnership(user, profile);
    if (!Object.values(dto).some((value) => value !== undefined)) throw new BadRequestException('Informe ao menos um campo.');
    await this.budgets.transaction(async (tx) => {
      await this.budgets.lockProfile(profile, tx);
      const current = await this.budgets.findBudget(profile, id, tx);
      if (!current) throw new NotFoundException('Orçamento não encontrado.');
      const start = dto.dataInicio ?? current.dataInicio.toISOString().slice(0, 10);
      const end = dto.dataFim ?? current.dataFim.toISOString().slice(0, 10);
      budgetPeriod(start, end);
      if (current.tipo === 'MENSAL') {
        await this.assertMonthlyAvailable(profile, budgetDate(start), budgetDate(end), tx, current.id);
      }
      const planned = dto.categorias !== undefined ? await this.plannedCategories(dto.categorias, tx, current.orcamentoCategorias) : undefined;
      await this.budgets.updateBudget(profile, id, { ...(dto.nome !== undefined && { nome: dto.nome }),
        dataInicio: budgetDate(start), dataFim: budgetDate(end), ...(dto.ativo !== undefined && { ativo: dto.ativo }) }, tx);
      if (planned !== undefined) await this.budgets.replaceCategories(id, planned, tx);
    });
    return this.getBudget(user, profile, id);
  }

  async setBudgetTransaction(user: string, profile: string, id: string, transactionId: string, linked: boolean) {
    await this.profiles.assertOwnership(user, profile);
    await this.budgets.transaction(async (tx) => {
      await this.budgets.lockProfile(profile, tx);
      const budget = await this.budgets.findBudget(profile, id, tx);
      if (!budget) throw new NotFoundException('Orçamento não encontrado.');
      if (!this.contextual(budget.tipo)) throw new BadRequestException('Vínculo explícito aplica-se a orçamento temporário ou evento.');
      await this.budgets.lockTransaction(profile, transactionId, tx);
      if (!await this.budgets.findTransaction(profile, transactionId, tx)) throw new NotFoundException('Transação não encontrada.');
      if (linked) await this.budgets.linkTransaction(transactionId, id, tx);
      else await this.budgets.unlinkTransaction(profile, transactionId, id, tx);
    });
  }

  private singleMonthly<T>(items: T[]): T | undefined {
    if (items.length > 1) throw new ConflictException('Há múltiplos orçamentos mensais para este perfil e mês.');
    return items[0];
  }

  async simulationImpact(user: string, profile: string, year: number, month: number, category: string, additional: Prisma.Decimal) {
    await this.profiles.assertOwnership(user, profile);
    const range = monthlyPeriod(year, month);
    const item = this.singleMonthly(await this.budgets.findMonthly(profile, range.start, new Date(range.end.getTime() - 86400000)));
    const planned = item?.ativo ? item.orcamentoCategorias.find(r => r.categoriaId === category) : undefined;
    if (!planned) return null;
    const current = await this.budgets.spent(profile, range, { categoriaId: category });
    const projected = current.plus(additional);
    return { valorPlanejado: planned.valorPlanejado.toFixed(2), valorProjetadoComCompra: projected.toFixed(2),
      percentualProjetado: planned.valorPlanejado.greaterThan(0) ? projected.div(planned.valorPlanejado).mul(100).toDecimalPlaces(4).toNumber() : null };
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
      createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
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
      createdAt: quota.createdAt.toISOString(), updatedAt: quota.updatedAt.toISOString(),
      valorConsumido: consumed.toFixed(2), valorRestante: quota.valorLimite.minus(consumed).toFixed(2) };
  }

  private async validateRule(userId: string, state: RuleState, channels: CanalNotificacao[], tx: Prisma.TransactionClient,
    currentCategory?: string | null) {
    if (!Object.values(TipoRegraGasto).includes(state.tipo)) throw new BadRequestException('Tipo de regra inválido.');
    if (state.tipo === 'PERCENTUAL_RENDA') {
      if (state.valorLimite !== null || !state.percentualLimite?.greaterThan(0) || !state.percentualLimite.isFinite()
        || !state.baseCalculo) throw new BadRequestException('Percentual de renda exige percentual/base e não aceita valorLimite.');
    } else if (!state.valorLimite?.greaterThan(0) || state.percentualLimite !== null || state.baseCalculo !== null) {
      throw new BadRequestException('Limite monetário exige valorLimite positivo e não aceita percentual/base.');
    }
    if (state.tipo === 'LIMITE_DIARIO' && (state.periodo !== 'DIARIO' || state.categoriaId)) {
      throw new BadRequestException('Limite diário exige período DIARIO e não possui categoria.');
    }
    if (state.tipo === 'LIMITE_CATEGORIA' && !state.categoriaId) throw new BadRequestException('Limite de categoria exige categoria.');
    if (state.categoriaId) {
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
      valorLimite: dto.valorLimite != null ? this.positive(dto.valorLimite) : null,
      percentualLimite: dto.percentualLimite != null ? new Prisma.Decimal(dto.percentualLimite) : null,
      baseCalculo: dto.baseCalculo ?? null, ativa: dto.ativa ?? true };
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
      await this.budgets.lockProfile(perfilId, tx);
      const current = await this.budgets.findRule(perfilId, id, tx);
      if (!current) throw new NotFoundException('Regra não encontrada.');
      const state: RuleState = {
        tipo: dto.tipo ?? current.tipo, periodo: dto.periodo ?? current.periodo,
        categoriaId: dto.categoriaId !== undefined ? dto.categoriaId?.toLowerCase() ?? null : current.categoriaId,
        valorLimite: dto.valorLimite !== undefined ? dto.valorLimite === null ? null : this.positive(dto.valorLimite) : current.valorLimite,
        percentualLimite: dto.percentualLimite !== undefined ? dto.percentualLimite === null ? null : new Prisma.Decimal(dto.percentualLimite) : current.percentualLimite,
        baseCalculo: dto.baseCalculo !== undefined ? dto.baseCalculo : current.baseCalculo,
        ativa: dto.ativa ?? current.ativa,
      };
      const channels = dto.canais ?? current.canais.map((channel) => channel.canal);
      await this.validateRule(userId, state, channels, tx, current.categoriaId);
      await this.budgets.updateRule(perfilId, id, state, tx);
      if (dto.canais !== undefined) await this.budgets.replaceChannels(id, channels, tx);
    });
    return (await this.listRules(userId, perfilId)).find((rule) => rule.id === id);
  }

  async listRules(userId: string, perfilId: string, reference = this.clock.now()) {
    await this.profiles.assertOwnership(userId, perfilId);
    return this.evaluatedRules(perfilId, reference);
  }

  // Uso interno depois de ownership validado; mantém agregações no TransactionClient do chamador.
  async evaluatedRules(perfilId: string, reference = this.clock.now(), tx?: Prisma.TransactionClient) {
    return Promise.all((await this.budgets.listRules(perfilId, tx)).map(rule => this.presentRule(perfilId, rule, reference, tx)));
  }

  async getRule(userId: string, perfilId: string, id: string, reference = this.clock.now()) {
    await this.profiles.assertOwnership(userId, perfilId);
    const rule = await this.budgets.findRule(perfilId, id);
    if (!rule) throw new NotFoundException('Regra não encontrada.');
    return this.presentRule(perfilId, rule, reference);
  }

  private async presentRule(perfilId: string, rule: NonNullable<Awaited<ReturnType<BudgetsRepository['findRule']>>>, reference: Date, tx?: Prisma.TransactionClient) {
      const range = rulePeriod(rule.periodo, reference);
      const consumed = await this.budgets.spent(perfilId, range, rule.categoriaId ? { categoriaId: rule.categoriaId } : {}, tx);
      let limit = rule.valorLimite;
      if (rule.tipo === 'PERCENTUAL_RENDA') {
        const income = rule.baseCalculo === 'RENDA_PLANEJADA'
          ? await this.budgets.budgetIncome(perfilId, range, tx) : await this.budgets.effectiveIncome(perfilId, range, tx);
        limit = income.mul(rule.percentualLimite!).div(100);
      }
      const hit = limit !== null && (rule.tipo === 'LIMITE_DIARIO' ? consumed.greaterThanOrEqualTo(limit) : consumed.greaterThan(limit));
      return { id: rule.id, perfilId, tipo: rule.tipo, periodo: rule.periodo, categoriaId: rule.categoriaId, ativa: rule.ativa,
        percentualLimite: rule.percentualLimite?.toNumber() ?? null, baseCalculo: rule.baseCalculo,
        createdAt: rule.createdAt.toISOString(), updatedAt: rule.updatedAt.toISOString(),
        avaliacaoAtual: { violada: hit, valorAtual: consumed.toFixed(2), limiteCalculado: limit?.toFixed(2) ?? null },
        valorLimite: rule.valorLimite?.toFixed(2) ?? null, valorConsumido: consumed.toFixed(2),
        percentualConsumido: limit?.greaterThan(0) ? consumed.div(limit).mul(100).toFixed(2) : null,
        limiteAtingido: hit, alertaAtivo: rule.ativa && hit, canais: rule.canais.map((channel) => channel.canal).sort(),
        inicio: range.start.toISOString(), fimExclusivo: range.end.toISOString() };
  }
}
