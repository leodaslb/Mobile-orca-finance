import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Meta, Prisma } from '../../generated/prisma/client';
import { ProfilesService } from '../profiles/profiles.service';
import { GoalsRepository } from './goals.repository';
import { ContributionDto, CreateGoalDto, UpdateGoalDto } from './dto/goal.dto';
import { goalMetrics } from './goal-metrics';
import { Clock } from '../../common/clock';

@Injectable()
export class GoalsService {
  constructor(private readonly goals: GoalsRepository, private readonly profiles: ProfilesService, private readonly clock: Clock = new Clock()) {}

  // RF35 → US58 → RN-META-03. A data-limite de hoje ainda não encerrou.
  async completionRate(user: string, profile: string, window: '6m' | '12m') {
    await this.profiles.assertOwnership(user, profile);
    if (!['6m', '12m'].includes(window)) throw new BadRequestException('Janela deve ser 6m ou 12m.');
    const today = new Date(this.clock.now().toISOString().slice(0, 10) + 'T00:00:00Z');
    const start = new Date(today); const day = start.getUTCDate(); start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() - (window === '6m' ? 6 : 12));
    const last = new Date(start); last.setUTCMonth(last.getUTCMonth() + 1, 0); start.setUTCDate(Math.min(day, last.getUTCDate()));
    const rows = await this.goals.closedGoals(profile, start, today);
    const completed = rows.filter(r => {
      const end = new Date(r.dataLimite.getTime() + 86400000);
      return r.aportes.filter(a => a.dataHora < end).reduce((sum, a) => sum.plus(a.valor), new Prisma.Decimal(0)).greaterThanOrEqualTo(r.valorAlvo);
    }).length;
    return { window, startDate: start.toISOString().slice(0, 10), endDate: today.toISOString().slice(0, 10), closedGoals: rows.length, completedGoals: completed,
      completionRate: rows.length ? new Prisma.Decimal(completed).div(rows.length).mul(100).toDecimalPlaces(4).toNumber() : null };
  }

  private positive(value: string) {
    const result = new Prisma.Decimal(value);
    if (!result.isFinite() || !result.greaterThan(0)) throw new BadRequestException('Valor deve ser positivo.');
    return result;
  }

  private date(value: string) {
    if (value.startsWith('0000-')) throw new BadRequestException('Ano deve ser positivo.');
    return new Date(`${value}T00:00:00Z`);
  }

  private present(goal: Meta, accumulated: Prisma.Decimal, reference?: Date) {
    return { id: goal.id, perfilId: goal.perfilId, nome: goal.nome, valorAlvo: goal.valorAlvo.toFixed(2),
      dataLimite: goal.dataLimite.toISOString().slice(0, 10), frequenciaSugestao: goal.frequenciaSugestao,
      createdAt: goal.createdAt.toISOString(), updatedAt: goal.updatedAt.toISOString(),
      ...goalMetrics(goal.valorAlvo, accumulated, goal.dataLimite, goal.frequenciaSugestao, reference) };
  }

  async create(user: string, profile: string, dto: CreateGoalDto) {
    await this.profiles.assertOwnership(user, profile);
    const goal = await this.goals.create(profile, { nome: dto.nome, valorAlvo: this.positive(dto.valorAlvo),
      dataLimite: this.date(dto.dataLimite), frequenciaSugestao: dto.frequenciaSugestao });
    return this.present(goal, new Prisma.Decimal(0));
  }

  async list(user: string, profile: string, reference = new Date()) {
    await this.profiles.assertOwnership(user, profile);
    const goals = await this.goals.list(profile);
    const sums = goals.length ? await this.goals.accumulated(profile, goals.map((goal) => goal.id)) : [];
    const accumulated = new Map(sums.map((row) => [row.metaId, row._sum.valor ?? new Prisma.Decimal(0)]));
    return goals.map((goal) => this.present(goal, accumulated.get(goal.id) ?? new Prisma.Decimal(0), reference));
  }

  async detail(user: string, profile: string, id: string) {
    await this.profiles.assertOwnership(user, profile);
    const goal = await this.goals.find(profile, id);
    if (!goal) throw new NotFoundException('Meta não encontrada.');
    const sums = await this.goals.accumulated(profile, [id]);
    return this.present(goal, sums[0]?._sum.valor ?? new Prisma.Decimal(0));
  }

  async update(user: string, profile: string, id: string, dto: UpdateGoalDto) {
    await this.profiles.assertOwnership(user, profile);
    if (!Object.values(dto).some((value) => value !== undefined)) throw new BadRequestException('Informe ao menos um campo.');
    const result = await this.goals.update(profile, id, { nome: dto.nome, frequenciaSugestao: dto.frequenciaSugestao,
      ...(dto.valorAlvo !== undefined && { valorAlvo: this.positive(dto.valorAlvo) }),
      ...(dto.dataLimite !== undefined && { dataLimite: this.date(dto.dataLimite) }) });
    if (!result.count) throw new NotFoundException('Meta não encontrada.');
    return this.detail(user, profile, id);
  }

  async contribute(user: string, profile: string, id: string, dto: ContributionDto) {
    await this.profiles.assertOwnership(user, profile);
    if (!await this.goals.find(profile, id)) throw new NotFoundException('Meta não encontrada.');
    const item = await this.goals.contribute(profile, id, this.positive(dto.valor), new Date(dto.dataHora));
    return { id: item.id, metaId: item.metaId, valor: item.valor.toFixed(2), dataHora: item.dataHora.toISOString() };
  }

  async contributions(user: string, profile: string, id: string) {
    await this.profiles.assertOwnership(user, profile);
    if (!await this.goals.find(profile, id)) throw new NotFoundException('Meta não encontrada.');
    const items = await this.goals.contributions(profile, id);
    return items.map((item) => ({ id: item.id, metaId: item.metaId,
      valor: item.valor.toFixed(2), dataHora: item.dataHora.toISOString() }));
  }
}
