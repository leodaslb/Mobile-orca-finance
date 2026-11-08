import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DesafioEconomia, Prisma } from '../../generated/prisma/client';
import { Clock } from '../../common/clock';
import { ProfilesService } from '../profiles/profiles.service';
import { EssentialExpenseChallengesRepository } from './essential-expense-challenges.repository';
import { challengeProgress, challengeProposal, rankChallengeCandidates } from './challenge-math';
import { challengeSuggestions } from './challenge-suggestions';
import { BudgetsRepository, DateRange } from '../budgets/budgets.repository';
import { monthlyPeriod } from '../budgets/planning-period';
import { CreateEssentialExpenseChallengeDto, UpdateEssentialExpenseChallengeDto } from './challenge.dto';

type Challenge = DesafioEconomia & { categoria: { id: string; nome: string } | null };
@Injectable()
export class EssentialExpenseChallengesService {
  constructor(private readonly data: EssentialExpenseChallengesRepository, private readonly profiles: ProfilesService, private readonly clock: Clock,
    private readonly budgets: BudgetsRepository) {}

  private periods(now: Date) {
    const baseline = monthlyPeriod(now.getUTCFullYear(), now.getUTCMonth() + 1);
    const challenge = monthlyPeriod(baseline.end.getUTCFullYear(), baseline.end.getUTCMonth() + 1);
    return { baseline, challenge };
  }
  private async proposals(profile: string, range: DateRange, tx?: Prisma.TransactionClient) {
    const [monthly, sums, essential] = await Promise.all([
      this.budgets.findMonthly(profile, range.start, new Date(range.end.getTime() - 86400000), tx),
      this.budgets.spentByCategory(profile, range, tx), this.data.essentialCategories(profile, range, tx),
    ]);
    if (monthly.length > 1) throw new ConflictException('Há múltiplos orçamentos mensais para este perfil e mês.');
    const budget = monthly[0]; if (!budget?.ativo) return [];
    const eligible = new Set(essential.map(r => r.categoriaId));
    const spent = new Map(sums.map(r => [r.categoriaId, r._sum.valor ?? new Prisma.Decimal(0)]));
    return budget.orcamentoCategorias.flatMap(row => {
      if (!eligible.has(row.categoriaId)) return [];
      const proposal = challengeProposal(row.valorPlanejado, spent.get(row.categoriaId) ?? new Prisma.Decimal(0));
      return proposal ? [{ categoriaId: row.categoriaId, categoriaNome: row.categoria.nome, ...proposal }] : [];
    });
  }
  async candidates(user: string, profile: string) {
    await this.profiles.assertOwnership(user, profile);
    const { baseline, challenge } = this.periods(this.clock.now());
    const period = (range: DateRange) => ({ startDate: range.start.toISOString().slice(0, 10), endDate: new Date(range.end.getTime() - 86400000).toISOString().slice(0, 10) });
    return { baseline: period(baseline), challengePeriod: period(challenge), candidates: rankChallengeCandidates(await this.proposals(profile, baseline)).map(row => ({
      categoriaId: row.categoriaId, categoriaNome: row.categoriaNome, valorPlanejado: row.planned.toFixed(2), valorRealizado: row.realized.toFixed(2),
      valorExcedente: row.excess.toFixed(2), percentualEstouro: row.overspend.toDecimalPlaces(4).toNumber(),
      percentualReducaoNecessaria: row.needed.toDecimalPlaces(4).toNumber(), percentualReducaoSugerida: row.suggested.toDecimalPlaces(4).toNumber(),
      valorMetaSugerido: row.target.toFixed(2),
    })) };
  }
  async create(user: string, profile: string, dto: CreateEssentialExpenseChallengeDto) {
    await this.profiles.assertOwnership(user, profile);
    const id = await this.data.transaction(async tx => {
      await this.data.lockProfile(profile, tx);
      const now = this.clock.now(); const { baseline, challenge } = this.periods(now);
      const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z');
      // Um aceite reserva o desafio, inclusive quando o período começa no próximo mês.
      if (await this.data.active(profile, dto.categoriaId.toLowerCase(), today, tx)) throw new ConflictException('Já existe desafio ativo nesta categoria do perfil.');
      const selected = (await this.proposals(profile, baseline, tx)).find(row => row.categoriaId === dto.categoriaId.toLowerCase());
      if (!selected) throw new BadRequestException('Categoria sem orçamento mensal elegível ou sem estouro mínimo de 5%.');
      if (selected.realized.greaterThan('99999999999999999.99')) throw new BadRequestException('Valor de referência excede a capacidade monetária do desafio.');
      return (await this.data.create(profile, { categoriaId: selected.categoriaId, valorAlvo: null, valorReferencia: selected.realized,
        valorMetaPeriodo: selected.target, percentualReducao: selected.suggested.toDecimalPlaces(4), nome: null,
        dataInicio: challenge.start, dataFim: new Date(challenge.end.getTime() - 86400000) }, tx)).id;
    });
    return this.detail(user, profile, id);
  }
  async update(user: string, profile: string, id: string, dto: UpdateEssentialExpenseChallengeDto) {
    await this.profiles.assertOwnership(user, profile);
    if (typeof dto.nome !== 'string' || !dto.nome.trim()) throw new BadRequestException('Nome obrigatório.');
    await this.data.transaction(async tx => {
      await this.data.lockProfile(profile, tx);
      if (!await this.data.find(profile, id, tx)) throw new NotFoundException('Desafio de despesas essenciais não encontrado.');
      await this.data.updateName(profile, id, dto.nome, tx);
    });
    return this.detail(user, profile, id);
  }
  private required(row: Challenge) {
    if (!row.categoriaId || !row.categoria || !row.valorReferencia?.greaterThan(0) || !row.valorMetaPeriodo?.greaterThan(0) || row.percentualReducao === null) {
      throw new InternalServerErrorException('Desafio de despesas essenciais inconsistente.');
    }
    return { category: row.categoria, reference: row.valorReferencia, target: row.valorMetaPeriodo, reduction: row.percentualReducao };
  }
  private async present(profile: string, row: Challenge) {
    const { category, reference, target, reduction } = this.required(row);
    const spent = await this.data.spending(profile, category.id, { start: row.dataInicio, end: new Date(row.dataFim.getTime() + 86400000) });
    return { id: row.id, perfilId: row.perfilId, nome: row.nome, categoriaId: category.id, categoriaNome: category.nome,
      dataInicio: row.dataInicio.toISOString().slice(0, 10), dataFim: row.dataFim.toISOString().slice(0, 10),
      percentualReducao: reduction.toNumber(), ...challengeProgress(reference, target, spent, row.dataFim, this.clock.now()),
      createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }
  async list(user: string, profile: string) {
    await this.profiles.assertOwnership(user, profile);
    return Promise.all((await this.data.list(profile)).map(row => this.present(profile, row)));
  }
  private async find(profile: string, id: string) {
    const row = await this.data.find(profile, id);
    if (!row) throw new NotFoundException('Desafio de despesas essenciais não encontrado.');
    return row;
  }
  async detail(user: string, profile: string, id: string) {
    await this.profiles.assertOwnership(user, profile);
    return this.present(profile, await this.find(profile, id));
  }
  async suggestions(user: string, profile: string, id: string) {
    await this.profiles.assertOwnership(user, profile);
    const row = await this.find(profile, id); const { category, reference, target, reduction } = this.required(row);
    // O mês imediatamente anterior ao desafio é o período que o originou.
    const start = new Date(row.dataInicio); start.setUTCMonth(start.getUTCMonth() - 1);
    const history = await this.data.history(profile, category.id, { start, end: row.dataInicio });
    return { challengeId: row.id, category: { id: category.id, name: category.nome },
      target: { valorReferencia: reference.toFixed(2), valorMeta: target.toFixed(2), percentualReducao: reduction.toNumber() },
      suggestions: challengeSuggestions(reference, target, history) };
  }
}
