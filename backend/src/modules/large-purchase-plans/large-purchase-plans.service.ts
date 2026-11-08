import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlanoGrandeCompra, Prisma } from '../../generated/prisma/client';
import { ProfilesService } from '../profiles/profiles.service';
import { budgetDate } from '../budgets/budget-period';
import { LargePurchasePlansRepository } from './large-purchase-plans.repository';
import { CreateLargePurchasePlanDto, UpdateLargePurchasePlanDto } from './large-purchase-plan.dto';

@Injectable()
export class LargePurchasePlansService {
  constructor(private readonly plans: LargePurchasePlansRepository, private readonly profiles: ProfilesService) {}
  private positive(v: string) { const n = new Prisma.Decimal(v); if (!n.isFinite() || !n.greaterThan(0)) throw new BadRequestException('Valor deve ser positivo.'); return n; }
  private present(r: PlanoGrandeCompra) {
    const months = r.valorMensalPlanejado ? r.valorTotal.div(r.valorMensalPlanejado).ceil().toNumber() : null;
    if (months !== null && !Number.isSafeInteger(months)) throw new BadRequestException('Prazo estimado excede a precisão numérica suportada.');
    return { id: r.id, perfilId: r.perfilId, nome: r.nome, valorTotal: r.valorTotal.toFixed(2), valorMensalPlanejado: r.valorMensalPlanejado?.toFixed(2) ?? null,
      dataInicio: r.dataInicio.toISOString().slice(0, 10), quantidadeMesesEstimada: months, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
  }
  async list(u: string, p: string) { await this.profiles.assertOwnership(u, p); return (await this.plans.list(p)).map(r => this.present(r)); }
  async detail(u: string, p: string, id: string) { await this.profiles.assertOwnership(u, p); const row = await this.plans.find(p, id); if (!row) throw new NotFoundException('Plano não encontrado.'); return this.present(row); }
  async create(u: string, p: string, dto: CreateLargePurchasePlanDto) {
    await this.profiles.assertOwnership(u, p);
    const total = this.positive(dto.valorTotal); const monthly = dto.valorMensalPlanejado ? this.positive(dto.valorMensalPlanejado) : null;
    this.validateMonths(total, monthly);
    return this.present(await this.plans.create(p, { nome: dto.nome, valorTotal: total, valorMensalPlanejado: monthly, dataInicio: budgetDate(dto.dataInicio) }));
  }
  private validateMonths(total: Prisma.Decimal, monthly: Prisma.Decimal | null) {
    if (monthly && !Number.isSafeInteger(total.div(monthly).ceil().toNumber())) throw new BadRequestException('Prazo estimado excede a precisão numérica suportada.');
  }
  async update(u: string, p: string, id: string, dto: UpdateLargePurchasePlanDto) {
    await this.profiles.assertOwnership(u, p);
    if (!Object.values(dto).some(v => v !== undefined)) throw new BadRequestException('Informe ao menos um campo.');
    return this.plans.transaction(async tx => {
      await this.plans.lock(p, id, tx);
      const current = await this.plans.find(p, id, tx); if (!current) throw new NotFoundException('Plano não encontrado.');
      const total = dto.valorTotal !== undefined ? this.positive(dto.valorTotal) : current.valorTotal;
      const monthly = dto.valorMensalPlanejado !== undefined ? dto.valorMensalPlanejado === null ? null : this.positive(dto.valorMensalPlanejado) : current.valorMensalPlanejado;
      this.validateMonths(total, monthly);
      // PATCH preserva campos omitidos; a validação usa o estado confirmado sob o mesmo lock.
      await this.plans.update(p, id, { ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.valorTotal !== undefined && { valorTotal: total }),
        ...(dto.valorMensalPlanejado !== undefined && { valorMensalPlanejado: monthly }),
        ...(dto.dataInicio !== undefined && { dataInicio: budgetDate(dto.dataInicio) }) }, tx);
      const updated = await this.plans.find(p, id, tx);
      if (!updated) throw new NotFoundException('Plano não encontrado.');
      return this.present(updated);
    });
  }
}
