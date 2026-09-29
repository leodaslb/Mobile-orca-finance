import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TransactionsModule } from './modules/transactions/transactions.module';

@Module({
  imports: [PrismaModule, AuthModule, ProfilesModule, CategoriesModule, TransactionsModule],
  controllers: [AppController],
})
export class AppModule {}
