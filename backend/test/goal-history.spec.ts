import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../src/generated/prisma/client';
import { GoalsService } from '../src/modules/goals/goals.service';
import { GoalsRepository } from '../src/modules/goals/goals.repository';
import { ProfilesService } from '../src/modules/profiles/profiles.service';

describe('US10: histórico por decisão expressa do aluno', () => {
  const setup = () => {
    const repo = { find: jest.fn().mockResolvedValue({ id: 'goal' }), contributions: jest.fn().mockResolvedValue([]) };
    const profiles = { assertOwnership: jest.fn().mockResolvedValue({}) };
    return { repo, profiles, service: new GoalsService(repo as unknown as GoalsRepository, profiles as unknown as ProfilesService) };
  };
  it('retorna lista vazia para meta própria sem aportes', async () => {
    const { service, repo, profiles } = setup();
    expect(await service.contributions('user', 'profile', 'goal')).toEqual([]);
    expect(profiles.assertOwnership).toHaveBeenCalledWith('user', 'profile');
    expect(repo.contributions).toHaveBeenCalledWith('profile', 'goal');
  });
  it('preserva precisão monetária e instante, expondo apenas campos persistidos do contrato', async () => {
    const { service, repo } = setup();
    repo.contributions.mockResolvedValue([{ id: 'aporte', metaId: 'goal', valor: new Prisma.Decimal('99999999999999999.99'),
      dataHora: new Date('2026-10-01T23:59:59.123Z') }]);
    expect(await service.contributions('user', 'profile', 'goal')).toEqual([{ id: 'aporte', metaId: 'goal',
      valor: '99999999999999999.99', dataHora: '2026-10-01T23:59:59.123Z' }]);
  });
  it('rejeita acesso ao perfil alheio antes de consultar meta/aportes', async () => {
    const { service, repo, profiles } = setup();
    profiles.assertOwnership.mockRejectedValue(new ForbiddenException());
    await expect(service.contributions('a', 'b', 'goal')).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.find).not.toHaveBeenCalled();
    expect(repo.contributions).not.toHaveBeenCalled();
  });
  it('retorna 404 para meta ausente ou de outro perfil, sem listar seus aportes', async () => {
    const { service, repo } = setup();
    repo.find.mockResolvedValue(null);
    await expect(service.contributions('user', 'profile', 'other-goal')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.contributions).not.toHaveBeenCalled();
  });
});
