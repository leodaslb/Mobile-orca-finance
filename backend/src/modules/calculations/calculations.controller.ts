import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalculationsService } from './calculations.service';
import { CompoundInterestDto, OpportunityCostDto } from './calculation.dto';

@UseGuards(JwtAuthGuard)
@Controller('calculations')
export class CalculationsController {
  constructor(private readonly calculations: CalculationsService) {}
  @Post('compound-interest') @HttpCode(200) compound(@Body() dto: CompoundInterestDto) { return this.calculations.compound(dto); }
  @Post('opportunity-cost') @HttpCode(200) opportunity(@Body() dto: OpportunityCostDto) { return this.calculations.opportunity(dto); }
}
