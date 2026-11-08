import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ImportsController } from './imports.controller';
import { ImportsRepository } from './imports.repository';
import { ImportsService } from './imports.service';

@Module({ imports: [PrismaModule, AuthModule, ProfilesModule, TransactionsModule], controllers: [ImportsController], providers: [ImportsRepository, ImportsService] })
export class ImportsModule {}
