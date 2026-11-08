import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../../database/prisma.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SpendingAlertsService } from './spending-alerts.service';
import { SpendingAlertsInterceptor } from './spending-alerts.interceptor';

@Module({ imports: [PrismaModule, BudgetsModule, ProfilesModule, NotificationsModule],
  providers: [SpendingAlertsService, { provide: APP_INTERCEPTOR, useClass: SpendingAlertsInterceptor }], exports: [SpendingAlertsService] })
export class SpendingAlertsModule {}
