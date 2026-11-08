import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Orcamento, OrcamentoCategoria, Prisma } from '../src/generated/prisma/client';
import { BudgetsRepository } from '../src/modules/budgets/budgets.repository';
import { BudgetsService } from '../src/modules/budgets/budgets.service';
import { BudgetQueryDto, CreateBudgetDto, UpdateBudgetDto } from '../src/modules/budgets/dto/budget.dto';
import { budgetPeriod } from '../src/modules/budgets/budget-period';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { UsersRepository } from '../src/modules/users/users.repository';

describe('RF34/42/63/46 → US07/09: orçamentos', () => {
  const category = 'ddc2723e-0070-430c-af6e-83e788862ea8';
  const tx = {} as Prisma.TransactionClient;
  const ownership = jest.fn();
  const repo = { transaction: jest.fn(), lockProfile: jest.fn(), categories: jest.fn(), createBudget: jest.fn(),
    replaceCategories: jest.fn(), findBudget: jest.fn(), budgetSpending: jest.fn(), budgetIncome: jest.fn(),
    listBudgets: jest.fn(), linkedTransactions: jest.fn(), updateBudget: jest.fn(), lockTransaction: jest.fn(),
    findTransaction: jest.fn(), linkTransaction: jest.fn(), unlinkTransaction: jest.fn(), findMonthly: jest.fn() };
  const service = new BudgetsService(repo as unknown as BudgetsRepository,
    { assertOwnership: ownership } as unknown as ProfilesService, {} as UsersRepository);
  let budget: Orcamento & { orcamentoCategorias: OrcamentoCategoria[] };
  const body: CreateBudgetDto = { tipo: 'EVENTO', dataInicio: '2026-10-01', dataFim: '2026-10-31',
    categorias: [{ categoriaId: category, valorPlanejado: '100.00' }] };

  beforeEach(() => {
    jest.resetAllMocks(); ownership.mockResolvedValue({});
    repo.transaction.mockImplementation((operation: (client: Prisma.TransactionClient) => Promise<unknown>) => operation(tx));
    budget = { id: 'budget', perfilId: 'profile', nome: null, tipo: 'EVENTO', ativo: true,
      dataInicio: new Date('2026-10-01T00:00:00Z'), dataFim: new Date('2026-10-31T00:00:00Z'),
      createdAt: new Date('2026-10-01T12:00:00Z'), updatedAt: new Date('2026-10-01T12:00:00Z'),
      orcamentoCategorias: [{ id: 'planned', orcamentoId: 'budget', categoriaId: category, valorPlanejado: new Prisma.Decimal(100),
        createdAt: new Date(), updatedAt: new Date() }] };
    repo.createBudget.mockResolvedValue(budget); repo.findBudget.mockImplementation(async () => budget);
    repo.categories.mockResolvedValue([{ id: category, ativa: true }]); repo.budgetSpending.mockResolvedValue([]);
    repo.budgetIncome.mockResolvedValue(new Prisma.Decimal(100)); repo.linkedTransactions.mockResolvedValue([]);
    repo.findTransaction.mockResolvedValue({ id: 'transaction' }); repo.listBudgets.mockResolvedValue([budget]);
    repo.findMonthly.mockResolvedValue([]);
  });

  it.each(['PERIODO', 'TEMPORARIO', 'EVENTO'] as const)('cria %s com planejamento Decimal na mesma transação', async (tipo) => {
    budget.tipo = tipo;
    expect(await service.createBudget('user', 'profile', { ...body, tipo })).toMatchObject({ tipo, nome: null,
      categorias: [{ categoriaId: category, valorPlanejado: '100.00', valorRealizado: '0.00' }] });
    expect(repo.replaceCategories).toHaveBeenCalledWith('budget', [{ categoriaId: category, valorPlanejado: new Prisma.Decimal(100) }], tx);
  });

  it('não persiste orçamento quando uma categoria está duplicada, mesmo com UUID em caixa diferente', async () => {
    await expect(service.createBudget('user', 'profile', { ...body, categorias: [body.categorias[0],
      { ...body.categorias[0], categoriaId: category.toUpperCase() }] })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createBudget).not.toHaveBeenCalled();
  });

  it('MENSAL duplicado retorna conflito antes de gravar, após adquirir lock do perfil', async () => {
    repo.findMonthly.mockResolvedValue([{ id: 'existing', ativo: false }]);
    await expect(service.createBudget('user', 'profile', { ...body, tipo: 'MENSAL' })).rejects.toBeInstanceOf(ConflictException);
    expect(repo.lockProfile.mock.invocationCallOrder[0]).toBeLessThan(repo.findMonthly.mock.invocationCallOrder[0]);
    expect(repo.findMonthly).toHaveBeenCalledWith('profile', new Date('2026-10-01T00:00:00Z'), new Date('2026-10-31T00:00:00Z'), tx);
    expect(repo.createBudget).not.toHaveBeenCalled(); expect(repo.replaceCategories).not.toHaveBeenCalled();
  });

  it('permite criar MENSAL quando não há outro no mesmo intervalo', async () => {
    budget.tipo = 'MENSAL';
    expect((await service.createBudget('user', 'profile', { ...body, tipo: 'MENSAL' })).tipo).toBe('MENSAL');
    expect(repo.createBudget).toHaveBeenCalledTimes(1);
  });

  it('permite editar o próprio MENSAL sem tratá-lo como duplicata', async () => {
    budget.tipo = 'MENSAL'; repo.findMonthly.mockResolvedValue([budget]);
    await service.updateBudget('user', 'profile', 'budget', { nome: 'Renomeado' });
    expect(repo.updateBudget).toHaveBeenCalledWith('profile', 'budget', expect.objectContaining({ nome: 'Renomeado' }), tx);
  });

  it('PATCH MENSAL não pode mover o período para outro já ocupado', async () => {
    budget.tipo = 'MENSAL'; repo.findMonthly.mockResolvedValue([{ id: 'another' }]);
    await expect(service.updateBudget('user', 'profile', 'budget', { dataInicio: '2026-11-01', dataFim: '2026-11-30', categorias: body.categorias }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(repo.updateBudget).not.toHaveBeenCalled(); expect(repo.replaceCategories).not.toHaveBeenCalled();
  });

  it.each(['PERIODO', 'TEMPORARIO', 'EVENTO', 'ZERO_BASED'] as const)('preserva coexistência de %s sem aplicar unicidade mensal', async (tipo) => {
    budget.tipo = tipo;
    await service.createBudget('user', 'profile', { ...body, tipo });
    await service.updateBudget('user', 'profile', 'budget', { nome: 'Outro contexto' });
    expect(repo.findMonthly).not.toHaveBeenCalled();
  });

  it.each(['0', '-1'])('valor planejado %s é rejeitado antes de gravar orçamento', async (valorPlanejado) => {
    await expect(service.createBudget('user', 'profile', { ...body, categorias: [{ categoriaId: category, valorPlanejado }] }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createBudget).not.toHaveBeenCalled();
  });

  it('recusa categoria inexistente/inativa para nova associação', async () => {
    repo.categories.mockResolvedValue([]);
    await expect(service.createBudget('user', 'profile', body)).rejects.toBeInstanceOf(BadRequestException);
    repo.categories.mockResolvedValue([{ id: category, ativa: false }]);
    await expect(service.createBudget('user', 'profile', body)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.createBudget).not.toHaveBeenCalled();
  });

  it('preserva associação histórica inativa na edição e serializa a leitura com o perfil', async () => {
    repo.categories.mockResolvedValue([{ id: category, ativa: false }]);
    await service.updateBudget('user', 'profile', 'budget', { categorias: body.categorias, ativo: false });
    expect(repo.lockProfile.mock.invocationCallOrder[0]).toBeLessThan(repo.findBudget.mock.invocationCallOrder[0]);
    expect(repo.updateBudget).toHaveBeenCalledWith('profile', 'budget', expect.objectContaining({ ativo: false }), tx);
  });

  it.each(['2026-02-30', '0000-01-01', '2026-1-01'])('data %s não é normalizada silenciosamente', (date) => {
    expect(() => budgetPeriod(date, '2026-12-31')).toThrow(BadRequestException);
  });

  it('inclui o último dia e considera fevereiro bissexto', () => {
    expect(budgetPeriod('2024-02-01', '2024-02-29')).toEqual({ start: new Date('2024-02-01T00:00:00Z'), end: new Date('2024-03-01T00:00:00Z') });
    expect(() => budgetPeriod('2026-10-31', '2026-10-01')).toThrow(BadRequestException);
  });

  it.each([['74.99', 'NORMAL'], ['75', 'PROXIMO_LIMITE'], ['100', 'PROXIMO_LIMITE'], ['100.01', 'EXCEDIDO']])(
    'deriva %s%% e estado %s sem gravar projeções', async (amount, estado) => {
      repo.budgetSpending.mockResolvedValue([{ categoriaId: category, _sum: { valor: new Prisma.Decimal(amount) } }]);
      const result = await service.getBudget('user', 'profile', 'budget');
      expect(result.resumo).toMatchObject({ valorRealizado: new Prisma.Decimal(amount).toFixed(2), percentualConsumido: Number(amount), estado });
      expect(result.categorias?.[0].estado).toBe(estado); expect(repo.updateBudget).not.toHaveBeenCalled();
    });

  it('contextual usa vínculo; orçamento base usa categoria/período; resumo inclui vínculo sem categoria planejada', async () => {
    repo.budgetSpending.mockResolvedValue([{ categoriaId: null, _sum: { valor: new Prisma.Decimal(25) } }]);
    expect((await service.getBudget('user', 'profile', 'budget')).resumo.valorRealizado).toBe('25.00');
    expect(repo.budgetSpending).toHaveBeenLastCalledWith('profile', expect.anything(), 'budget');
    budget.tipo = 'PERIODO';
    expect((await service.getBudget('user', 'profile', 'budget')).resumo.valorRealizado).toBe('0.00');
    expect(repo.budgetSpending).toHaveBeenLastCalledWith('profile', expect.anything(), undefined);
  });

  it.each([['100', 'COMPLETO', '0.00', false], ['120', 'FALTA_ALOCAR', '20.00', true], ['80', 'EXCEDIDO', '-20.00', true]] as const)(
    'renda %s → ZERO_BASED %s', async (income, status, diferenca, planejamentoIncompleto) => {
      budget.tipo = 'ZERO_BASED'; repo.budgetIncome.mockResolvedValue(new Prisma.Decimal(income));
      const result = await service.getBudget('user', 'profile', 'budget');
      expect(result.zeroBased).toEqual({ rendaPeriodo: `${income}.00`, totalAlocado: '100.00', diferenca, status, planejamentoIncompleto });
      expect(result.dataInicio).toBe('2026-10-01'); expect(result.dataFim).toBe('2026-10-31');
      expect(repo.createBudget).not.toHaveBeenCalled(); expect(repo.updateBudget).not.toHaveBeenCalled();
    });

  it('PATCH vazio e período final inválido não alteram orçamento/categorias', async () => {
    await expect(service.updateBudget('user', 'profile', 'budget', new UpdateBudgetDto())).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateBudget('user', 'profile', 'budget', { dataFim: '2026-09-30' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.updateBudget).not.toHaveBeenCalled(); expect(repo.replaceCategories).not.toHaveBeenCalled();
  });

  it('desvincula sem chamar exclusão financeira, e exige ambos os recursos no perfil', async () => {
    await service.setBudgetTransaction('user', 'profile', 'budget', 'transaction', false);
    expect(repo.unlinkTransaction).toHaveBeenCalledWith('profile', 'transaction', 'budget', tx);
    repo.findTransaction.mockResolvedValue(null);
    await expect(service.setBudgetTransaction('user', 'profile', 'budget', 'foreign', true)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.linkTransaction).not.toHaveBeenCalled();
    repo.findBudget.mockResolvedValue(null);
    await expect(service.getBudget('user', 'profile', 'foreign')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ownership interrompe todas as operações antes de consultas/escritas financeiras', async () => {
    ownership.mockRejectedValue(new ForbiddenException());
    for (const action of [() => service.createBudget('u', 'p', body), () => service.listBudgets('u', 'p', {}),
      () => service.getBudget('u', 'p', 'b'), () => service.updateBudget('u', 'p', 'b', { ativo: false }),
      () => service.setBudgetTransaction('u', 'p', 'b', 't', true)]) {
      await expect(action()).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(repo.transaction).not.toHaveBeenCalled(); expect(repo.findBudget).not.toHaveBeenCalled(); expect(repo.listBudgets).not.toHaveBeenCalled();
  });

  it('query active=false é false e não conversão genérica truthy', async () => {
    const query = plainToInstance(BudgetQueryDto, { active: 'false' });
    expect(await validate(query)).toEqual([]); expect(query.active).toBe(false);
    expect((await validate(plainToInstance(BudgetQueryDto, { active: 'anything' }))).length).toBeGreaterThan(0);
  });

  it('tipo não pode ser alterado pelo DTO do PATCH', async () => {
    expect((await validate(plainToInstance(UpdateBudgetDto, { tipo: 'EVENTO' }), { whitelist: true, forbidNonWhitelisted: true })).length)
      .toBeGreaterThan(0);
  });
});
