import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { GoalsModule } from '../goals/goals.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { ClockModule } from '../../common/clock';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { CashFlowRepository } from './cash-flow.repository';
import { CashFlowService } from './cash-flow.service';

@Module({ imports: [PrismaModule, AuthModule, ProfilesModule, GoalsModule, ClockModule], controllers: [AnalyticsController, InsightsController],
  providers: [AnalyticsRepository, AnalyticsService, InsightsService, CashFlowRepository, CashFlowService], exports: [CashFlowService, AnalyticsRepository] })
export class AnalyticsModule {}
