import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '../src/generated/prisma/client';
import { CalculationsService } from '../src/modules/calculations/calculations.service';
import { installmentValues, SimulationsService } from '../src/modules/simulations/simulations.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { CategoriesRepository } from '../src/modules/categories/categories.repository';
import { BudgetsService } from '../src/modules/budgets/budgets.service';
import { AnalyticsRepository } from '../src/modules/analytics/analytics.repository';
import { CashFlowService } from '../src/modules/analytics/cash-flow.service';
import { LargePurchasePlansService } from '../src/modules/large-purchase-plans/large-purchase-plans.service';
import { LargePurchasePlansRepository } from '../src/modules/large-purchase-plans/large-purchase-plans.repository';

describe('US31: cálculos Decimal sem persistência', () => {
  const service = new CalculationsService();
  it('converte taxa percentual por período e calcula juros compostos', () => {
    expect(service.compound({ valorInicial: '1000.00', taxaPercentual: 1, quantidadePeriodos: 12 })).toEqual({ valorInicial: '1000.00', valorFuturo: '1126.83', jurosAcumulados: '126.83', taxaPercentual: 1, quantidadePeriodos: 12 });
  });
  it('custo de oportunidade usa o cálculo exato corrigido do exemplo', () => {
    expect(service.opportunity({ valorGastoHipotetico: '3000.00', taxaRetornoPercentual: 0.8, quantidadePeriodos: 24 })).toEqual({ valorGastoHipotetico: '3000.00', valorFuturoHipotetico: '3632.24', ganhoHipotetico: '632.24' });
  });
  it.each([0, 12])('taxa zero não altera o valor em %s períodos', quantidadePeriodos => {
    expect(service.compound({ valorInicial: '123.45', taxaPercentual: 0, quantidadePeriodos }).valorFuturo).toBe('123.45');
  });
  it.each([{ valorInicial: '-1', taxaPercentual: 1, quantidadePeriodos: 1 }, { valorInicial: '1', taxaPercentual: -101, quantidadePeriodos: 1 },
    { valorInicial: '1', taxaPercentual: 1, quantidadePeriodos: 0.5 }, { valorInicial: '1', taxaPercentual: 100, quantidadePeriodos: 10000 }])('recusa parâmetros ou resultado não representável: %j', dto => {
    expect(() => service.compound(dto)).toThrow(BadRequestException);
  });
});

describe('US27: simulação isolada e não persistente', () => {
  it('mantém a soma exata dos centavos nas parcelas', () => {
    const values = installmentValues(new Prisma.Decimal(100), 3);
    expect(values.map(v => v.toFixed(2))).toEqual(['33.34', '33.33', '33.33']);
    expect(values.reduce((s, n) => s.plus(n), new Prisma.Decimal(0)).toFixed(2)).toBe('100.00');
  });
  const ownership = jest.fn(); const effectiveMovements = jest.fn(); const movements = jest.fn(); const simulationImpact = jest.fn(); const findCategory = jest.fn();
  const service = new SimulationsService({ assertOwnership: ownership } as unknown as ProfilesService, { findCategory } as unknown as CategoriesRepository,
    { simulationImpact } as unknown as BudgetsService, { effectiveMovements } as unknown as AnalyticsRepository, { movements } as unknown as CashFlowService);
  beforeEach(() => { jest.resetAllMocks(); ownership.mockResolvedValue({}); findCategory.mockResolvedValue({ id: 'cat' });
    effectiveMovements.mockResolvedValue([{ tipo: 'RECEITA', valor: new Prisma.Decimal(1000) }]); movements.mockResolvedValue([]); simulationImpact.mockResolvedValue(null); });
  it('simula compra à vista sem categoria e sem orçamento aplicável', async () => {
    const result = await service.purchase('u', 'p', { valor: '100', parcelas: 1, dataPrimeiraParcela: '2026-11-01' });
    expect(result).toMatchObject({ criaTransacoes: false, meses: [{ competencia: '2026-11', valorParcela: '100.00', rendaProjetada: '1000.00', percentualRendaComprometida: 10, impactoOrcamentoCategoria: null }] });
    expect(simulationImpact).not.toHaveBeenCalled();
  });
  it('cruza o ano, usa a consulta compartilhada de orçamento e não divide por renda zero', async () => {
    effectiveMovements.mockResolvedValue([]); simulationImpact.mockResolvedValue({ valorPlanejado: '200.00', valorProjetadoComCompra: '100.00', percentualProjetado: 50 });
    const result = await service.purchase('u', 'p', { valor: '200', parcelas: 2, dataPrimeiraParcela: '2026-12-31', categoriaId: 'cat' });
    expect(result.meses.map(m => m.competencia)).toEqual(['2026-12', '2027-01']);
    expect(result.meses[0].percentualRendaComprometida).toBeNull(); expect(simulationImpact).toHaveBeenCalledTimes(2);
  });
  it('ownership e valor inválido impedem consultas financeiras', async () => {
    await expect(service.purchase('u', 'p', { valor: '0', parcelas: 1, dataPrimeiraParcela: '2026-11-01' })).rejects.toBeInstanceOf(BadRequestException);
    ownership.mockRejectedValue(new ForbiddenException());
    await expect(service.purchase('u', 'p', { valor: '1', parcelas: 1, dataPrimeiraParcela: '2026-11-01' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(effectiveMovements).not.toHaveBeenCalled(); expect(movements).not.toHaveBeenCalled();
  });
});

describe('US51: planos e prazo derivado', () => {
  const create = jest.fn(); const list = jest.fn(); const ownership = jest.fn();
  const service = new LargePurchasePlansService({ create, list } as unknown as LargePurchasePlansRepository, { assertOwnership: ownership } as unknown as ProfilesService);
  beforeEach(() => { jest.resetAllMocks(); ownership.mockResolvedValue({}); });
  it('arredonda prazo para cima e não persiste o campo derivado', async () => {
    const row = { id: 'plan', perfilId: 'p', nome: 'Notebook', valorTotal: new Prisma.Decimal(100), valorMensalPlanejado: new Prisma.Decimal(30), dataInicio: new Date('2026-11-01T00:00:00Z'), createdAt: new Date(), updatedAt: new Date() };
    create.mockResolvedValue(row);
    expect((await service.create('u', 'p', { nome: 'Notebook', valorTotal: '100', valorMensalPlanejado: '30', dataInicio: '2026-11-01' })).quantidadeMesesEstimada).toBe(4);
    expect(create.mock.calls[0][1]).not.toHaveProperty('quantidadeMesesEstimada');
    list.mockResolvedValue([{ ...row, valorMensalPlanejado: null }]); expect((await service.list('u', 'p'))[0].quantidadeMesesEstimada).toBeNull();
  });
  it('recusa valor mensal zero e perfil de outra conta', async () => {
    await expect(service.create('u', 'p', { nome: 'Compra', valorTotal: '100', valorMensalPlanejado: '0', dataInicio: '2026-11-01' })).rejects.toBeInstanceOf(BadRequestException);
    ownership.mockRejectedValue(new ForbiddenException()); await expect(service.list('u', 'p')).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).not.toHaveBeenCalled(); expect(list).not.toHaveBeenCalled();
  });
});
