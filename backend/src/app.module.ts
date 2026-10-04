import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { GoalsModule } from './modules/goals/goals.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ReflectionModule } from './modules/reflection/reflection.module';
import { RecurrencesModule } from './modules/recurrences/recurrences.module';

@Module({
  imports: [ScheduleModule.forRoot({ cronJobs: process.env.NODE_ENV !== 'test' }), PrismaModule, AuthModule, ProfilesModule, CategoriesModule,
    TransactionsModule, BudgetsModule, GoalsModule, AnalyticsModule, ReflectionModule, RecurrencesModule],
  controllers: [AppController],
})
export class AppModule {}
