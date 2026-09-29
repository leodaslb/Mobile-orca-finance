import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Essencialidade, MetodoPagamento, Prisma, StatusTransacao, TipoTransacao, Transacao } from '../../generated/prisma/client';
import { CategoriesRepository } from '../categories/categories.repository';
import { ProfilesService } from '../profiles/profiles.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsRepository } from './transactions.repository';

type ManualState = {
  tipo: TipoTransacao;
  valor: Prisma.Decimal;
  dataHora: Date;
  descricao: string;
  anotacao: string | null;
  categoriaId: string | null;
  subcategoriaId: string | null;
  metodoPagamento: MetodoPagamento | null;
  essencialidade: Essencialidade;
  ehGastoLivre: boolean;
  status: StatusTransacao;
};

@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactions: TransactionsRepository,
    private readonly profiles: ProfilesService,
    private readonly categories: CategoriesRepository,
  ) {}

  private present(item: Transacao) {
    return {
      id: item.id, perfilId: item.perfilId, tipo: item.tipo,
      valor: item.valor.toFixed(2), dataHora: item.dataHora.toISOString(),
      descricao: item.descricao, anotacao: item.anotacao,
      categoriaId: item.categoriaId, subcategoriaId: item.subcategoriaId,
      metodoPagamento: item.metodoPagamento, essencialidade: item.essencialidade,
      ehGastoLivre: item.ehGastoLivre, status: item.status,
      createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
    };
  }

  private async validateState(perfilId: string, state: ManualState, current?: Transacao) {
    if (!state.valor.isFinite() || !state.valor.greaterThan(0)) {
      throw new BadRequestException('Valor deve ser positivo.');
    }
    if (!Number.isFinite(state.dataHora.getTime())) {
      throw new BadRequestException('Data e hora inválidas.');
    }
    if (!state.descricao.trim()) {
      throw new BadRequestException('Descrição obrigatória.');
    }
    if (state.ehGastoLivre && state.tipo !== TipoTransacao.DESPESA) {
      throw new BadRequestException('Gasto livre aplica-se somente a despesa.');
    }
    if (!state.ehGastoLivre && !state.categoriaId) {
      throw new BadRequestException('Categoria obrigatória no cadastro manual comum.');
    }
    if (state.categoriaId) {
      const category = await this.categories.findCategory(state.categoriaId);
      if (!category) throw new NotFoundException('Categoria não encontrada.');
      if (!category.ativa && state.categoriaId !== current?.categoriaId) {
        throw new ConflictException('Categoria inativa.');
      }
    }
    if (state.subcategoriaId) {
      if (!state.categoriaId) {
        throw new BadRequestException('Subcategoria exige categoria.');
      }
      const subcategory = await this.categories.findSubcategory(perfilId, state.subcategoriaId);
      if (!subcategory || subcategory.categoriaId !== state.categoriaId) {
        throw new BadRequestException('Subcategoria incompatível com perfil ou categoria.');
      }
      if (!subcategory.ativa && state.subcategoriaId !== current?.subcategoriaId) {
        throw new ConflictException('Subcategoria inativa.');
      }
    }
  }

  async create(userId: string, perfilId: string, dto: CreateTransactionDto) {
    await this.profiles.assertOwnership(userId, perfilId);
    const state: ManualState = {
      tipo: dto.tipo, valor: new Prisma.Decimal(dto.valor),
      dataHora: new Date(dto.dataHora), descricao: dto.descricao,
      anotacao: dto.anotacao ?? null, categoriaId: dto.categoriaId ?? null,
      subcategoriaId: dto.subcategoriaId ?? null,
      metodoPagamento: dto.metodoPagamento ?? null,
      essencialidade: dto.essencialidade ?? Essencialidade.NAO_CLASSIFICADA,
      ehGastoLivre: dto.ehGastoLivre ?? false, status: dto.status,
    };
    await this.validateState(perfilId, state);
    return this.present(await this.transactions.create(perfilId, state));
  }

  async list(userId: string, perfilId: string, filters: TransactionQueryDto) {
    await this.profiles.assertOwnership(userId, perfilId);
    if (filters.dataInicial && filters.dataFinal &&
        new Date(filters.dataInicial) > new Date(filters.dataFinal)) {
      throw new BadRequestException('Intervalo de datas inválido.');
    }
    return (await this.transactions.findManyByProfile(perfilId, filters))
      .map((item) => this.present(item));
  }

  async get(userId: string, perfilId: string, id: string) {
    await this.profiles.assertOwnership(userId, perfilId);
    const item = await this.transactions.findByProfileAndId(perfilId, id);
    if (!item) throw new NotFoundException('Transação não encontrada.');
    return this.present(item);
  }

  async update(userId: string, perfilId: string, id: string, dto: UpdateTransactionDto) {
    await this.profiles.assertOwnership(userId, perfilId);
    if (!Object.keys(dto).length) throw new BadRequestException('Informe ao menos um campo.');
    const current = await this.transactions.findByProfileAndId(perfilId, id);
    if (!current) throw new NotFoundException('Transação não encontrada.');
    const state: ManualState = {
      tipo: dto.tipo ?? current.tipo,
      valor: dto.valor !== undefined ? new Prisma.Decimal(dto.valor) : current.valor,
      dataHora: dto.dataHora !== undefined ? new Date(dto.dataHora) : current.dataHora,
      descricao: dto.descricao ?? current.descricao,
      anotacao: dto.anotacao !== undefined ? dto.anotacao : current.anotacao,
      categoriaId: dto.categoriaId !== undefined ? dto.categoriaId : current.categoriaId,
      subcategoriaId: dto.subcategoriaId !== undefined ? dto.subcategoriaId : current.subcategoriaId,
      metodoPagamento: dto.metodoPagamento !== undefined ? dto.metodoPagamento : current.metodoPagamento,
      essencialidade: dto.essencialidade ?? current.essencialidade,
      ehGastoLivre: dto.ehGastoLivre ?? current.ehGastoLivre,
      status: dto.status ?? current.status,
    };
    await this.validateState(perfilId, state, current);
    const updated = await this.transactions.updateByProfileAndId(perfilId, id, state);
    if (!updated) throw new NotFoundException('Transação não encontrada.');
    return this.present(updated);
  }
}
