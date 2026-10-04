import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Test } from '@nestjs/testing';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { Clock } from '../src/common/clock';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { ReflectionService } from '../src/modules/reflection/reflection.service';
import { ReflectionRepository } from '../src/modules/reflection/reflection.repository';
import { CreateReflectionDto } from '../src/modules/reflection/reflection.dto';
import { ReceiptDto } from '../src/modules/transactions/dto/receipt.dto';
import { CreateRecurrenceDto } from '../src/modules/recurrences/recurrence.dto';
import { nextOccurrence, withinEnd } from '../src/modules/recurrences/recurrence-date';
import { RecurrencesScheduler } from '../src/modules/recurrences/recurrences.scheduler';
import { RecurrencesService } from '../src/modules/recurrences/recurrences.service';
import { RecurrencesRepository } from '../src/modules/recurrences/recurrences.repository';
import { RemindersRepository } from '../src/modules/recurrences/reminders.repository';
import { RemindersService } from '../src/modules/recurrences/reminders.service';
import { TransactionsService } from '../src/modules/transactions/transactions.service';

describe('US12: reflexão e relógio', () => {
  const entradaEm = new Date('2026-10-01T12:00:00Z');
  let now: Date;
  const create = jest.fn(async (_profile: string, descricao: string, date: Date, duracaoHoras: number) =>
    ({ id: 'item', perfilId: 'profile', descricao, entradaEm: date, duracaoHoras }));
  const find = jest.fn();
  const service = new ReflectionService({ create, find } as unknown as ReflectionRepository,
    { assertOwnership: jest.fn() } as unknown as ProfilesService, { now: () => now } as Clock, {} as TransactionsService);
  beforeEach(() => { now = new Date(entradaEm); });
  it('padrão 48h, customização e instante de entrada fornecido pelo servidor', async () => {
    expect(await service.create('user', 'profile', { descricao: 'Compra' })).toMatchObject({ duracaoHoras: 48,
      entradaEm: entradaEm.toISOString(), liberaEm: '2026-10-03T12:00:00.000Z', liberado: false });
    expect(await service.create('user', 'profile', { descricao: 'Compra', duracaoHoras: 3 })).toMatchObject({
      duracaoHoras: 3, liberaEm: '2026-10-01T15:00:00.000Z', liberado: false });
  });
  it('libera exatamente no instante calculado, sem persistir o estado derivado', async () => {
    find.mockResolvedValue({ id: 'item', perfilId: 'profile', descricao: 'Compra', entradaEm, duracaoHoras: 48 });
    now = new Date('2026-10-03T11:59:59.999Z');
    expect((await service.detail('user', 'profile', 'item')).liberado).toBe(false);
    now = new Date('2026-10-03T12:00:00Z');
    expect((await service.detail('user', 'profile', 'item')).liberado).toBe(true);
  });
  it.each([{ descricao: '' }, { descricao: ' \t' }, { duracaoHoras: 0 }, { duracaoHoras: -1 }, { duracaoHoras: 1.5 }, { duracaoHoras: null }])('recusa reflexão inválida %j', async (change) => {
      expect((await validate(plainToInstance(CreateReflectionDto, { descricao: 'Compra', ...change }))).length).toBeGreaterThan(0);
    });
  it('ownership interrompe persistência', async () => {
    const write = jest.fn();
    const forbidden = new ReflectionService({ create: write } as unknown as ReflectionRepository,
      { assertOwnership: jest.fn().mockRejectedValue(new ForbiddenException()) } as unknown as ProfilesService, new Clock(), {} as TransactionsService);
    await expect(forbidden.create('a', 'b', { descricao: 'Compra' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(write).not.toHaveBeenCalled();
  });
});

describe('US19: metadados de recibos', () => {
  it.each(['', ' ', 'arquivo.pdf', 'data:image/png;base64,AAA', 'ftp://example.com/file'])('recusa URL %s', async (arquivoUrl) => {
    expect((await validate(plainToInstance(ReceiptDto, { arquivoUrl }))).length).toBeGreaterThan(0);
  });
  it('aceita URL HTTP(S) e MIME opcional', async () => {
    expect(await validate(plainToInstance(ReceiptDto, { arquivoUrl: 'https://example.com/receipt.pdf' }))).toEqual([]);
  });
});

describe('US24: calendário, formatos e gatilho', () => {
  it.each([
    ['2026-12-29T12:15:20Z', 'SEMANAL', '2027-01-05T12:15:20.000Z'],
    ['2026-01-31T12:15:20Z', 'MENSAL', '2026-02-28T12:15:20.000Z'],
    ['2028-01-31T12:15:20Z', 'MENSAL', '2028-02-29T12:15:20.000Z'],
    ['2028-02-29T12:15:20Z', 'ANUAL', '2029-02-28T12:15:20.000Z'],
    ['2026-12-15T12:15:20Z', 'MENSAL', '2027-01-15T12:15:20.000Z'],
  ] as const)('avança %s / %s em UTC sem transbordar mês', (reference, frequency, result) => {
    const date = new Date(reference);
    expect(nextOccurrence(date, frequency).toISOString()).toBe(result);
    expect(date.toISOString()).toBe(new Date(reference).toISOString());
  });
  it('término inclui o dia completo e aceita prazo aberto', () => {
    expect(withinEnd(new Date('2026-10-31T23:59:59Z'), new Date('2026-10-31T00:00:00Z'))).toBe(true);
    expect(withinEnd(new Date('2026-11-01T00:00:00Z'), new Date('2026-10-31T00:00:00Z'))).toBe(false);
    expect(withinEnd(new Date('2026-11-01T00:00:00Z'), null)).toBe(true);
  });
  it.each([{ valor: '1.001' }, { descricao: ' ' }, { frequencia: 'DIARIA' }, { proximaOcorrencia: '2026-10-01T12:00:00' },
    { proximaOcorrencia: '2026-02-30T12:00:00Z' }, { dataTermino: '2026-02-30' }, { dataTermino: '2026-10-01T00:00:00Z' }])('recusa recorrência inválida %j', async (change) => {
      expect((await validate(plainToInstance(CreateRecurrenceDto, { tipoTransacao: 'DESPESA', valor: '10', descricao: 'Conta',
        frequencia: 'MENSAL', proximaOcorrencia: '2026-10-01T12:00:00Z', ...change }))).length).toBeGreaterThan(0);
    });
  it('scheduler delega ao caso de uso idempotente, sem esperar tempo real', async () => {
    const processDue = jest.fn().mockResolvedValue(undefined);
    await new RecurrencesScheduler({ processDue } as unknown as RecurrencesService).tick();
    expect(processDue).toHaveBeenCalledTimes(1);
  });
  it('Nest registra Cron real por minuto com proteção contra sobreposição', async () => {
    const processDue = jest.fn().mockResolvedValue(undefined);
    const module = await Test.createTestingModule({ imports: [ScheduleModule.forRoot()],
      providers: [RecurrencesScheduler, { provide: RecurrencesService, useValue: { processDue } }] }).compile();
    await module.init();
    try {
      const jobs = [...module.get(SchedulerRegistry).getCronJobs().values()];
      expect(jobs).toHaveLength(1);
      expect(jobs[0].waitForCompletion).toBe(true);
      expect(jobs[0].cronTime.source).toBe('*/1 * * * *');
      await jobs[0].fireOnTick();
      expect(processDue).toHaveBeenCalledTimes(1);
    } finally { await module.close(); }
  });
  it('lembrete sem origem falha antes de gravar', async () => {
    const create = jest.fn();
    const service = new RemindersService({ create } as unknown as RemindersRepository,
      { transaction: (operation: (tx: unknown) => unknown) => operation({}) } as unknown as RecurrencesRepository,
      { assertOwnership: jest.fn() } as unknown as ProfilesService);
    await expect(service.create('user', 'profile', { notificarEm: '2026-10-01T12:00:00Z' })).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});
