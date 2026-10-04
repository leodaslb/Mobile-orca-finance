import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Essencialidade, MetodoPagamento, OperacaoAuditoria, Prisma, Recorrencia, StatusTransacao, TipoTransacao, Transacao } from '../../generated/prisma/client';
import { CategoriesRepository } from '../categories/categories.repository';
import { ProfilesService } from '../profiles/profiles.service';
import { TagsRepository } from '../tags/tags.repository';
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
    private readonly tags: TagsRepository,
  ) {}

  private snapshot(item: Transacao): Prisma.InputJsonObject {
    // Consultas escalares, sem include: Date.toJSON e Decimal.toJSON serializam
    // somente os campos persistidos, mantendo ISO, strings decimais e null.
    return JSON.parse(JSON.stringify(item)) as Prisma.InputJsonObject;
  }

  private present(item: Transacao) {
    return {
      id: item.id, perfilId: item.perfilId, tipo: item.tipo,
      valor: item.valor.toFixed(2), dataHora: item.dataHora.toISOString(),
      descricao: item.descricao, anotacao: item.anotacao,
      categoriaId: item.categoriaId, subcategoriaId: item.subcategoriaId,
      metodoPagamento: item.metodoPagamento, essencialidade: item.essencialidade,
      ehGastoLivre: item.ehGastoLivre, status: item.status,
      recorrenciaId: item.recorrenciaId, ocorrenciaReferencia: item.ocorrenciaReferencia?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
    };
  }

  private async validateState(perfilId: string, state: ManualState,
    current?: Pick<Transacao, 'categoriaId' | 'subcategoriaId'>, generated = false) {
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
    if (!generated && !state.ehGastoLivre && !state.categoriaId) {
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

  async create(userId: string, perfilId: string, dto: CreateTransactionDto, transaction?: Prisma.TransactionClient) {
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
    const persist = async (tx: Prisma.TransactionClient) => {
      const created = await this.transactions.create(perfilId, state, tx);
      await this.transactions.createAudit({
        perfilId, transacaoId: created.id, operacao: OperacaoAuditoria.CRIACAO,
        estadoAnterior: Prisma.DbNull, estadoNovo: this.snapshot(created), realizadoEm: new Date(),
      }, tx);
      return this.present(created);
    };
    // A saída da reflexão compartilha a criação/auditoria e a remoção do item.
    return transaction ? persist(transaction) : this.transactions.transaction(persist);
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
    const [links, recibos] = await Promise.all([this.transactions.findTags(perfilId, id), this.transactions.findReceipts(perfilId, id)]);
    return { ...this.present(item), tags: links.map((link) => link.tag), recibos };
  }

  async validateRecurrence(template: Pick<Recorrencia, 'perfilId' | 'tipoTransacao' | 'valor' | 'descricao' | 'categoriaId' | 'subcategoriaId' | 'metodoPagamento'>,
    current?: Pick<Recorrencia, 'categoriaId' | 'subcategoriaId'>) {
    // A exigência de categoria do cadastro manual não se aplica à origem automática.
    await this.validateState(template.perfilId, { tipo: template.tipoTransacao, valor: template.valor, descricao: template.descricao,
      categoriaId: template.categoriaId, subcategoriaId: template.subcategoriaId, metodoPagamento: template.metodoPagamento,
      dataHora: new Date(), status: 'PREVISTA', anotacao: null, essencialidade: 'NAO_CLASSIFICADA', ehGastoLivre: false }, current, true);
  }

  async materializeOccurrence(template: Recorrencia, reference: Date, status: StatusTransacao, tx: Prisma.TransactionClient, now: Date) {
    const existing = await this.transactions.findOccurrence(template.perfilId, template.id, reference, tx);
    if (existing) {
      if (existing.status === 'PREVISTA' && status === 'EFETIVADA') {
        return this.editOccurrence(template.perfilId, existing.id, { status: 'EFETIVADA' }, tx, now);
      }
      return existing;
    }
    await this.validateRecurrence(template, template);
    const created = await this.transactions.create(template.perfilId, {
      tipo: template.tipoTransacao, valor: template.valor, descricao: template.descricao, categoriaId: template.categoriaId,
      subcategoriaId: template.subcategoriaId, metodoPagamento: template.metodoPagamento, dataHora: reference, status,
      recorrenciaId: template.id, ocorrenciaReferencia: reference,
    }, tx);
    await this.transactions.createAudit({ perfilId: template.perfilId, transacaoId: created.id, operacao: 'CRIACAO',
      estadoAnterior: Prisma.DbNull, estadoNovo: this.snapshot(created), realizadoEm: now }, tx);
    return created;
  }

  async editOccurrence(profile: string, id: string, data: Partial<Pick<Transacao,
    'tipo' | 'valor' | 'descricao' | 'categoriaId' | 'subcategoriaId' | 'metodoPagamento' | 'status'>>, tx: Prisma.TransactionClient, now: Date) {
    await this.transactions.lock(profile, id, tx);
    const current = await this.transactions.findByProfileAndId(profile, id, tx);
    if (!current) throw new NotFoundException('Ocorrência não encontrada.');
    if (current.status !== 'PREVISTA') return current;
    const state = { ...current, ...data };
    await this.validateState(profile, state, current, true);
    const changed = Object.entries(data).some(([key, value]) => String(current[key as keyof Transacao]) !== String(value));
    if (!changed) return current;
    const updated = await this.transactions.updateByProfileAndId(profile, id, data, tx);
    if (!updated) throw new NotFoundException('Ocorrência não encontrada.');
    await this.transactions.createAudit({ perfilId: profile, transacaoId: id, operacao: 'EDICAO',
      estadoAnterior: this.snapshot(current), estadoNovo: this.snapshot(updated), realizadoEm: now }, tx);
    return updated;
  }

  async removeFutureOccurrence(profile: string, id: string, tx: Prisma.TransactionClient, now: Date) {
    await this.transactions.lock(profile, id, tx);
    const current = await this.transactions.findByProfileAndId(profile, id, tx);
    if (!current || current.status !== 'PREVISTA' || !current.ocorrenciaReferencia || current.ocorrenciaReferencia <= now) return;
    await this.transactions.createAudit({ perfilId: profile, transacaoId: id, operacao: 'EXCLUSAO',
      estadoAnterior: this.snapshot(current), estadoNovo: Prisma.DbNull, realizadoEm: now }, tx);
    await this.transactions.deleteByProfileAndId(profile, id, tx);
  }

  async setTags(userId: string, perfilId: string, id: string, tagIds: string[]) {
    await this.profiles.assertOwnership(userId, perfilId);
    const ids = [...new Set(tagIds.map((tagId) => tagId.toLowerCase()))];
    return this.transactions.transaction(async (tx) => {
      await this.transactions.lock(perfilId, id, tx);
      if (!(await this.transactions.findByProfileAndId(perfilId, id, tx))) {
        throw new NotFoundException('Transação não encontrada.');
      }
      const tags = await this.tags.findByProfileAndIds(perfilId, ids, tx);
      if (tags.length !== ids.length) throw new BadRequestException('Tags inválidas para este perfil.');
      await this.transactions.replaceTags(perfilId, id, ids, tx);
      return { tags: (await this.transactions.findTags(perfilId, id, tx)).map((link) => link.tag) };
    });
  }

  async update(userId: string, perfilId: string, id: string, dto: UpdateTransactionDto) {
    await this.profiles.assertOwnership(userId, perfilId);
    if (!Object.keys(dto).length) throw new BadRequestException('Informe ao menos um campo.');
    return this.transactions.transaction(async (tx) => {
      await this.transactions.lock(perfilId, id, tx);
      const current = await this.transactions.findByProfileAndId(perfilId, id, tx);
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
      await this.validateState(perfilId, state, current, current.recorrenciaId !== null);
      const updated = await this.transactions.updateByProfileAndId(perfilId, id, state, tx);
      if (!updated) throw new NotFoundException('Transação não encontrada.');
      await this.transactions.createAudit({
        perfilId, transacaoId: id, operacao: OperacaoAuditoria.EDICAO,
        estadoAnterior: this.snapshot(current), estadoNovo: this.snapshot(updated), realizadoEm: new Date(),
      }, tx);
      return this.present(updated);
    });
  }

  async reverse(userId: string, perfilId: string, id: string): Promise<void> {
    await this.profiles.assertOwnership(userId, perfilId);
    await this.transactions.transaction(async (tx) => {
      await this.transactions.lock(perfilId, id, tx);
      const current = await this.transactions.findByProfileAndId(perfilId, id, tx);
      if (!current) throw new NotFoundException('Transação não encontrada.');
      await this.transactions.createAudit({
        perfilId, transacaoId: id, operacao: OperacaoAuditoria.EXCLUSAO,
        estadoAnterior: this.snapshot(current), estadoNovo: Prisma.DbNull, realizadoEm: new Date(),
      }, tx);
      const deleted = await this.transactions.deleteByProfileAndId(perfilId, id, tx);
      if (!deleted.count) throw new NotFoundException('Transação não encontrada.');
    });
  }
}
