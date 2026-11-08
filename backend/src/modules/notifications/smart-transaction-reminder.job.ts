import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SmartTransactionReminderService } from './smart-transaction-reminder.service';

@Injectable()
export class SmartTransactionReminderJob {
  private readonly logger = new Logger(SmartTransactionReminderJob.name);
  constructor(private readonly reminders: SmartTransactionReminderService) {}
  @Cron('0 * * * *', { timeZone: 'UTC', waitForCompletion: true })
  async tick() {
    try { await this.reminders.run(); }
    catch { this.logger.warn('Execução de lembretes indisponível; nenhum detalhe interno registrado.'); }
  }
}
