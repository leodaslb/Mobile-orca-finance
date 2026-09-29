import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Essencialidade, Prisma, StatusTransacao, TipoTransacao, Transacao } from '../src/generated/prisma/client';
import { CategoriesRepository } from '../src/modules/categories/categories.repository';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { CreateTransactionDto } from '../src/modules/transactions/dto/create-transaction.dto';
import { TransactionsRepository } from '../src/modules/transactions/transactions.repository';
import { TransactionsService } from '../src/modules/transactions/transactions.service';

describe('TransactionsService', () => {
  const userId = 'usuario';
  const profileId = 'perfil';
  const categoriaId = 'categoria';
  const subcategoriaId = 'subcategoria';
  const base: CreateTransactionDto = {
    tipo: TipoTransacao.DESPESA,
    valor: '15.75',
    dataHora: '2026-09-29T15:30:00-03:00',
    descricao: 'Compra',
    categoriaId,
    status: StatusTransacao.EFETIVADA,
  };
  let service: TransactionsService;
  let create: jest.Mock;
  let findByProfileAndId: jest.Mock;
  let updateByProfileAndId: jest.Mock;
  let findCategory: jest.Mock;
  let findSubcategory: jest.Mock;
  let current: Transacao;

  beforeEach(() => {
    current = {
      id: 'transacao', perfilId: profileId, tipo: TipoTransacao.DESPESA,
      valor: new Prisma.Decimal('15.75'), dataHora: new Date(base.dataHora),
      descricao: 'Compra', anotacao: null, categoriaId, subcategoriaId,
      metodoPagamento: null, essencialidade: Essencialidade.NAO_CLASSIFICADA,
      ehGastoLivre: false, status: StatusTransacao.EFETIVADA,
      recorrenciaId: null, ocorrenciaReferencia: null, moedaOriginal: null,
      valorOriginal: null, taxaCambio: null, valorConvertido: null,
      estabelecimento: null, latitude: null, longitude: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    create = jest.fn().mockImplementation(async (perfilId: string, data: object) => ({
      ...current, ...data, id: 'nova', perfilId,
    }));
    findByProfileAndId = jest.fn().mockResolvedValue(current);
    updateByProfileAndId = jest.fn().mockImplementation(async (_perfilId: string, _id: string, data: object) => ({ ...current, ...data }));
    findCategory = jest.fn().mockResolvedValue({ id: categoriaId, ativa: true });
    findSubcategory = jest.fn().mockResolvedValue({ id: subcategoriaId, perfilId: profileId, categoriaId, ativa: true });
    const transactions = { create, findByProfileAndId, updateByProfileAndId } as unknown as TransactionsRepository;
    const profiles = { assertOwnership: jest.fn().mockResolvedValue({ id: profileId, usuarioId: userId }) } as unknown as ProfilesService;
    const categories = { findCategory, findSubcategory } as unknown as CategoriesRepository;
    service = new TransactionsService(transactions, profiles, categories);
  });

  it('cria despesa válida com Decimal, perfil e defaults documentados', async () => {
    const result = await service.create(userId, profileId, base);
    expect(result.valor).toBe('15.75');
    expect(result.perfilId).toBe(profileId);
    expect(result.essencialidade).toBe(Essencialidade.NAO_CLASSIFICADA);
    expect(create).toHaveBeenCalledWith(profileId, expect.objectContaining({
      valor: new Prisma.Decimal('15.75'), categoriaId, ehGastoLivre: false,
    }));
  });

  it('rejeita valor não positivo e categoria ausente na transação normal', async () => {
    await expect(service.create(userId, profileId, { ...base, valor: '0' }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(userId, profileId, { ...base, categoriaId: null }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('permite despesa livre sem categoria e recusa receita marcada como livre', async () => {
    const free = await service.create(userId, profileId, {
      ...base, categoriaId: null, ehGastoLivre: true,
    });
    expect(free.categoriaId).toBeNull();
    expect(free.ehGastoLivre).toBe(true);
    await expect(service.create(userId, profileId, {
      ...base, tipo: TipoTransacao.RECEITA, categoriaId: null, ehGastoLivre: true,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aceita subcategoria somente do perfil e categoria da transação', async () => {
    await service.create(userId, profileId, { ...base, subcategoriaId });
    expect(findSubcategory).toHaveBeenCalledWith(profileId, subcategoriaId);
    findSubcategory.mockResolvedValueOnce(null);
    await expect(service.create(userId, profileId, { ...base, subcategoriaId }))
      .rejects.toBeInstanceOf(BadRequestException);
    findSubcategory.mockResolvedValueOnce({ id: subcategoriaId, perfilId: profileId, categoriaId: 'outra', ativa: true });
    await expect(service.create(userId, profileId, { ...base, subcategoriaId }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa categoria inexistente/inativa e nova associação a subcategoria inativa', async () => {
    findCategory.mockResolvedValueOnce(null);
    await expect(service.create(userId, profileId, base))
      .rejects.toBeInstanceOf(NotFoundException);
    findCategory.mockResolvedValueOnce({ id: categoriaId, ativa: false });
    await expect(service.create(userId, profileId, base))
      .rejects.toBeInstanceOf(ConflictException);
    findSubcategory.mockResolvedValueOnce({ id: subcategoriaId, perfilId: profileId, categoriaId, ativa: false });
    await expect(service.create(userId, profileId, { ...base, subcategoriaId }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('revalida o estado final no PATCH antes de persistir', async () => {
    await expect(service.update(userId, profileId, current.id, {
      categoriaId: null, ehGastoLivre: true,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(updateByProfileAndId).not.toHaveBeenCalled();
    const result = await service.update(userId, profileId, current.id, {
      categoriaId: null, subcategoriaId: null, ehGastoLivre: true,
    });
    expect(result.categoriaId).toBeNull();
    expect(result.subcategoriaId).toBeNull();
    expect(updateByProfileAndId).toHaveBeenCalledWith(profileId, current.id, expect.objectContaining({
      categoriaId: null, subcategoriaId: null, ehGastoLivre: true,
    }));
  });
});

