import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '../src/generated/prisma/client';
import { Clock } from '../src/common/clock';
import { InsightsService } from '../src/modules/analytics/insights.service';
import { AnalyticsRepository } from '../src/modules/analytics/analytics.repository';
import { CashFlowRepository } from '../src/modules/analytics/cash-flow.repository';
import { CashFlowService } from '../src/modules/analytics/cash-flow.service';
import { dailyAverage, normalizeDescription, spendingTrend } from '../src/modules/analytics/insights-math';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { GoalsService } from '../src/modules/goals/goals.service';
import { GoalsRepository } from '../src/modules/goals/goals.repository';

const D = (value: string | number) => new Prisma.Decimal(value);
const clock = { now: () => new Date('2026-10-14T18:30:00Z') } as Clock;

describe('Parte 2: métricas, tendências e sugestão (US25/35/48)', () => {
  const ownership = jest.fn();
  const data = { openingTotals: jest.fn(), effectiveMovements: jest.fn(), expensesByCategory: jest.fn(), trendCategories: jest.fn(), categoryHistory: jest.fn() };
  const service = new InsightsService(data as unknown as AnalyticsRepository, { assertOwnership: ownership } as unknown as ProfilesService, clock);
  beforeEach(() => { jest.resetAllMocks(); ownership.mockResolvedValue({}); });

  it('saldo anterior influencia o primeiro dia, e dias sem movimento entram na média', () => {
    expect(dailyAverage(D(100), [
      { dataHora: new Date('2026-10-01T12:00:00Z'), tipo: 'DESPESA', valor: D(20) },
      { dataHora: new Date('2026-10-03T23:59:59.999Z'), tipo: 'RECEITA', valor: D(50) },
    ], { start: new Date('2026-10-01T00:00:00Z'), end: new Date('2026-10-04T00:00:00Z') })).toBe('96.67');
  });
  it('taxa de poupança e saldo médio usam receitas/despesas efetivadas do intervalo', async () => {
    data.openingTotals.mockResolvedValue([{ tipo: 'RECEITA', _sum: { valor: D(100) } }]);
    data.effectiveMovements.mockResolvedValue([
      { tipo: 'DESPESA', valor: D(20), dataHora: new Date('2026-10-01T12:00:00Z') },
      { tipo: 'RECEITA', valor: D(50), dataHora: new Date('2026-10-02T12:00:00Z') },
      { tipo: 'DESPESA', valor: D(10), dataHora: new Date('2026-10-02T12:00:00Z') },
    ]);
    expect(await service.metrics('u', 'p', { startDate: '2026-10-01', endDate: '2026-10-02' })).toEqual({
      period: { startDate: '2026-10-01', endDate: '2026-10-02' }, savingsRate: { value: 40, calculable: true }, averageDailyBalance: '100.00',
    });
  });
  it('receita zero é não calculável e o padrão é anual', async () => {
    data.openingTotals.mockResolvedValue([]); data.effectiveMovements.mockResolvedValue([]);
    expect(await service.metrics('u', 'p', {})).toEqual({ period: { startDate: '2026-01-01', endDate: '2026-12-31' }, savingsRate: { value: null, calculable: false }, averageDailyBalance: '0.00' });
    await expect(service.metrics('u', 'p', { startDate: '2026-10-01' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each([[100, 110, 'ESTAVEL', 10], [100, 90, 'ESTAVEL', -10], [100, 111, 'AUMENTANDO', 11], [100, 89, 'DIMINUINDO', -11],
    [0, 0, 'ESTAVEL', null], [0, 10, 'AUMENTANDO', null], [10, 0, 'DIMINUINDO', -100]])('tendência %s→%s', (a, b, trend, variationPercentage) => {
    expect(spendingTrend(D(a), D(b))).toEqual({ trend, variationPercentage });
  });
  it('usa trimestres calendários, incluindo trimestre anterior no outro ano', async () => {
    data.expensesByCategory.mockResolvedValue([]); data.trendCategories.mockResolvedValue([]);
    const january = new InsightsService(data as unknown as AnalyticsRepository, { assertOwnership: ownership } as unknown as ProfilesService,
      { now: () => new Date('2026-01-01T00:00:00Z') } as Clock);
    expect(await january.trends('u', 'p')).toMatchObject({ currentMonth: { startDate: '2026-01-01', partial: true }, referenceQuarter: { startDate: '2025-10-01', endDate: '2025-12-31' } });
  });
  it('RN-MET-04 atualizada: 4500/3 contra 1700 = 13,3333%, sem projetar mês parcial', async () => {
    data.expensesByCategory.mockResolvedValueOnce([{ categoriaId: 'c', _sum: { valor: D(4500) } }]).mockResolvedValueOnce([{ categoriaId: 'c', _sum: { valor: D(1700) } }]);
    data.trendCategories.mockResolvedValue([{ id: 'c', nome: 'Alimentação' }]);
    const result = await service.trends('u', 'p');
    expect(result).toMatchObject({ referenceQuarter: { startDate: '2026-07-01', endDate: '2026-09-30' },
      currentMonth: { startDate: '2026-10-01', asOfDate: '2026-10-14T18:30:00.000Z', partial: true },
      categories: [{ referenceMonthlyAverage: '1500.00', currentMonthTotal: '1700.00', variationPercentage: 13.3333, trend: 'AUMENTANDO' }] });
    expect(data.expensesByCategory).toHaveBeenNthCalledWith(2, 'p', { start: new Date('2026-10-01Z'), end: new Date('2026-10-14T18:30:00.001Z') });
  });
  it.each(['2026-11-30T12:00:00Z', '2028-02-29T12:00:00Z', '2026-12-31T23:59:59Z'])('marca mês fechado no último dia civil %s', async instant => {
    data.expensesByCategory.mockResolvedValue([]); data.trendCategories.mockResolvedValue([]);
    const result = await new InsightsService(data as unknown as AnalyticsRepository, { assertOwnership: ownership } as unknown as ProfilesService,
      { now: () => new Date(instant) } as Clock).trends('u', 'p');
    expect(result.currentMonth.partial).toBe(false);
    expect(data.expensesByCategory.mock.calls[1][1].end.getTime()).toBe(new Date(instant).getTime() + 1);
  });
  it('mês intermediário do trimestre não inclui os outros meses correntes e meses vazios dividem por três', async () => {
    data.expensesByCategory.mockResolvedValueOnce([{ categoriaId: 'c', _sum: { valor: D(300) } }]).mockResolvedValueOnce([]);
    data.trendCategories.mockResolvedValue([{ id: 'c', nome: 'Categoria' }]);
    const result = await new InsightsService(data as unknown as AnalyticsRepository, { assertOwnership: ownership } as unknown as ProfilesService,
      { now: () => new Date('2026-11-15T00:00:00Z') } as Clock).trends('u', 'p');
    expect(result.referenceQuarter).toEqual({ startDate: '2026-07-01', endDate: '2026-09-30' });
    expect(result.currentMonth.startDate).toBe('2026-11-01');
    expect(result.categories[0]).toMatchObject({ referenceMonthlyAverage: '100.00', currentMonthTotal: '0.00', trend: 'DIMINUINDO' });
  });
  it('normaliza espaços/caixa e sugere a categoria mais recorrente, refletindo correção futura', async () => {
    expect(normalizeDescription('  UBER \t viagem  ')).toBe('uber viagem');
    const a = { descricao: 'Uber viagem', categoria: { id: 'a', nome: 'Transporte' } };
    const b = { descricao: ' UBER  viagem ', categoria: { id: 'b', nome: 'Outra' } };
    data.categoryHistory.mockResolvedValue([a, a, b]);
    expect(await service.suggest('u', 'p', ' uber VIAGEM ')).toEqual({ suggested: true, category: a.categoria });
    data.categoryHistory.mockResolvedValue([a, b, b]);
    expect((await service.suggest('u', 'p', 'Uber viagem')).category).toEqual(b.categoria);
    expect(await service.suggest('u', 'p', 'Sem histórico')).toEqual({ suggested: false, category: null });
    data.categoryHistory.mockResolvedValue([a, b]);
    expect(await service.suggest('u', 'p', 'Uber viagem')).toEqual({ suggested: false, category: null });
  });
  it('ownership antecede qualquer consulta mesmo em leituras/cálculos', async () => {
    ownership.mockRejectedValue(new ForbiddenException());
    await expect(service.metrics('u', 'p', {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.trends('u', 'p')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.suggest('u', 'p', 'Uber')).rejects.toBeInstanceOf(ForbiddenException);
    for (const fn of Object.values(data)) expect(fn).not.toHaveBeenCalled();
  });
});

describe('US32: projeção sem persistência', () => {
  const inputs = jest.fn(); const totals = jest.fn(); const ownership = jest.fn();
  const service = new CashFlowService({ inputs } as unknown as CashFlowRepository, { totals } as unknown as AnalyticsRepository,
    { assertOwnership: ownership } as unknown as ProfilesService, clock);
  beforeEach(() => { jest.resetAllMocks(); ownership.mockResolvedValue({}); totals.mockResolvedValue([{ tipo: 'RECEITA', _sum: { valor: D(100) } }]); });
  it('deduplica ocorrência materializada e inclui mais de uma ocorrência futura da recorrência', async () => {
    inputs.mockResolvedValue([
      [{ id: 't', tipo: 'DESPESA', valor: D(10), descricao: 'Semana', dataHora: new Date('2026-10-15T12:00:00Z'), categoriaId: null, recorrenciaId: 'r' }],
      [{ id: 'r', tipoTransacao: 'DESPESA', valor: D(10), descricao: 'Semana', categoriaId: null, frequencia: 'SEMANAL', proximaOcorrencia: new Date('2026-10-15T12:00:00Z'), dataTermino: null }],
      [{ recorrenciaId: 'r', ocorrenciaReferencia: new Date('2026-10-15T12:00:00Z') }],
    ]);
    const result = await service.projection('u', 'p');
    expect(result.saldoAtual).toBe('100.00');
    expect(result.next30Days).toMatchObject({ startDate: '2026-10-14', endDate: '2026-11-12', saidasPrevistas: '50.00', saldoProjetadoFinal: '50.00' });
    expect(result.next30Days.movimentos).toHaveLength(5); expect(result.saldoProjetadoFimMes).toBe('70.00');
  });
  it('ocorrência EFETIVADA já gerada também não é projetada novamente', async () => {
    inputs.mockResolvedValue([[], [{ id: 'r', tipoTransacao: 'DESPESA', valor: D(10), descricao: 'Única', categoriaId: null,
      frequencia: 'MENSAL', proximaOcorrencia: new Date('2026-10-15T12:00:00Z'), dataTermino: new Date('2026-10-15T00:00:00Z') }],
    [{ recorrenciaId: 'r', ocorrenciaReferencia: new Date('2026-10-15T12:00:00Z') }]]);
    expect((await service.projection('u', 'p')).next30Days.movimentos).toEqual([]);
  });
  it('isola projeções antes de consultar recorrências ou saldo', async () => {
    ownership.mockRejectedValue(new ForbiddenException());
    await expect(service.projection('u', 'p')).rejects.toBeInstanceOf(ForbiddenException);
    expect(inputs).not.toHaveBeenCalled(); expect(totals).not.toHaveBeenCalled();
  });
});

describe('US58: taxa histórica de metas', () => {
  const closedGoals = jest.fn(); const ownership = jest.fn();
  const service = new GoalsService({ closedGoals } as unknown as GoalsRepository, { assertOwnership: ownership } as unknown as ProfilesService, clock);
  beforeEach(() => { jest.resetAllMocks(); ownership.mockResolvedValue({}); });
  it.each(['6m', '12m'] as const)('janela %s considera apenas aportes até o fim do prazo', async window => {
    closedGoals.mockResolvedValue([
      { valorAlvo: D(100), dataLimite: new Date('2026-10-01T00:00:00Z'), aportes: [{ valor: D(100), dataHora: new Date('2026-10-01T23:59:59.999Z') }] },
      { valorAlvo: D(100), dataLimite: new Date('2026-10-01T00:00:00Z'), aportes: [{ valor: D(100), dataHora: new Date('2026-10-02T00:00:00Z') }] },
    ]);
    expect(await service.completionRate('u', 'p', window)).toMatchObject({ window, startDate: window === '6m' ? '2026-04-14' : '2025-10-14', endDate: '2026-10-14', closedGoals: 2, completedGoals: 1, completionRate: 50 });
    expect(closedGoals).toHaveBeenCalledWith('p', expect.any(Date), new Date('2026-10-14T00:00:00Z'));
  });
  it('nenhuma meta encerrada retorna taxa não calculável, sem NaN ou zero artificial', async () => {
    closedGoals.mockResolvedValue([]); expect((await service.completionRate('u', 'p', '6m')).completionRate).toBeNull();
  });
  it('recusa janela inválida e perfil alheio', async () => {
    await expect(service.completionRate('u', 'p', '2m' as '6m')).rejects.toBeInstanceOf(BadRequestException);
    ownership.mockRejectedValue(new ForbiddenException());
    await expect(service.completionRate('u', 'p', '6m')).rejects.toBeInstanceOf(ForbiddenException);
    expect(closedGoals).not.toHaveBeenCalled();
  });
});
