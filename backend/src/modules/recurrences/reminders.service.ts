import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LembreteVencimento, Prisma } from '../../generated/prisma/client';
import { ProfilesService } from '../profiles/profiles.service';
import { RecurrencesRepository } from './recurrences.repository';
import { RemindersRepository } from './reminders.repository';
import { CreateReminderDto, UpdateReminderDto } from './reminder.dto';

@Injectable()
export class RemindersService {
  constructor(private readonly reminders: RemindersRepository, private readonly recurrences: RecurrencesRepository, private readonly profiles: ProfilesService) {}
  private present(item: LembreteVencimento) {
    return { id: item.id, perfilId: item.perfilId, transacaoId: item.transacaoId, recorrenciaId: item.recorrenciaId,
      notificarEm: item.notificarEm.toISOString(), ativo: item.ativo };
  }
  private async validate(profile: string, transaction: string | null, recurrence: string | null, tx: Prisma.TransactionClient) {
    if (!transaction && !recurrence) throw new BadRequestException('Informe transacaoId ou recorrenciaId.');
    if (transaction && !await this.recurrences.findTransaction(profile, transaction, tx)) throw new BadRequestException('Transação não pertence ao perfil.');
    if (recurrence && !await this.recurrences.find(profile, recurrence, tx)) throw new BadRequestException('Recorrência não pertence ao perfil.');
  }
  async create(user: string, profile: string, dto: CreateReminderDto) {
    await this.profiles.assertOwnership(user, profile);
    return this.present(await this.recurrences.transaction(async (tx) => {
      const transacaoId = dto.transacaoId?.toLowerCase() ?? null;
      const recorrenciaId = dto.recorrenciaId?.toLowerCase() ?? null;
      await this.validate(profile, transacaoId, recorrenciaId, tx);
      return this.reminders.create({ perfilId: profile, transacaoId, recorrenciaId, notificarEm: new Date(dto.notificarEm), ativo: dto.ativo ?? true }, tx);
    }));
  }
  async list(user: string, profile: string) {
    await this.profiles.assertOwnership(user, profile);
    return (await this.reminders.list(profile)).map((item) => this.present(item));
  }
  async update(user: string, profile: string, id: string, dto: UpdateReminderDto) {
    await this.profiles.assertOwnership(user, profile);
    if (!Object.values(dto).some((value) => value !== undefined)) throw new BadRequestException('Informe ao menos um campo.');
    return this.present(await this.recurrences.transaction(async (tx) => {
      await this.reminders.lock(profile, id, tx);
      const current = await this.reminders.find(profile, id, tx);
      if (!current) throw new NotFoundException('Lembrete não encontrado.');
      const data = { transacaoId: dto.transacaoId !== undefined ? dto.transacaoId?.toLowerCase() ?? null : current.transacaoId,
        recorrenciaId: dto.recorrenciaId !== undefined ? dto.recorrenciaId?.toLowerCase() ?? null : current.recorrenciaId,
        notificarEm: dto.notificarEm !== undefined ? new Date(dto.notificarEm) : current.notificarEm, ativo: dto.ativo ?? current.ativo };
      await this.validate(profile, data.transacaoId, data.recorrenciaId, tx);
      return this.reminders.update(profile, id, data, tx);
    }));
  }
}
