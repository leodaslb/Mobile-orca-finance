import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Clock } from '../../common/clock';
import { NotificationsRepository } from './notifications.repository';
import { NotificationService } from './notification.service';
import { WeeklySummaryService } from './weekly-summary.service';

@Injectable()
export class WeeklySummaryJob {
  private readonly logger = new Logger(WeeklySummaryJob.name);
  constructor(private readonly data: NotificationsRepository, private readonly summaries: WeeklySummaryService,
    private readonly notifications: NotificationService, private readonly clock: Clock) {}
  // Decisão técnica: segunda-feira, 12h UTC, semana civil concluída (seg-dom UTC).
  @Cron('0 12 * * 1', { timeZone: 'UTC', waitForCompletion: true })
  async tick() {
    const now = this.clock.now(); const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    end.setUTCDate(end.getUTCDate() - (end.getUTCDay() + 6) % 7);
    const start = new Date(end.getTime() - 7 * 86400000); const expires = new Date(end.getTime() + 7 * 86400000);
    for (const profile of await this.data.recipientProfiles()) {
      try {
        const summary = await this.summaries.summary(profile.usuarioId, profile.id, start, end);
        const expenses = summary.largestExpenses.slice(0, 3).map(e => `${e.descricao.slice(0, 50)}: R$ ${e.valor}`).join('; ');
        const budgets = summary.budgets.slice(0, 3).map(b => `${(b.nome ?? 'Orçamento').slice(0, 40)}: R$ ${b.valorRealizado} de R$ ${b.valorPlanejado}`).join('; ');
        const body = [expenses ? `Maiores gastos: ${expenses}.` : 'Sem despesas efetivadas na semana.',
          budgets || 'Sem orçamento ativo no período.'].join(' ');
        await this.notifications.notify(profile.usuarioId, { type: 'WEEKLY_SUMMARY', profileId: profile.id,
          title: 'Seu resumo da semana', body, periodStart: start.toISOString().slice(0, 10),
          periodEnd: new Date(end.getTime() - 86400000).toISOString().slice(0, 10) }, start.toISOString(), expires);
      } catch { this.logger.warn('Resumo semanal não processado para um perfil; demais perfis continuam.'); }
    }
  }
}
