import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '../src/generated/prisma/client';
import { AutomationRulesService } from '../src/modules/automation-rules/automation-rules.service';
import { AutomationRulesRepository } from '../src/modules/automation-rules/automation-rules.repository';
import { CategoriesRepository } from '../src/modules/categories/categories.repository';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { BudgetsService } from '../src/modules/budgets/budgets.service';
import { BudgetsRepository } from '../src/modules/budgets/budgets.repository';
import { UsersRepository } from '../src/modules/users/users.repository';

describe('US20: escopo, precedência e ownership', () => {
  const tx = {} as Prisma.TransactionClient;
  const repo = { matching: jest.fn(), transaction: jest.fn(), lock: jest.fn(), create: jest.fn(), list: jest.fn() };
  const ownership = jest.fn();
  const service = new AutomationRulesService(repo as unknown as AutomationRulesRepository, { assertOwnership: ownership } as unknown as ProfilesService, {} as CategoriesRepository);
  beforeEach(() => { jest.resetAllMocks(); ownership.mockResolvedValue({}); repo.transaction.mockImplementation((fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)); });
  it('subcategoria ganha da categoria para o mesmo atributo', async () => {
    repo.matching.mockResolvedValue([{ categoriaId: 'category', subcategoriaId: null, valorDestino: 'ESSENCIAL' }, { categoriaId: null, subcategoriaId: 'sub', valorDestino: 'NAO_ESSENCIAL' }]);
    expect(await service.resolve('profile', 'category', 'sub')).toBe('NAO_ESSENCIAL');
    repo.matching.mockResolvedValue([{ categoriaId: 'category', subcategoriaId: null, valorDestino: 'ESSENCIAL' }]);
    expect(await service.resolve('profile', 'category', null)).toBe('ESSENCIAL');
    repo.matching.mockResolvedValue([]); expect(await service.resolve('profile', null, null)).toBeNull();
  });
  it.each([{}, { categoriaId: 'cat', subcategoriaId: 'sub' }])('recusa escopo inválido %j antes de persistir', async scope => {
    await expect(service.save('u', 'p', { ...scope, atributoAlvo: 'essencialidade', valorDestino: 'ESSENCIAL' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('isola CRUD antes de abrir transação/consultar regras', async () => {
    ownership.mockRejectedValue(new ForbiddenException());
    await expect(service.save('u', 'p', { categoriaId: 'cat', atributoAlvo: 'essencialidade', valorDestino: 'ESSENCIAL' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.list('u', 'p')).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.transaction).not.toHaveBeenCalled(); expect(repo.list).not.toHaveBeenCalled();
  });
});

describe('RF71 → US52 → RN-LIM-01: avaliação percentual e limites existentes', () => {
  const ownership = jest.fn();
  const repo = { listRules: jest.fn(), spent: jest.fn(), effectiveIncome: jest.fn(), budgetIncome: jest.fn() };
  const service = new BudgetsService(repo as unknown as BudgetsRepository, { assertOwnership: ownership } as unknown as ProfilesService, {} as UsersRepository);
  const rule = { id: 'r', perfilId: 'p', tipo: 'PERCENTUAL_RENDA', periodo: 'MENSAL', categoriaId: 'cat', valorLimite: null,
    percentualLimite: new Prisma.Decimal(10), baseCalculo: 'RENDA_EFETIVADA', ativa: true, canais: [{ canal: 'PUSH' }], createdAt: new Date(), updatedAt: new Date() };
  beforeEach(() => { jest.resetAllMocks(); ownership.mockResolvedValue({}); repo.spent.mockResolvedValue(new Prisma.Decimal(320));
    repo.effectiveIncome.mockResolvedValue(new Prisma.Decimal(5000)); repo.budgetIncome.mockResolvedValue(new Prisma.Decimal(6000)); });
  it.each([['RENDA_EFETIVADA', '500.00'], ['RENDA_PLANEJADA', '600.00']])('base %s define limite %s', async (baseCalculo, limiteCalculado) => {
    repo.listRules.mockResolvedValue([{ ...rule, baseCalculo }]);
    const result = await service.listRules('u', 'p', new Date('2026-10-14T12:00:00Z'));
    expect(result[0]).toMatchObject({ valorLimite: null, percentualLimite: 10, baseCalculo, avaliacaoAtual: { valorAtual: '320.00', limiteCalculado, violada: false } });
  });
  it('renda zero produz limite zero e avaliação definida, sem divisão por zero', async () => {
    repo.listRules.mockResolvedValue([rule]); repo.effectiveIncome.mockResolvedValue(new Prisma.Decimal(0));
    expect((await service.listRules('u', 'p'))[0]).toMatchObject({ percentualConsumido: null, avaliacaoAtual: { limiteCalculado: '0.00', violada: true } });
  });
  it('mantém gatilho diário no limite e de categoria somente acima do limite', async () => {
    repo.spent.mockResolvedValue(new Prisma.Decimal(30));
    repo.listRules.mockResolvedValue(['LIMITE_DIARIO', 'LIMITE_CATEGORIA'].map(tipo => ({ ...rule, tipo, valorLimite: new Prisma.Decimal(30), percentualLimite: null, baseCalculo: null })));
    expect((await service.listRules('u', 'p')).map(r => r.avaliacaoAtual.violada)).toEqual([true, false]);
  });
});
