import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuditoriaTransacao } from '../src/generated/prisma/client';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { AuditQueryDto } from '../src/modules/transactions/dto/audit-query.dto';
import { TransactionAuditsRepository } from '../src/modules/transactions/transaction-audits.repository';
import { TransactionAuditsService } from '../src/modules/transactions/transaction-audits.service';

describe('RF23 → US04: consulta da auditoria', () => {
  const record: AuditoriaTransacao = { id: 'audit', perfilId: 'profile', transacaoId: null, operacao: 'EXCLUSAO',
    estadoAnterior: { id: 'transaction', valor: '12.34' }, estadoNovo: null, realizadoEm: new Date('2026-10-14T23:59:59.999Z') };
  const repo = { list: jest.fn(), find: jest.fn() };
  const ownership = jest.fn();
  const service = new TransactionAuditsService(repo as unknown as TransactionAuditsRepository,
    { assertOwnership: ownership } as unknown as ProfilesService);

  beforeEach(() => {
    jest.resetAllMocks(); ownership.mockResolvedValue({}); repo.list.mockResolvedValue([record]); repo.find.mockResolvedValue(record);
  });

  it('preserva snapshots/null e o instante ISO na resposta pública', async () => {
    expect(await service.detail('user', 'profile', 'audit')).toEqual({ ...record, realizadoEm: '2026-10-14T23:59:59.999Z' });
    expect(repo.find).toHaveBeenCalledWith('profile', 'audit');
  });

  it('filtra também pelo ID original após SET NULL, sem depender da transação ativa', async () => {
    const id = '8435cdec-f0e2-4140-ae20-fcba4f014f48';
    await service.list('user', 'profile', { transactionId: id.toUpperCase(), operation: 'EXCLUSAO', from: '2026-10-14', to: '2026-10-14' });
    expect(repo.list).toHaveBeenCalledWith('profile', {
      operacao: 'EXCLUSAO', realizadoEm: { gte: new Date('2026-10-14T00:00:00Z'), lt: new Date('2026-10-15T00:00:00Z') },
      OR: [{ transacaoId: id }, { estadoAnterior: { path: ['id'], equals: id } }, { estadoNovo: { path: ['id'], equals: id } }],
    });
  });

  it('mantém instante final inclusivo quando o filtro contém horário/fuso', async () => {
    await service.list('user', 'profile', { to: '2026-10-14T20:00:00-03:00' });
    expect(repo.list).toHaveBeenCalledWith('profile', { realizadoEm: { lte: new Date('2026-10-14T23:00:00Z') } });
  });

  it('aceita início com horário dentro do último dia informado como data pura', async () => {
    await service.list('user', 'profile', { from: '2026-10-14T20:00:00Z', to: '2026-10-14' });
    expect(repo.list).toHaveBeenCalledWith('profile', { realizadoEm: {
      gte: new Date('2026-10-14T20:00:00Z'), lt: new Date('2026-10-15T00:00:00Z'),
    } });
  });

  it('não consulta auditorias com intervalo invertido', async () => {
    await expect(service.list('user', 'profile', { from: '2026-10-15', to: '2026-10-14' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.list).not.toHaveBeenCalled();
  });

  it('recusa perfil alheio antes de listar ou buscar evento', async () => {
    ownership.mockRejectedValue(new ForbiddenException());
    await expect(service.list('user', 'foreign', {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.detail('user', 'foreign', 'audit')).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled(); expect(repo.find).not.toHaveBeenCalled();
  });

  it('auditoria inexistente ou de outro perfil retorna 404', async () => {
    repo.find.mockResolvedValue(null);
    await expect(service.detail('user', 'profile', 'foreign')).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([{ from: '2026-02-30' }, { to: '2026-10-14T12:00:00' }, { operation: 'RESTAURACAO' }, { transactionId: 'invalid' }, { from: '0000-01-01' }])(
    'valida formato HTTP: %j', async (query) => {
      expect((await validate(plainToInstance(AuditQueryDto, query))).length).toBeGreaterThan(0);
    });
});
