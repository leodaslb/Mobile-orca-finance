import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { strFromU8, unzipSync } from 'fflate';
import { Prisma } from '../src/generated/prisma/client';
import { goalMetrics } from '../src/modules/goals/goal-metrics';
import { ContributionDto, CreateGoalDto, UpdateGoalDto } from '../src/modules/goals/dto/goal.dto';
import { GoalsService } from '../src/modules/goals/goals.service';
import { GoalsRepository } from '../src/modules/goals/goals.repository';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { reportPeriod } from '../src/modules/analytics/report-period';
import { csvCell, csvFile, exportHeaders, xlsxFile } from '../src/modules/analytics/transaction-export';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { AnalyticsRepository } from '../src/modules/analytics/analytics.repository';

describe('US10: métricas e validação de metas', () => {
  const now = new Date('2026-10-01T23:59:59Z');
  const target = new Prisma.Decimal(100);
  it('sugestão diária inclui o dia-limite e usa restante positivo', () => {
    expect(goalMetrics(target, new Prisma.Decimal(20), new Date('2026-10-08T00:00:00Z'), 'DIARIA', now))
      .toMatchObject({ valorAcumulado: '20.00', valorRestante: '80.00', percentualProgresso: '20.00',
        periodosRestantes: 8, sugestaoAtual: '10.00', atingida: false, vencida: false });
  });
  it.each([[7, 1, '80.00'], [8, 2, '40.00'], [15, 3, '26.67']])('arredonda %s dias para %s períodos semanais', (days, periods, suggested) => {
    const deadline = new Date(`2026-10-${String(days).padStart(2, '0')}T00:00:00Z`);
    expect(goalMetrics(target, new Prisma.Decimal(20), deadline, 'SEMANAL', now))
      .toMatchObject({ periodosRestantes: periods, sugestaoAtual: suggested });
  });
  it('dia-limite ainda disponível; após vencer informa faltante e sugestão indefinida', () => {
    expect(goalMetrics(target, new Prisma.Decimal(20), new Date('2026-10-01T00:00:00Z'), 'DIARIA', now))
      .toMatchObject({ periodosRestantes: 1, sugestaoAtual: '80.00', vencida: false });
    expect(goalMetrics(target, new Prisma.Decimal(20), new Date('2026-09-30T00:00:00Z'), 'DIARIA', now))
      .toMatchObject({ valorRestante: '80.00', sugestaoAtual: null, vencida: true, atingida: false });
  });
  it.each(['100', '125'])('atingida com acumulado %s, restante e sugestão zero, sem limitar percentual', (value) => {
    expect(goalMetrics(target, new Prisma.Decimal(value), new Date('2026-09-30T00:00:00Z'), 'SEMANAL', now))
      .toMatchObject({ atingida: true, vencida: false, valorRestante: '0.00', sugestaoAtual: '0.00', percentualProgresso: `${value}.00` });
  });
  it.each([{ nome: ' \t' }, { nome: '' }, { valorAlvo: '-1' }, { valorAlvo: '1.001' }, { valorAlvo: null },
    { dataLimite: '2026-02-30' }, { dataLimite: '2026-10-01T00:00:00Z' }, { frequenciaSugestao: 'MENSAL' }])('recusa formato inválido %j', async (change) => {
    const dto = plainToInstance(CreateGoalDto, { nome: 'Meta', valorAlvo: '100.00', dataLimite: '2026-10-08', frequenciaSugestao: 'DIARIA', ...change });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
  it('aporte exige instante com fuso', async () => {
    expect((await validate(plainToInstance(ContributionDto, { valor: '10', dataHora: '2026-10-01T12:00:00' }))).length).toBeGreaterThan(0);
  });
  it('Service recusa alvo zero e PATCH vazio antes de escrever', async () => {
    const create = jest.fn();
    const update = jest.fn();
    const service = new GoalsService({ create, update } as unknown as GoalsRepository,
      { assertOwnership: jest.fn().mockResolvedValue({}) } as unknown as ProfilesService);
    await expect(service.create('user', 'profile', { nome: 'Meta', valorAlvo: '0', dataLimite: '2026-10-08', frequenciaSugestao: 'DIARIA' }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('user', 'profile', 'goal', new UpdateGoalDto())).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('US13/14/15: leitura financeira e arquivos', () => {
  it('período diário inclui último dia completo em UTC e fevereiro bissexto', () => {
    expect(reportPeriod('2024-02-28', '2024-02-29')).toEqual({ start: new Date('2024-02-28T00:00:00Z'), end: new Date('2024-03-01T00:00:00Z') });
  });
  it.each([['2026-10-02', '2026-10-01'], ['2026-02-30', '2026-03-01'], ['0000-01-01', '2026-10-01']])('recusa período %s a %s', (start, end) => {
    expect(() => reportPeriod(start, end)).toThrow(BadRequestException);
  });
  it('CSV preserva vírgulas, aspas, quebras, UTF-8 e cabeçalho em arquivo vazio', () => {
    const content = csvFile([['Café, "ação"\nsegunda linha', '99999999999999999.99']]).toString('utf8');
    expect(content).toContain('"Café, ""ação""\nsegunda linha"');
    expect(content).toContain('"99999999999999999.99"');
    expect(csvFile([]).toString('utf8')).toBe(`\uFEFF${exportHeaders.map(csvCell).join(',')}\r\n`);
  });
  it.each(['=1+1', '+cmd', '-cmd', '@SUM(A1)', '  =1+1', '\tformula'])('CSV neutraliza fórmula %s', (text) => {
    expect(csvCell(text)).toBe(`"'${text}"`);
  });
  it('XLSX é ZIP válido com workbook/planilha, texto especial e sem execução de fórmula', async () => {
    const files = unzipSync(await xlsxFile([['=1+1', 'Café & <ação>', '99999999999999999.99']]));
    expect(files['[Content_Types].xml']).toBeDefined();
    expect(files['xl/workbook.xml']).toBeDefined();
    const xml = Object.entries(files).filter(([name]) => name.endsWith('.xml')).map(([, bytes]) => strFromU8(bytes)).join('\n');
    expect(xml).toContain('Café &amp; &lt;ação&gt;');
    expect(xml).toContain('99999999999999999.99');
    expect(xml).toContain('=1+1');
    expect(xml).not.toContain('<f>');
    expect(unzipSync(await xlsxFile([]))['xl/worksheets/sheet1.xml']).toBeDefined();
  });
  it('ownership bloqueia metas, relatórios, exportação e dashboard antes da consulta', async () => {
    const repo = { list: jest.fn(), exportTransactions: jest.fn(), totals: jest.fn(), expensesByCategory: jest.fn() };
    const profiles = { assertOwnership: jest.fn().mockRejectedValue(new ForbiddenException()) } as unknown as ProfilesService;
    const goals = new GoalsService(repo as unknown as GoalsRepository, profiles);
    const analytics = new AnalyticsService(repo as unknown as AnalyticsRepository, profiles, goals);
    for (const operation of [goals.list('a', 'b'), analytics.expenses('a', 'b', { startDate: '2026-10-01', endDate: '2026-10-31' }),
      analytics.export('a', 'b', { format: 'csv' }), analytics.dashboard('a', 'b', { year: 2026, month: 10 })]) {
      await expect(operation).rejects.toBeInstanceOf(ForbiddenException);
    }
    for (const query of Object.values(repo)) expect(query).not.toHaveBeenCalled();
  });
});
