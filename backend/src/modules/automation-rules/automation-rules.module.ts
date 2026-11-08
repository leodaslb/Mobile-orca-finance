import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { CategoriesModule } from '../categories/categories.module';
import { AutomationRulesController } from './automation-rules.controller';
import { AutomationRulesRepository } from './automation-rules.repository';
import { AutomationRulesService } from './automation-rules.service';

@Module({ imports: [PrismaModule, AuthModule, ProfilesModule, CategoriesModule], controllers: [AutomationRulesController],
  providers: [AutomationRulesService, AutomationRulesRepository], exports: [AutomationRulesService] })
export class AutomationRulesModule {}
