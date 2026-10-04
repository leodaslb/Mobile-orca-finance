import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ClockModule } from '../../common/clock';
import { AuthModule } from '../auth/auth.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { RecurrencesRepository } from './recurrences.repository';
import { RecurrencesService } from './recurrences.service';
import { RecurrencesController } from './recurrences.controller';
import { RecurrencesScheduler } from './recurrences.scheduler';
import { RemindersRepository } from './reminders.repository';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';

@Module({ imports: [PrismaModule, ClockModule, AuthModule, ProfilesModule, TransactionsModule],
  providers: [RecurrencesRepository, RecurrencesService, RecurrencesScheduler, RemindersRepository, RemindersService],
  controllers: [RecurrencesController, RemindersController] })
export class RecurrencesModule {}
