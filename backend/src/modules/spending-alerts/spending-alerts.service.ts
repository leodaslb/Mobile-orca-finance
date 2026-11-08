import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BudgetsService } from '../budgets/budgets.service';
import { BudgetsRepository } from '../budgets/budgets.repository';
import { NotificationService } from '../notifications/notification.service';
import { ProfilesService } from '../profiles/profiles.service';

@Injectable()
export class SpendingAlertsService {
  private readonly logger = new Logger(SpendingAlertsService.name);
  constructor(private readonly db: PrismaService, private readonly budgets: BudgetsService,
    private readonly repository: BudgetsRepository, private readonly notifications: NotificationService,
    private readonly profiles: ProfilesService) {}

  async evaluateProfile(profile: string) {
    try {
      const owner = await this.db.perfilFinanceiro.findUnique({ where: { id: profile }, select: { usuarioId: true } });
      if (owner) await this.evaluate(owner.usuarioId, profile);
    } catch { this.logger.warn('Alerta de recorrência não confirmado; lançamento preservado.'); }
  }

  // Chamado depois do commit financeiro. Uma falha de envio não desfaz nem repete a operação financeira.
  async evaluate(user: string, profile: string) {
    try {
      await this.profiles.assertOwnership(user, profile);
      const events = await this.db.$transaction(async tx => {
        await this.repository.lockProfile(profile, tx);
        const rules = await this.budgets.evaluatedRules(profile, undefined, tx);
        const candidates = [];
        for (const rule of rules) {
          if (!rule.ativa) continue;
          const previous = await tx.estadoAlertaRegraGasto.findUnique({ where: { regraGastoId: rule.id } });
          const samePeriod = previous?.inicioPeriodo.toISOString() === rule.inicio;
          if (samePeriod && previous.violada === rule.avaliacaoAtual.violada) continue;
          const wasViolated = samePeriod && previous?.violada === true;
          const violation = rule.avaliacaoAtual.violada;
          const triggered = violation && !wasViolated;
          const cycle = (samePeriod ? previous?.ciclo ?? 0 : 0) + (triggered ? 1 : 0);
          const data = { inicioPeriodo: new Date(rule.inicio), violada: violation, ciclo: cycle };
          await tx.estadoAlertaRegraGasto.upsert({ where: { regraGastoId: rule.id }, create: { regraGastoId: rule.id, ...data }, update: data });
          if (triggered && rule.canais.includes('PUSH')) candidates.push({ rule, cycle });
        }
        return candidates;
      }, { timeout: 20000 });
      for (const { rule, cycle } of events) {
        await this.notifications.notify(user, { type: 'SPENDING_LIMIT', profileId: profile, ruleId: rule.id,
          title: 'Confira seu limite de gastos', body: 'Uma das suas regras de gastos atingiu a condição de alerta. Confira os limites e seus lançamentos.' },
        `spending:${rule.id}:${rule.inicio}:${cycle}`, new Date(rule.fimExclusivo));
      }
    } catch { this.logger.warn('Avaliação de alertas não confirmada; operação financeira preservada.'); }
  }
}
