import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '../src/generated/prisma/client';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { TagsRepository } from '../src/modules/tags/tags.repository';
import { TagsService } from '../src/modules/tags/tags.service';

describe('TagsService: RF21 / US02', () => {
  const create = jest.fn();
  const listByProfile = jest.fn();
  const assertOwnership = jest.fn();
  let service: TagsService;

  beforeEach(() => {
    create.mockReset().mockImplementation(async (perfilId: string, nome: string) => ({
      id: 'tag', perfilId, nome, createdAt: new Date('2026-10-01T12:00:00Z'),
    }));
    listByProfile.mockReset();
    assertOwnership.mockReset().mockResolvedValue({});
    service = new TagsService({ create, listByProfile } as unknown as TagsRepository,
      { assertOwnership } as unknown as ProfilesService);
  });

  it('cria no perfil autorizado sem normalizar o nome informado', async () => {
    const result = await service.create('usuario', 'perfil', ' #viagem ');
    expect(assertOwnership).toHaveBeenCalledWith('usuario', 'perfil');
    expect(create).toHaveBeenCalledWith('perfil', ' #viagem ');
    expect(result).toEqual({ id: 'tag', perfilId: 'perfil', nome: ' #viagem ', createdAt: '2026-10-01T12:00:00.000Z' });
  });

  it('transforma conflito de unicidade do banco em 409', async () => {
    create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '7.10.0' }));
    await expect(service.create('usuario', 'perfil', '#viagem')).rejects.toBeInstanceOf(ConflictException);
  });

  it('recusa nome composto apenas por espaços antes de persistir', async () => {
    await expect(service.create('usuario', 'perfil', ' \t\n ')).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('valida ownership antes de listar ou criar tags', async () => {
    assertOwnership.mockRejectedValue(new ForbiddenException());
    await expect(service.list('intruso', 'perfil')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create('intruso', 'perfil', '#viagem')).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
    expect(listByProfile).not.toHaveBeenCalled();
  });
});
