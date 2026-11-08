import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { LargePurchasePlansController } from './large-purchase-plans.controller';
import { LargePurchasePlansRepository } from './large-purchase-plans.repository';
import { LargePurchasePlansService } from './large-purchase-plans.service';
@Module({ imports: [PrismaModule, AuthModule, ProfilesModule], controllers: [LargePurchasePlansController], providers: [LargePurchasePlansRepository, LargePurchasePlansService] })
export class LargePurchasePlansModule {}
