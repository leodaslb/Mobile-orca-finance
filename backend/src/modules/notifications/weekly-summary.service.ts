import { Injectable } from '@nestjs/common';
import { BudgetsService } from '../budgets/budgets.service';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class WeeklySummaryService {
  constructor(private readonly data: NotificationsRepository, private readonly budgets: BudgetsService) {}
  async summary(user: string, profile: string, start: Date, end: Date) {
    const from = start.toISOString().slice(0, 10); const to = new Date(end.getTime() - 86400000).toISOString().slice(0, 10);
    // Reutiliza orçamento, incluindo tipos contextuais e seus vínculos explícitos.
    // O progresso é do período original de cada orçamento, não uma segunda fórmula semanal.
    const budgets = await this.budgets.listBudgets(user, profile, { active: true, from, to });
    const expenses = await this.data.weeklyExpenses(profile, start, end);
    return { largestExpenses: expenses.map(r => ({ ...r, valor: r.valor.toFixed(2) })), budgets: budgets.map(b => ({ id: b.id, nome: b.nome,
      dataInicio: b.dataInicio, dataFim: b.dataFim, ...b.resumo })) };
  }
}
