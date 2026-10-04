import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ItemReflexao, Prisma } from '../../generated/prisma/client';
import { Clock } from '../../common/clock';
import { ProfilesService } from '../profiles/profiles.service';
import { ReflectionRepository } from './reflection.repository';
import { CreateReflectionDto, UpdateReflectionDto } from './reflection.dto';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateTransactionDto } from '../transactions/dto/create-transaction.dto';

@Injectable()
export class ReflectionService {
  constructor(private readonly items: ReflectionRepository, private readonly profiles: ProfilesService, private readonly clock: Clock,
    private readonly transactions: TransactionsService) {}
  private async released(profile: string, id: string, tx: Prisma.TransactionClient) {
    await this.items.lock(profile, id, tx);
    const item = await this.items.find(profile, id, tx);
    if (!item) throw new NotFoundException('Item de reflexão não encontrado.');
    if (this.clock.now().getTime() < item.entradaEm.getTime() + item.duracaoHoras * 3600000) {
      throw new ConflictException('Aguarde o fim do período de reflexão.');
    }
    return item;
  }
  async discard(user: string, profile: string, id: string) {
    await this.profiles.assertOwnership(user, profile);
    await this.items.transaction(async (tx) => {
      await this.released(profile, id, tx);
      await this.items.remove(profile, id, tx);
    });
  }
  async complete(user: string, profile: string, id: string, dto: CreateTransactionDto) {
    await this.profiles.assertOwnership(user, profile);
    if (dto.tipo !== 'DESPESA' || dto.status !== 'EFETIVADA') {
      throw new BadRequestException('A compra após reflexão deve ser uma despesa efetivada.');
    }
    return this.items.transaction(async (tx) => {
      await this.released(profile, id, tx);
      const created = await this.transactions.create(user, profile, dto, tx);
      await this.items.remove(profile, id, tx);
      return created;
    });
  }
  private present(item: ItemReflexao) {
    const release = new Date(item.entradaEm.getTime() + item.duracaoHoras * 3600000);
    return { id: item.id, perfilId: item.perfilId, descricao: item.descricao, entradaEm: item.entradaEm.toISOString(),
      duracaoHoras: item.duracaoHoras, liberaEm: release.toISOString(), liberado: this.clock.now() >= release };
  }
  async create(user: string, profile: string, dto: CreateReflectionDto) {
    await this.profiles.assertOwnership(user, profile);
    return this.present(await this.items.create(profile, dto.descricao, this.clock.now(), dto.duracaoHoras ?? 48));
  }
  async list(user: string, profile: string) {
    await this.profiles.assertOwnership(user, profile);
    return (await this.items.list(profile)).map((item) => this.present(item));
  }
  async detail(user: string, profile: string, id: string) {
    await this.profiles.assertOwnership(user, profile);
    const item = await this.items.find(profile, id);
    if (!item) throw new NotFoundException('Item de reflexão não encontrado.');
    return this.present(item);
  }
  async update(user: string, profile: string, id: string, dto: UpdateReflectionDto) {
    await this.profiles.assertOwnership(user, profile);
    if (!Object.values(dto).some((value) => value !== undefined)) throw new BadRequestException('Informe ao menos um campo.');
    if (!(await this.items.update(profile, id, dto)).count) throw new NotFoundException('Item de reflexão não encontrado.');
    return this.detail(user, profile, id);
  }
}
