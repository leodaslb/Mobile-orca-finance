import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ClockModule } from '../../common/clock';
import { AuthModule } from '../auth/auth.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { EssentialExpenseChallengesController } from './essential-expense-challenges.controller';
import { EssentialExpenseChallengesRepository } from './essential-expense-challenges.repository';
import { EssentialExpenseChallengesService } from './essential-expense-challenges.service';

@Module({ imports: [PrismaModule, ClockModule, AuthModule, ProfilesModule, BudgetsModule], controllers: [EssentialExpenseChallengesController],
  providers: [EssentialExpenseChallengesRepository, EssentialExpenseChallengesService] })
export class EssentialExpenseChallengesModule {}
