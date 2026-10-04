import { BadRequestException } from '@nestjs/common';
import { Prisma, PeriodoRegra } from '../src/generated/prisma/client';
import { budgetMetrics } from '../src/modules/budgets/budget-metrics';
import { monthlyPeriod, rulePeriod } from '../src/modules/budgets/planning-period';
import { BudgetsService } from '../src/modules/budgets/budgets.service';
import { BudgetsRepository } from '../src/modules/budgets/budgets.repository';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { CreateSpendingRuleDto, UpdateSpendingRuleDto } from '../src/modules/budgets/dto/spending-rule.dto';

describe('Planejamento: RF03/24/27/54/55/57', () => {
  it.each([
    ['74.99', 'NORMAL'], ['75', 'PROXIMO_LIMITE'], ['100', 'PROXIMO_LIMITE'], ['100.01', 'EXCEDIDO'],
  ])('RN-ORC-01: %s%% → %s', (value, estado) => {
    const result = budgetMetrics(new Prisma.Decimal(100), new Prisma.Decimal(value));
    expect(result.estado).toBe(estado);
    expect(result.percentualConsumido).toBe(new Prisma.Decimal(value).toFixed(2));
    expect(result.desvio).toBe(new Prisma.Decimal(value).minus(100).toFixed(2));
  });

  it('não arredonda o percentual antes de escolher o estado', () => {
    expect(budgetMetrics(new Prisma.Decimal(10000), new Prisma.Decimal('7499.99')))
      .toMatchObject({ percentualConsumido: '75.00', estado: 'NORMAL' });
  });

  it('mantém estado/percentual indefinidos para planejado zero sem inventar RN', () => {
    expect(budgetMetrics(new Prisma.Decimal(0), new Prisma.Decimal(10)))
      .toMatchObject({ estado: null, percentualConsumido: null, desvio: '10.00' });
  });

  it.each([
    ['DIARIO', '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z'],
    ['SEMANAL', '2026-09-28T00:00:00.000Z', '2026-10-05T00:00:00.000Z'],
    ['MENSAL', '2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z'],
    ['ANUAL', '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z'],
  ])('delimita %s sem depender do fuso do host', (periodo, inicio, fim) => {
    const result = rulePeriod(periodo as PeriodoRegra, new Date('2026-10-01T12:00:00Z'));
    expect(result.start.toISOString()).toBe(inicio);
    expect(result.end.toISOString()).toBe(fim);
  });

  it('considera fevereiro bissexto e a virada do ano', () => {
    expect(monthlyPeriod(2024, 2).end.toISOString()).toBe('2024-03-01T00:00:00.000Z');
    expect(monthlyPeriod(2026, 12).end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it.each([[2026, 0], [2026, 13], [0, 1]])('recusa ano/mês inválido: %s/%s', (year, month) => {
    expect(() => monthlyPeriod(year, month)).toThrow(BadRequestException);
  });

  const createRule = jest.fn();
  const transaction = jest.fn();
  let service: BudgetsService;
  beforeEach(() => {
    createRule.mockReset();
    transaction.mockReset().mockImplementation((operation: (tx: Prisma.TransactionClient) => Promise<unknown>) => operation({} as Prisma.TransactionClient));
    const repo = { transaction, createRule, categories: jest.fn().mockResolvedValue([]) } as unknown as BudgetsRepository;
    service = new BudgetsService(repo, { assertOwnership: jest.fn().mockResolvedValue({}) } as unknown as ProfilesService,
      { findById: jest.fn().mockResolvedValue(null) } as unknown as UsersRepository);
  });

  it('recusa categoria duplicada antes da escrita multi-tabela', async () => {
    await expect(service.putMonthly('user', 'profile', 2026, 9, { categorias: [
      { categoriaId: 'categoria', valorPlanejado: '10' }, { categoriaId: 'categoria', valorPlanejado: '20' },
    ] })).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([
    { tipo: 'LIMITE_DIARIO', periodo: 'MENSAL', valorLimite: '10', canais: ['PUSH'] },
    { tipo: 'LIMITE_DIARIO', periodo: 'DIARIO', categoriaId: 'categoria', valorLimite: '10', canais: ['PUSH'] },
    { tipo: 'LIMITE_CATEGORIA', periodo: 'MENSAL', valorLimite: '10', canais: ['PUSH'] },
    { tipo: 'LIMITE_DIARIO', periodo: 'DIARIO', valorLimite: '0', canais: ['PUSH'] },
    { tipo: 'PERCENTUAL_RENDA', periodo: 'MENSAL', valorLimite: '10', canais: ['PUSH'] },
  ])('recusa combinação fora das RN/escopo: %j', async (dto) => {
    await expect(service.createRule('user', 'profile', dto as CreateSpendingRuleDto)).rejects.toBeInstanceOf(BadRequestException);
    expect(createRule).not.toHaveBeenCalled();
  });

  it('RN-NOT-02: EMAIL exige endereço associado', async () => {
    await expect(service.createRule('user', 'profile', {
      tipo: 'LIMITE_DIARIO', periodo: 'DIARIO', valorLimite: '10', canais: ['EMAIL'],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(createRule).not.toHaveBeenCalled();
  });

  it('recusa PATCH vazio mesmo após transformação em DTO com campos undefined', async () => {
    await expect(service.updateRule('user', 'profile', 'rule', new UpdateSpendingRuleDto()))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
