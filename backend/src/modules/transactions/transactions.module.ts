import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsRepository } from './transactions.repository';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [PrismaModule, AuthModule, ProfilesModule, CategoriesModule],
  controllers: [TransactionsController],
  providers: [TransactionsRepository, TransactionsService],
})
export class TransactionsModule {}
