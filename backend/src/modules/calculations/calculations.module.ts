import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CalculationsController } from './calculations.controller';
import { CalculationsService } from './calculations.service';

@Module({ imports: [AuthModule], controllers: [CalculationsController], providers: [CalculationsService] })
export class CalculationsModule {}
