import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Essencialidade, RegraAutomacao } from '../../generated/prisma/client';
import { ProfilesService } from '../profiles/profiles.service';
import { CategoriesRepository } from '../categories/categories.repository';
import { AutomationRulesRepository } from './automation-rules.repository';
import { CreateAutomationRuleDto, UpdateAutomationRuleDto } from './automation-rule.dto';

// RF15 → US20 → RN-CAT-02/03. Apenas essencialidade é um atributo definido atualmente.
@Injectable()
export class AutomationRulesService {
  constructor(private readonly rules: AutomationRulesRepository, private readonly profiles: ProfilesService, private readonly categories: CategoriesRepository) {}
  private present(row: RegraAutomacao) {
    return { id: row.id, perfilId: row.perfilId, categoriaId: row.categoriaId, subcategoriaId: row.subcategoriaId,
      atributoAlvo: row.atributoAlvo, valorDestino: row.valorDestino, ativa: row.ativa, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }
  async list(user: string, profile: string, active?: boolean) { await this.profiles.assertOwnership(user, profile); return (await this.rules.list(profile, active)).map(r => this.present(r)); }
  async detail(user: string, profile: string, id: string) {
    await this.profiles.assertOwnership(user, profile); const row = await this.rules.find(profile, id);
    if (!row) throw new NotFoundException('Regra de automação não encontrada.'); return this.present(row);
  }
  async save(user: string, profile: string, dto: CreateAutomationRuleDto | UpdateAutomationRuleDto, id?: string) {
    await this.profiles.assertOwnership(user, profile);
    if (id && !Object.values(dto).some(v => v !== undefined)) throw new BadRequestException('Informe ao menos um campo.');
    const result = await this.rules.transaction(async tx => {
      await this.rules.lock(profile, tx);
      const current = id ? await this.rules.find(profile, id, tx) : null;
      if (id && !current) throw new NotFoundException('Regra de automação não encontrada.');
      const category = dto.categoriaId !== undefined ? dto.categoriaId?.toLowerCase() ?? null : current?.categoriaId ?? null;
      const subcategory = dto.subcategoriaId !== undefined ? dto.subcategoriaId?.toLowerCase() ?? null : current?.subcategoriaId ?? null;
      const attribute = dto.atributoAlvo ?? current?.atributoAlvo;
      const value = dto.valorDestino ?? current?.valorDestino;
      const active = dto.ativa ?? current?.ativa ?? true;
      if (Boolean(category) === Boolean(subcategory)) throw new BadRequestException('Informe exatamente um escopo: categoria ou subcategoria.');
      if (attribute !== 'essencialidade' || !Object.values(Essencialidade).includes(value as Essencialidade)) throw new BadRequestException('Atributo ou valor de destino inválido.');
      const scope = category ? await this.categories.findCategory(category) : await this.categories.findSubcategory(profile, subcategory!);
      if (!scope) throw new BadRequestException('Escopo inválido para este perfil.');
      if (!scope.ativa && scope.id !== (category ? current?.categoriaId : current?.subcategoriaId)) throw new ConflictException('Escopo inativo para nova associação.');
      if (active) await this.rules.deactivate(profile, category, subcategory, attribute, tx, id);
      const state = { categoriaId: category, subcategoriaId: subcategory, atributoAlvo: attribute, valorDestino: value as Essencialidade, ativa: active };
      if (id) { await this.rules.update(profile, id, state, tx); return id; }
      return (await this.rules.create(profile, state, tx)).id;
    });
    return this.detail(user, profile, result);
  }
  // Contexto interno: chamado após ownership e validação da categoria/subcategoria da transação.
  async resolve(profile: string, category: string | null, subcategory: string | null): Promise<Essencialidade | null> {
    category = category?.toLowerCase() ?? null; subcategory = subcategory?.toLowerCase() ?? null;
    if (!category && !subcategory) return null;
    const rules = await this.rules.matching(profile, category, subcategory);
    const rule = rules.find(r => subcategory && r.subcategoriaId === subcategory) ?? rules.find(r => category && r.categoriaId === category);
    return rule && Object.values(Essencialidade).includes(rule.valorDestino as Essencialidade) ? rule.valorDestino as Essencialidade : null;
  }
}
