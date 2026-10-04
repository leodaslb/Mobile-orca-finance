import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersModule } from '../users/users.module';
import { BudgetsController } from './budgets.controller';
import { BudgetsRepository } from './budgets.repository';
import { BudgetsService } from './budgets.service';

@Module({ imports: [PrismaModule, AuthModule, ProfilesModule, UsersModule], controllers: [BudgetsController],
  providers: [BudgetsRepository, BudgetsService] })
export class BudgetsModule {}
