import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Clock } from '../src/common/clock';
import { Prisma } from '../src/generated/prisma/client';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { ReflectionRepository } from '../src/modules/reflection/reflection.repository';
import { ReflectionService } from '../src/modules/reflection/reflection.service';
import { CreateTransactionDto } from '../src/modules/transactions/dto/create-transaction.dto';
import { TransactionsService } from '../src/modules/transactions/transactions.service';

describe('RF05/RF70 → US12: saída da reflexão', () => {
  const dto: CreateTransactionDto = { tipo: 'DESPESA', status: 'EFETIVADA', valor: '12.34', descricao: 'Compra revisada',
    dataHora: '2026-10-03T12:00:00Z', categoriaId: 'categoria' };
  const setup = (date = '2026-10-03T12:00:00Z') => {
    const tx = {} as Prisma.TransactionClient;
    const items = { lock: jest.fn(), find: jest.fn().mockResolvedValue({ id: 'item', perfilId: 'profile',
      descricao: 'Compra original', entradaEm: new Date('2026-10-01T12:00:00Z'), duracaoHoras: 48 }),
      remove: jest.fn().mockResolvedValue({ count: 1 }), transaction: jest.fn((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)) };
    const profiles = { assertOwnership: jest.fn() };
    const transactions = { create: jest.fn().mockResolvedValue({ id: 'compra', status: 'EFETIVADA' }) };
    return { tx, items, profiles, transactions, service: new ReflectionService(items as unknown as ReflectionRepository,
      profiles as unknown as ProfilesService, { now: () => new Date(date) } as Clock, transactions as unknown as TransactionsService) };
  };
  it('bloqueia concluir/desistir um instante antes da liberação', async () => {
    const { service, items, transactions } = setup('2026-10-03T11:59:59.999Z');
    await expect(service.complete('user', 'profile', 'item', dto)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.discard('user', 'profile', 'item')).rejects.toBeInstanceOf(ConflictException);
    expect(items.remove).not.toHaveBeenCalled(); expect(transactions.create).not.toHaveBeenCalled();
  });
  it('conclui exatamente na liberação, usando mesma transação para criação auditada/remoção', async () => {
    const { service, items, transactions, tx } = setup();
    expect(await service.complete('user', 'profile', 'item', dto)).toEqual({ id: 'compra', status: 'EFETIVADA' });
    expect(items.lock).toHaveBeenCalledWith('profile', 'item', tx);
    expect(transactions.create).toHaveBeenCalledWith('user', 'profile', dto, tx);
    expect(items.remove).toHaveBeenCalledWith('profile', 'item', tx);
    expect(transactions.create.mock.invocationCallOrder[0]).toBeLessThan(items.remove.mock.invocationCallOrder[0]);
  });
  it('desistir remove somente o item, sem chamar criação financeira', async () => {
    const { service, items, transactions } = setup();
    await service.discard('user', 'profile', 'item');
    expect(items.remove).toHaveBeenCalledTimes(1); expect(transactions.create).not.toHaveBeenCalled();
  });
  it('falha de validação/criação preserva item', async () => {
    const { service, items, transactions } = setup();
    transactions.create.mockRejectedValue(new BadRequestException());
    await expect(service.complete('user', 'profile', 'item', dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(items.remove).not.toHaveBeenCalled();
  });
  it('ownership rejeita ambos os comandos antes de ler/alterar recursos', async () => {
    const { service, profiles, items } = setup();
    profiles.assertOwnership.mockRejectedValue(new ForbiddenException());
    await expect(service.complete('a', 'b', 'item', dto)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.discard('a', 'b', 'item')).rejects.toBeInstanceOf(ForbiddenException);
    expect(items.transaction).not.toHaveBeenCalled();
  });
  it('item inexistente/consumido/de outro perfil retorna 404 sem criar', async () => {
    const { service, items, transactions } = setup(); items.find.mockResolvedValue(null);
    await expect(service.complete('user', 'profile', 'item', dto)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.discard('user', 'profile', 'item')).rejects.toBeInstanceOf(NotFoundException);
    expect(transactions.create).not.toHaveBeenCalled(); expect(items.remove).not.toHaveBeenCalled();
  });
  it.each([{ status: 'PREVISTA' as const }, { tipo: 'RECEITA' as const }])('rejeita estado incompatível %j', async (change) => {
    const { service, items } = setup();
    await expect(service.complete('user', 'profile', 'item', { ...dto, ...change })).rejects.toBeInstanceOf(BadRequestException);
    expect(items.transaction).not.toHaveBeenCalled();
  });
});
