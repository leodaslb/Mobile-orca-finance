import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { GoalsController } from './goals.controller';
import { GoalsRepository } from './goals.repository';
import { GoalsService } from './goals.service';

@Module({ imports: [PrismaModule, AuthModule, ProfilesModule], controllers: [GoalsController],
  providers: [GoalsRepository, GoalsService], exports: [GoalsService] })
export class GoalsModule {}
