import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { TagsModule } from '../tags/tags.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsRepository } from './transactions.repository';
import { TransactionsService } from './transactions.service';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';
import { CloudinaryStorageService } from './cloudinary-storage.service';
import { TransactionAuditsController } from './transaction-audits.controller';
import { TransactionAuditsRepository } from './transaction-audits.repository';
import { TransactionAuditsService } from './transaction-audits.service';
import { AutomationRulesModule } from '../automation-rules/automation-rules.module';

@Module({
  imports: [PrismaModule, AuthModule, ProfilesModule, CategoriesModule, TagsModule, AutomationRulesModule],
  controllers: [TransactionsController, ReceiptsController, TransactionAuditsController],
  providers: [TransactionsRepository, TransactionsService, ReceiptsService, CloudinaryStorageService,
    TransactionAuditsRepository, TransactionAuditsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
