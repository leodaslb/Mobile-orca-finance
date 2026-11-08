import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../src/generated/prisma/client';
import { Clock } from '../src/common/clock';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { EssentialExpenseChallengesRepository } from '../src/modules/essential-expense-challenges/essential-expense-challenges.repository';
import { EssentialExpenseChallengesService } from '../src/modules/essential-expense-challenges/essential-expense-challenges.service';
import { BudgetsRepository } from '../src/modules/budgets/budgets.repository';
const D = (v: string | number) => new Prisma.Decimal(v);
describe('US59: progresso, sugestões e ownership', () => {
  const ownership = jest.fn(); const find = jest.fn(); const list = jest.fn(); const spending = jest.fn(); const history = jest.fn();
  const row = { id: 'c', perfilId: 'p', nome: null, categoriaId: 'cat', categoria: { id: 'cat', nome: 'Alimentação' }, valorAlvo: null,
    valorReferencia: D(1400), valorMetaPeriodo: D(1120), percentualReducao: D(20), dataInicio: new Date('2026-11-01Z'), dataFim: new Date('2026-11-30Z'),
    createdAt: new Date('2026-10-15Z'), updatedAt: new Date('2026-10-15Z') };
  const service = new EssentialExpenseChallengesService({ find, list, spending, history } as unknown as EssentialExpenseChallengesRepository,
    { assertOwnership: ownership } as unknown as ProfilesService, { now: () => new Date('2026-11-15Z') } as Clock, {} as BudgetsRepository);
  beforeEach(() => { jest.resetAllMocks(); find.mockResolvedValue(row); list.mockResolvedValue([row]); spending.mockResolvedValue(D(700)); history.mockResolvedValue([]); });
  it('lista/detalha dados derivados sem expor valorAlvo da US17', async () => {
    expect(await service.detail('u', 'p', 'c')).toMatchObject({ id: 'c', valorReferencia: '1400.00', valorMeta: '1120.00', valorGastoAtual: '700.00', status: 'EM_ANDAMENTO', percentualPeriodoConsumido: 62.5 });
    expect((await service.list('u', 'p'))[0].updatedAt).toBe('2026-10-15T00:00:00.000Z');
    expect(spending).toHaveBeenCalledWith('p', 'cat', { start: new Date('2026-11-01Z'), end: new Date('2026-12-01Z') });
    expect(await service.detail('u', 'p', 'c')).not.toHaveProperty('valorAlvo');
  });
  it('sugestões usam somente categoria/perfil e mês de baseline correspondente', async () => {
    history.mockResolvedValue([{ descricao: 'Delivery', valor: D(1400) }]);
    const result = await service.suggestions('u', 'p', 'c');
    expect(history).toHaveBeenCalledWith('p', 'cat', { start: new Date('2026-10-01Z'), end: new Date('2026-11-01Z') });
    expect(result).toMatchObject({ challengeId: 'c', category: { id: 'cat', name: 'Alimentação' }, target: { percentualReducao: 20 } });
    expect(result.suggestions).toHaveLength(3);
  });
  it('rejeita desafio inexistente ou de outro perfil sem consultar gasto/histórico', async () => {
    find.mockResolvedValue(null);
    await expect(service.detail('u', 'p', 'other')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.suggestions('u', 'p', 'other')).rejects.toBeInstanceOf(NotFoundException);
    expect(find).toHaveBeenCalledWith('p', 'other'); expect(spending).not.toHaveBeenCalled(); expect(history).not.toHaveBeenCalled();
  });
  it('ownership antecede qualquer acesso financeiro', async () => {
    ownership.mockRejectedValue(new ForbiddenException());
    await expect(service.list('u', 'p')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.detail('u', 'p', 'c')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.suggestions('u', 'p', 'c')).rejects.toBeInstanceOf(ForbiddenException);
    expect(find).not.toHaveBeenCalled(); expect(list).not.toHaveBeenCalled(); expect(history).not.toHaveBeenCalled(); expect(spending).not.toHaveBeenCalled();
  });
});

describe('US59: candidatos, aceite transacional e PATCH de nome', () => {
  const ownership = jest.fn(); const tx = {} as Prisma.TransactionClient;
  const data = { essentialCategories: jest.fn(), active: jest.fn(), create: jest.fn(), find: jest.fn(), spending: jest.fn(), lockProfile: jest.fn(), updateName: jest.fn(),
    transaction: jest.fn((fn: (client: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)) };
  const budgets = { findMonthly: jest.fn(), spentByCategory: jest.fn() };
  const fixture = { id: 'challenge', perfilId: 'p', nome: null, categoriaId: 'cat', categoria: { id: 'cat', nome: 'Alimentação' }, valorAlvo: null,
    valorReferencia: D(1400), valorMetaPeriodo: D(1120), percentualReducao: D(20), dataInicio: new Date('2026-11-01Z'), dataFim: new Date('2026-11-30Z'), createdAt: new Date('2026-10-15Z'), updatedAt: new Date('2026-10-15Z') };
  const service = new EssentialExpenseChallengesService(data as unknown as EssentialExpenseChallengesRepository, { assertOwnership: ownership } as unknown as ProfilesService,
    { now: () => new Date('2026-10-15T12:00:00Z') } as Clock, budgets as unknown as BudgetsRepository);
  beforeEach(() => {
    data.transaction.mockImplementation((fn: (client: Prisma.TransactionClient) => Promise<unknown>) => fn(tx));
    jest.clearAllMocks(); ownership.mockResolvedValue({}); data.active.mockResolvedValue(null); data.essentialCategories.mockResolvedValue([{ categoriaId: 'cat' }]);
    data.find.mockResolvedValue(fixture); data.create.mockResolvedValue({ id: fixture.id }); data.spending.mockResolvedValue(D(0));
    budgets.findMonthly.mockResolvedValue([{ ativo: true, orcamentoCategorias: [{ categoriaId: 'cat', categoria: { nome: 'Alimentação' }, valorPlanejado: D(1000) }] }]);
    budgets.spentByCategory.mockResolvedValue([{ categoriaId: 'cat', _sum: { valor: D(1400) } }]);
  });
  it('usa mês corrente e todas as despesas da categoria elegível, somente calcula e propõe mês seguinte', async () => {
    expect(await service.candidates('u', 'p')).toMatchObject({ baseline: { startDate: '2026-10-01', endDate: '2026-10-31' }, challengePeriod: { startDate: '2026-11-01', endDate: '2026-11-30' },
      candidates: [{ categoriaId: 'cat', valorPlanejado: '1000.00', valorRealizado: '1400.00', percentualReducaoSugerida: 20, valorMetaSugerido: '1120.00' }] });
    expect(budgets.findMonthly).toHaveBeenCalledWith('p', new Date('2026-10-01Z'), new Date('2026-10-31Z'), undefined);
    expect(data.create).not.toHaveBeenCalled(); expect(data.transaction).not.toHaveBeenCalled();
  });
  it('categoria sem despesa essencial, sem orçamento ou orçamento inativo não é elegível', async () => {
    data.essentialCategories.mockResolvedValue([]); expect((await service.candidates('u', 'p')).candidates).toEqual([]);
    data.essentialCategories.mockResolvedValue([{ categoriaId: 'cat' }]); budgets.findMonthly.mockResolvedValue([]);
    expect((await service.candidates('u', 'p')).candidates).toEqual([]);
    budgets.findMonthly.mockResolvedValue([{ ativo: false }]); expect((await service.candidates('u', 'p')).candidates).toEqual([]);
  });
  it('criação recalcula referência/meta, reserva um ativo no aceite e usa a mesma transação', async () => {
    await service.create('u', 'p', { categoriaId: 'cat' });
    expect(data.lockProfile).toHaveBeenCalledWith('p', tx); expect(data.active).toHaveBeenCalledWith('p', 'cat', new Date('2026-10-15Z'), tx);
    expect(budgets.spentByCategory).toHaveBeenCalledWith('p', { start: new Date('2026-10-01Z'), end: new Date('2026-11-01Z') }, tx);
    const value = data.create.mock.calls[0][1]; expect(value.valorReferencia.toFixed(2)).toBe('1400.00'); expect(value.valorMetaPeriodo.toFixed(2)).toBe('1120.00');
    expect(value).toMatchObject({ valorAlvo: null, dataInicio: new Date('2026-11-01Z'), dataFim: new Date('2026-11-30Z') });
    expect(data.create.mock.calls[0][2]).toBe(tx);
  });
  it('outro ativo na mesma categoria retorna 409 e ausência de excesso suficiente retorna 400, sem criar', async () => {
    data.active.mockResolvedValue({ id: 'other' }); await expect(service.create('u', 'p', { categoriaId: 'cat' })).rejects.toBeInstanceOf(ConflictException);
    data.active.mockResolvedValue(null); budgets.spentByCategory.mockResolvedValue([{ categoriaId: 'cat', _sum: { valor: D(1049) } }]);
    await expect(service.create('u', 'p', { categoriaId: 'cat' })).rejects.toBeInstanceOf(BadRequestException); expect(data.create).not.toHaveBeenCalled();
  });
  it('virada de dezembro cria período janeiro, sem depender de duração fixa de mês', async () => {
    const december = new EssentialExpenseChallengesService(data as unknown as EssentialExpenseChallengesRepository, { assertOwnership: ownership } as unknown as ProfilesService,
      { now: () => new Date('2026-12-31T23:59:59Z') } as Clock, budgets as unknown as BudgetsRepository);
    const candidates = await december.candidates('u', 'p'); expect(candidates.challengePeriod).toEqual({ startDate: '2027-01-01', endDate: '2027-01-31' });
  });
  it('PATCH somente encaminha o nome e usa ownership/lock/recurso no perfil', async () => {
    await service.update('u', 'p', 'challenge', { nome: 'Novo nome' }); expect(data.updateName).toHaveBeenCalledWith('p', 'challenge', 'Novo nome', tx);
    await expect(service.update('u', 'p', 'challenge', { nome: ' ' })).rejects.toBeInstanceOf(BadRequestException);
    data.find.mockResolvedValue(null); await expect(service.update('u', 'p', 'missing', { nome: 'Outro' })).rejects.toBeInstanceOf(NotFoundException);
  });
  it('ownership interrompe candidatos, criação e edição antes de consultas/escritas', async () => {
    ownership.mockRejectedValue(new ForbiddenException());
    await expect(service.candidates('u', 'p')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create('u', 'p', { categoriaId: 'cat' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.update('u', 'p', 'id', { nome: 'Nome' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(data.transaction).not.toHaveBeenCalled(); expect(budgets.findMonthly).not.toHaveBeenCalled();
  });
});
