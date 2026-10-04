import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { GoalsModule } from '../goals/goals.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';

@Module({ imports: [PrismaModule, AuthModule, ProfilesModule, GoalsModule], controllers: [AnalyticsController],
  providers: [AnalyticsRepository, AnalyticsService] })
export class AnalyticsModule {}
