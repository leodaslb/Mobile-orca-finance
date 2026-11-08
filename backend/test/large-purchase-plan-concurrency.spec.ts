import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../src/generated/prisma/client';
import { LargePurchasePlansService } from '../src/modules/large-purchase-plans/large-purchase-plans.service';
import { LargePurchasePlansRepository } from '../src/modules/large-purchase-plans/large-purchase-plans.repository';
import { ProfilesService } from '../src/modules/profiles/profiles.service';

describe('RF37/16 → US51/21: PATCH parcial e gravação serializada', () => {
  const tx = {} as Prisma.TransactionClient;
  const ownership = jest.fn();
  let row: { id: string; perfilId: string; nome: string; valorTotal: Prisma.Decimal; valorMensalPlanejado: Prisma.Decimal | null; dataInicio: Date; createdAt: Date; updatedAt: Date };
  const find = jest.fn(); const update = jest.fn(); const lock = jest.fn();
  const transaction = jest.fn((operation: (client: Prisma.TransactionClient) => Promise<unknown>) => operation(tx));
  const service = new LargePurchasePlansService({ find, update, lock, transaction } as unknown as LargePurchasePlansRepository,
    { assertOwnership: ownership } as unknown as ProfilesService);
  beforeEach(() => {
    jest.clearAllMocks(); ownership.mockResolvedValue({}); lock.mockResolvedValue(undefined);
    row = { id: 'plan', perfilId: 'profile', nome: 'Compra', valorTotal: new Prisma.Decimal(100), valorMensalPlanejado: new Prisma.Decimal(10), dataInicio: new Date('2026-11-01T00:00:00Z'), createdAt: new Date(), updatedAt: new Date() };
    find.mockImplementation(async () => ({ ...row }));
    update.mockImplementation(async (_profile: string, _id: string, changes: Partial<typeof row>) => { row = { ...row, ...changes }; return { count: 1 }; });
  });
  it('renomear não reenvia nem desfaz valores financeiros confirmados por outro cliente', async () => {
    find.mockImplementationOnce(async () => { const before = { ...row }; row.valorTotal = new Prisma.Decimal(200); return before; });
    await service.update('user', 'profile', 'plan', { nome: 'Novo nome' });
    expect(update.mock.calls[0][2]).toEqual({ nome: 'Novo nome' });
    expect(row.valorTotal.toFixed(2)).toBe('200.00');
  });
  it('trava o registro e lê/grava no mesmo TransactionClient; null remove mensal', async () => {
    const result = await service.update('user', 'profile', 'plan', { valorMensalPlanejado: null });
    expect(lock).toHaveBeenCalledWith('profile', 'plan', tx);
    expect(find).toHaveBeenCalledWith('profile', 'plan', tx);
    expect(update).toHaveBeenCalledWith('profile', 'plan', { valorMensalPlanejado: null }, tx);
    expect(result.quantidadeMesesEstimada).toBeNull();
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(find.mock.invocationCallOrder[0]);
  });
  it('ownership e ausência do registro impedem gravação', async () => {
    ownership.mockRejectedValueOnce(new ForbiddenException());
    await expect(service.update('other', 'profile', 'plan', { nome: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
    find.mockResolvedValueOnce(null);
    await expect(service.update('user', 'profile', 'missing', { nome: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });
});
