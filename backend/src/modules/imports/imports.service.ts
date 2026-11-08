import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../../generated/prisma/client';
import { ProfilesService } from '../profiles/profiles.service';
import { TransactionsService } from '../transactions/transactions.service';
import { ConfirmImportDto, ImportRowDto } from './import.dto';
import { parseCsv } from './csv-parser';
import { ImportsRepository } from './imports.repository';

@Injectable()
export class ImportsService {
  constructor(private readonly data: ImportsRepository, private readonly profiles: ProfilesService, private readonly transactions: TransactionsService) {}

  private key(row: ImportRowDto) {
    return JSON.stringify([row.tipo, new Prisma.Decimal(row.valor).toFixed(2), new Date(row.dataHora).toISOString(), row.descricao.trim().toLowerCase()]);
  }
  async preview(user: string, profile: string, readFile: () => Promise<Buffer>) {
    await this.profiles.assertOwnership(user, profile);
    const parsed = parseCsv(await readFile()); const catalog = await this.data.categories(); const seen = new Set<string>();
    const rows = [];
    for (const { rowNumber, cells } of parsed) {
      const [tipo, valor, date, descricao, category = ''] = cells;
      // O layout sem offset é interpretado em UTC, como as demais janelas da API.
      const row = plainToInstance(ImportRowDto, { tipo, valor, dataHora: `${date}Z`, descricao });
      const errors = (await validate(row)).flatMap(e => Object.values(e.constraints ?? {}));
      if (cells.length !== 5) errors.push('Informe exatamente cinco colunas.');
      if (!date || !/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(date)) errors.push('data_hora deve utilizar YYYY-MM-DDTHH:mm:ss.');
      if (!errors.length && !new Prisma.Decimal(valor).greaterThan(0)) errors.push('Valor deve ser positivo.');
      const matches = catalog.filter(c => c.nome.trim().toLowerCase() === category.trim().toLowerCase());
      const resolved = category.trim() !== '' && matches.length === 1 ? matches[0].id : null;
      let possibleDuplicate = false;
      if (!errors.length) {
        const key = this.key(row); possibleDuplicate = seen.has(key) || !!await this.data.duplicate(profile, row); seen.add(key);
      }
      rows.push({ rowNumber, status: errors.length ? 'REJECTED' : 'VALID', tipo, valor, dataHora: errors.length ? date : new Date(row.dataHora).toISOString(), descricao,
        categoria: { input: category, categoriaId: resolved, resolved: resolved !== null }, possibleDuplicate, errors });
    }
    const valid = rows.filter(r => r.status === 'VALID');
    return { summary: { totalRows: rows.length, validRows: valid.length, rejectedRows: rows.length - valid.length,
      withoutCategory: valid.filter(r => !r.categoria.resolved).length, possibleDuplicates: valid.filter(r => r.possibleDuplicate).length }, rows };
  }

  async confirm(user: string, profile: string, dto: ConfirmImportDto) {
    await this.profiles.assertOwnership(user, profile);
    // Não depende de preview anterior; rejeita lote inteiro antes de qualquer criação.
    const errors = await validate(plainToInstance(ConfirmImportDto, dto), { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length || dto.rows.some(r => !new Prisma.Decimal(r.valor).greaterThan(0))) throw new BadRequestException('Lote de importação inválido.');
    const transactionIds = await this.data.transaction(async tx => {
      await this.data.lockProfile(profile, tx);
      const seen = new Set<string>();
      for (const row of dto.rows) {
        const key = this.key(row);
        if (!dto.confirmPossibleDuplicates && (seen.has(key) || await this.data.duplicate(profile, row, tx))) {
          throw new ConflictException({ code: 'POSSIBLE_DUPLICATE_CONFIRMATION_REQUIRED', message: 'Confirme a importação de possíveis duplicatas.' });
        }
        seen.add(key);
      }
      const ids: string[] = [];
      for (const row of dto.rows) ids.push((await this.transactions.importRow(user, profile, { ...row, descricao: row.descricao.trim() }, tx)).id);
      return ids;
    });
    return { created: transactionIds.length, transactionIds };
  }
}
