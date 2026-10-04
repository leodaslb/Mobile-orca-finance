import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Recorrencia } from '../../generated/prisma/client';
import { Clock } from '../../common/clock';
import { ProfilesService } from '../profiles/profiles.service';
import { TransactionsService } from '../transactions/transactions.service';
import { RecurrencesRepository } from './recurrences.repository';
import { CreateRecurrenceDto, UpdateRecurrenceDto } from './recurrence.dto';
import { nextOccurrence, withinEnd } from './recurrence-date';

@Injectable()
export class RecurrencesService {
  private readonly logger = new Logger(RecurrencesService.name);
  constructor(private readonly recurrences: RecurrencesRepository, private readonly profiles: ProfilesService,
    private readonly transactions: TransactionsService, private readonly clock: Clock) {}
  private present(item: Recorrencia) {
    return { id: item.id, perfilId: item.perfilId, tipoTransacao: item.tipoTransacao, valor: item.valor.toFixed(2), descricao: item.descricao,
      categoriaId: item.categoriaId, subcategoriaId: item.subcategoriaId, metodoPagamento: item.metodoPagamento, frequencia: item.frequencia,
      proximaOcorrencia: item.proximaOcorrencia.toISOString(), dataTermino: item.dataTermino?.toISOString().slice(0, 10) ?? null, ativa: item.ativa };
  }
  private end(value: string | null | undefined) {
    if (!value) return null;
    if (value.startsWith('0000-')) throw new BadRequestException('Ano deve ser positivo.');
    return new Date(`${value}T00:00:00Z`);
  }
  async create(user: string, profile: string, dto: CreateRecurrenceDto) {
    await this.profiles.assertOwnership(user, profile);
    const state = { perfilId: profile, tipoTransacao: dto.tipoTransacao, valor: new Prisma.Decimal(dto.valor), descricao: dto.descricao,
      categoriaId: dto.categoriaId?.toLowerCase() ?? null, subcategoriaId: dto.subcategoriaId?.toLowerCase() ?? null,
      metodoPagamento: dto.metodoPagamento ?? null, frequencia: dto.frequencia, proximaOcorrencia: new Date(dto.proximaOcorrencia),
      dataTermino: this.end(dto.dataTermino), ativa: dto.ativa ?? true };
    await this.transactions.validateRecurrence(state);
    if (!withinEnd(state.proximaOcorrencia, state.dataTermino)) throw new BadRequestException('Próxima ocorrência ultrapassa dataTermino.');
    const item = await this.recurrences.transaction(async (tx) => {
      const created = await this.recurrences.create(state, tx);
      if (created.ativa) await this.transactions.materializeOccurrence(created, created.proximaOcorrencia, 'PREVISTA', tx, this.clock.now());
      return created;
    });
    return this.present(item);
  }
  async list(user: string, profile: string) {
    await this.profiles.assertOwnership(user, profile);
    return (await this.recurrences.list(profile)).map((item) => this.present(item));
  }
  async detail(user: string, profile: string, id: string) {
    await this.profiles.assertOwnership(user, profile);
    const item = await this.recurrences.find(profile, id);
    if (!item) throw new NotFoundException('Recorrência não encontrada.');
    return this.present(item);
  }

  private async processOne(profile: string, id: string, now: Date): Promise<boolean> {
    return this.recurrences.transaction(async (tx) => {
      await this.recurrences.lock(profile, id, tx);
      const current = await this.recurrences.find(profile, id, tx);
      if (!current?.ativa || current.proximaOcorrencia > now) return false;
      if (!withinEnd(current.proximaOcorrencia, current.dataTermino)) {
        await this.recurrences.update(profile, id, { ativa: false }, tx);
        return false;
      }
      await this.transactions.materializeOccurrence(current, current.proximaOcorrencia, 'EFETIVADA', tx, now);
      const next = nextOccurrence(current.proximaOcorrencia, current.frequencia);
      const active = withinEnd(next, current.dataTermino);
      const updated = await this.recurrences.update(profile, id, { proximaOcorrencia: next, ativa: active }, tx);
      if (active) await this.transactions.materializeOccurrence(updated, next, 'PREVISTA', tx, now);
      return active && next <= now;
    });
  }
  private async processRecurrence(profile: string, id: string, now: Date) {
    for (let count = 0; count < 100; count++) if (!await this.processOne(profile, id, now)) break;
  }
  async processDue(now = this.clock.now(), profile?: string) {
    for (const item of await this.recurrences.due(now, profile)) {
      try { await this.processRecurrence(item.perfilId, item.id, now); }
      catch { this.logger.error(`Falha ao processar recorrência ${item.id}; será tentada novamente no próximo ciclo.`); }
    }
  }
  async update(user: string, profile: string, id: string, dto: UpdateRecurrenceDto) {
    await this.profiles.assertOwnership(user, profile);
    if (!Object.values(dto).some((value) => value !== undefined)) throw new BadRequestException('Informe ao menos um campo.');
    const now = this.clock.now();
    if (dto.proximaOcorrencia && new Date(dto.proximaOcorrencia) <= now) throw new BadRequestException('Alteração de data deve apontar para o futuro.');
    const item = await this.recurrences.transaction(async (tx) => {
      await this.recurrences.lock(profile, id, tx);
      const current = await this.recurrences.find(profile, id, tx);
      if (!current) throw new NotFoundException('Recorrência não encontrada.');
      if (current.ativa && current.proximaOcorrencia <= now) throw new ConflictException('Há ocorrências vencidas pendentes de processamento.');
      const data = { tipoTransacao: dto.tipoTransacao ?? current.tipoTransacao, valor: dto.valor !== undefined ? new Prisma.Decimal(dto.valor) : current.valor,
        descricao: dto.descricao ?? current.descricao, categoriaId: dto.categoriaId !== undefined ? dto.categoriaId?.toLowerCase() ?? null : current.categoriaId,
        subcategoriaId: dto.subcategoriaId !== undefined ? dto.subcategoriaId?.toLowerCase() ?? null : current.subcategoriaId,
        metodoPagamento: dto.metodoPagamento !== undefined ? dto.metodoPagamento : current.metodoPagamento,
        frequencia: dto.frequencia ?? current.frequencia, proximaOcorrencia: dto.proximaOcorrencia ? new Date(dto.proximaOcorrencia) : current.proximaOcorrencia,
        dataTermino: dto.dataTermino !== undefined ? this.end(dto.dataTermino) : current.dataTermino, ativa: dto.ativa ?? current.ativa };
      await this.transactions.validateRecurrence({ ...data, perfilId: profile }, current);
      if (data.ativa && !current.ativa && data.proximaOcorrencia <= now) throw new BadRequestException('Reativação exige próxima ocorrência futura.');
      data.ativa = data.ativa && withinEnd(data.proximaOcorrencia, data.dataTermino);
      const updated = await this.recurrences.update(profile, id, data, tx);
      const reset = dto.proximaOcorrencia !== undefined || (dto.frequencia !== undefined && dto.frequencia !== current.frequencia);
      for (const pending of await this.recurrences.future(profile, id, now, tx)) {
        if (!updated.ativa || reset || !withinEnd(pending.ocorrenciaReferencia!, updated.dataTermino)) {
          await this.transactions.removeFutureOccurrence(profile, pending.id, tx, now);
        } else {
          await this.transactions.editOccurrence(profile, pending.id, { tipo: updated.tipoTransacao, valor: updated.valor, descricao: updated.descricao,
            categoriaId: updated.categoriaId, subcategoriaId: updated.subcategoriaId, metodoPagamento: updated.metodoPagamento }, tx, now);
        }
      }
      if (updated.ativa) await this.transactions.materializeOccurrence(updated, updated.proximaOcorrencia, 'PREVISTA', tx, now);
      return updated;
    });
    return this.present(item);
  }
}
