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
import { CalculationsModule } from './modules/calculations/calculations.module';
import { LargePurchasePlansModule } from './modules/large-purchase-plans/large-purchase-plans.module';
import { SimulationsModule } from './modules/simulations/simulations.module';
import { ImportsModule } from './modules/imports/imports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EssentialExpenseChallengesModule } from './modules/essential-expense-challenges/essential-expense-challenges.module';
import { SpendingAlertsModule } from './modules/spending-alerts/spending-alerts.module';

@Module({
  imports: [ScheduleModule.forRoot({ cronJobs: process.env.NODE_ENV !== 'test' }), PrismaModule, AuthModule, ProfilesModule, CategoriesModule,
    TransactionsModule, BudgetsModule, GoalsModule, AnalyticsModule, ReflectionModule, RecurrencesModule,
    CalculationsModule, LargePurchasePlansModule, SimulationsModule, ImportsModule, NotificationsModule, EssentialExpenseChallengesModule, SpendingAlertsModule],
  controllers: [AppController],
})
export class AppModule {}
