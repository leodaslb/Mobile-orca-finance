import { BadRequestException, ConflictException, ForbiddenException, PayloadTooLargeException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { parseCsv, IMPORT_MAX_BYTES } from '../src/modules/imports/csv-parser';
import { ConfirmImportDto, ImportRowDto } from '../src/modules/imports/import.dto';
import { ImportsService } from '../src/modules/imports/imports.service';
import { ImportsRepository } from '../src/modules/imports/imports.repository';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { TransactionsService } from '../src/modules/transactions/transactions.service';

const header = 'tipo;valor;data_hora;descricao;categoria\r\n';
const row: ImportRowDto = { tipo: 'DESPESA', valor: '35.90', dataHora: '2026-10-10T12:30:00Z', descricao: 'Almoço' };
describe('RF61 → US42 → RN-IMP-01/02: CSV, preview e confirmação', () => {
  const ownership = jest.fn(); const categories = jest.fn(); const duplicate = jest.fn(); const lockProfile = jest.fn(); const importRow = jest.fn();
  const tx = {};
  const data = { categories, duplicate, lockProfile, transaction: jest.fn(fn => fn(tx)) };
  const service = new ImportsService(data as unknown as ImportsRepository, { assertOwnership: ownership } as unknown as ProfilesService,
    { importRow } as unknown as TransactionsService);
  beforeEach(() => { jest.clearAllMocks(); ownership.mockResolvedValue({}); duplicate.mockResolvedValue(null); categories.mockResolvedValue([{ id: 'c', nome: 'Alimentação' }]); importRow.mockResolvedValue({ id: 't' }); });
  it('lê UTF-8/BOM, ;, aspas escapadas e descrição multilinha com número físico', () => {
    expect(parseCsv(Buffer.from('\uFEFF' + header + 'DESPESA;1;2026-10-01T12:00:00;"Café; ""bom""\nnovo";\nRECEITA;2;2026-10-01T12:00:00;Salário;')))
      .toEqual([{ rowNumber: 2, cells: ['DESPESA', '1', '2026-10-01T12:00:00', 'Café; "bom"\nnovo', ''] },
        { rowNumber: 4, cells: ['RECEITA', '2', '2026-10-01T12:00:00', 'Salário', ''] }]);
  });
  it.each([Buffer.from([255]), Buffer.from('tipo,valor'), Buffer.from(header), Buffer.from(header + '"não fecha'), Buffer.from(header + 'a"b;c')])('rejeita CSV inválido sem escrever', buffer => {
    expect(() => parseCsv(buffer)).toThrow(BadRequestException);
  });
  it('limita uso de memória e tamanho do lote', () => {
    expect(() => parseCsv(Buffer.alloc(IMPORT_MAX_BYTES + 1))).toThrow(PayloadTooLargeException);
    expect(() => parseCsv(Buffer.from(header + 'a;b;c;d;e\n'.repeat(1001)))).toThrow(PayloadTooLargeException);
  });
  it('preview resolve catálogo e sinaliza ausentes, desconhecidas, duplicatas internas e rejeições', async () => {
    const result = await service.preview('u', 'p', async () => Buffer.from(header +
      'DESPESA;35.90;2026-10-10T12:30:00;Almoço;Alimentação\n' +
      'DESPESA;35.9;2026-10-10T12:30:00;ALMOÇO;Não existe\n' +
      'DESPESA;0;2026-02-30T12:30:00;Inválida;\n' +
      'RECEITA;1;2026-10-10T12:30:00;Salário;\n'));
    expect(result.summary).toEqual({ totalRows: 4, validRows: 3, rejectedRows: 1, withoutCategory: 2, possibleDuplicates: 1 });
    expect(result.rows[0]).toMatchObject({ status: 'VALID', categoria: { categoriaId: 'c', resolved: true }, dataHora: row.dataHora.replace('Z', '.000Z') });
    expect(result.rows[1]).toMatchObject({ possibleDuplicate: true, categoria: { resolved: false } });
    expect(importRow).not.toHaveBeenCalled(); expect(data.transaction).not.toHaveBeenCalled();
  });
  it('duplicata já persistida também aparece no preview', async () => {
    duplicate.mockResolvedValue({ id: 'old' });
    const result = await service.preview('u', 'p', async () => Buffer.from(header + 'DESPESA;35.90;2026-10-10T12:30:00;Almoço;'));
    expect(result.rows[0].possibleDuplicate).toBe(true);
  });
  it('ownership antecede leitura do upload e consultas', async () => {
    ownership.mockRejectedValue(new ForbiddenException()); const read = jest.fn();
    await expect(service.preview('u', 'p', read)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.confirm('u', 'p', { confirmPossibleDuplicates: false, rows: [row] })).rejects.toBeInstanceOf(ForbiddenException);
    expect(read).not.toHaveBeenCalled(); expect(categories).not.toHaveBeenCalled(); expect(importRow).not.toHaveBeenCalled();
  });
  it('revalida e rejeita antes de gravar qualquer linha', async () => {
    await expect(service.confirm('u', 'p', { confirmPossibleDuplicates: true, rows: [row, { ...row, valor: '0' }] })).rejects.toBeInstanceOf(BadRequestException);
    expect(importRow).not.toHaveBeenCalled();
  });
  it('exige confirmação tanto para duplicatas do banco quanto do próprio lote', async () => {
    duplicate.mockResolvedValue({ id: 'old' });
    await expect(service.confirm('u', 'p', { confirmPossibleDuplicates: false, rows: [row] })).rejects.toBeInstanceOf(ConflictException);
    duplicate.mockResolvedValue(null);
    await expect(service.confirm('u', 'p', { confirmPossibleDuplicates: false, rows: [row, row] })).rejects.toMatchObject({ response: { code: 'POSSIBLE_DUPLICATE_CONFIRMATION_REQUIRED' } });
    expect(importRow).not.toHaveBeenCalled();
  });
  it('criação reutiliza domínio e mesma transação, após confirmação explícita', async () => {
    expect(await service.confirm('u', 'p', { confirmPossibleDuplicates: true, rows: [row, row] })).toEqual({ created: 2, transactionIds: ['t', 't'] });
    expect(importRow).toHaveBeenNthCalledWith(1, 'u', 'p', row, tx); expect(lockProfile).toHaveBeenCalledWith('p', tx);
  });
  it.each([{ tipo: 'OUTRO' }, { valor: '-1' }, { valor: '1,00' }, { valor: '1.001' }, { dataHora: '2026-02-30T12:00:00Z' },
    { dataHora: '2026-10-01T12:00:00' }, { descricao: ' ' }, { categoriaId: 'x' }, { status: 'PREVISTA' }])('confirm DTO recusa %j', async change => {
    expect((await validate(plainToInstance(ConfirmImportDto, { confirmPossibleDuplicates: false, rows: [{ ...row, ...change }] }),
      { whitelist: true, forbidNonWhitelisted: true })).length).toBeGreaterThan(0);
  });
});
