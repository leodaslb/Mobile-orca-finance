import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ClockModule } from '../../common/clock';
import { AuthModule } from '../auth/auth.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ReflectionController } from './reflection.controller';
import { ReflectionRepository } from './reflection.repository';
import { ReflectionService } from './reflection.service';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({ imports: [PrismaModule, ClockModule, AuthModule, ProfilesModule, TransactionsModule], controllers: [ReflectionController],
  providers: [ReflectionRepository, ReflectionService] })
export class ReflectionModule {}
