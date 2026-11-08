import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { CategoriesModule } from '../categories/categories.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SimulationsController } from './simulations.controller';
import { SimulationsService } from './simulations.service';
@Module({ imports: [AuthModule, ProfilesModule, CategoriesModule, BudgetsModule, AnalyticsModule], controllers: [SimulationsController], providers: [SimulationsService] })
export class SimulationsModule {}
