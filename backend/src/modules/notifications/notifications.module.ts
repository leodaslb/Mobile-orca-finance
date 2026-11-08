import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ClockModule } from '../../common/clock';
import { AuthModule } from '../auth/auth.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { NotificationsRepository } from './notifications.repository';
import { NotificationService } from './notification.service';
import { PushProvider, ExpoPushProvider } from './push.provider';
import { PushDevicesController } from './push-devices.controller';
import { WeeklySummaryService } from './weekly-summary.service';
import { WeeklySummaryJob } from './weekly-summary.job';
import { SmartTransactionReminderService } from './smart-transaction-reminder.service';
import { SmartTransactionReminderJob } from './smart-transaction-reminder.job';

@Module({ imports: [PrismaModule, ClockModule, AuthModule, BudgetsModule], controllers: [PushDevicesController],
  providers: [NotificationsRepository, NotificationService, { provide: PushProvider, useClass: ExpoPushProvider }, WeeklySummaryService, WeeklySummaryJob,
    SmartTransactionReminderService, SmartTransactionReminderJob],
  exports: [NotificationService] })
export class NotificationsModule {}
