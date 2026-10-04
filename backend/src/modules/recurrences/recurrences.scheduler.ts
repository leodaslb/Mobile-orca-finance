import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecurrencesService } from './recurrences.service';

@Injectable()
export class RecurrencesScheduler {
  constructor(private readonly recurrences: RecurrencesService) {}
  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async tick() { await this.recurrences.processDue(); }
}
