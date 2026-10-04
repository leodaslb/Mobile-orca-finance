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

@Module({
  imports: [PrismaModule, AuthModule, ProfilesModule, CategoriesModule, TagsModule],
  controllers: [TransactionsController, ReceiptsController],
  providers: [TransactionsRepository, TransactionsService, ReceiptsService, CloudinaryStorageService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
