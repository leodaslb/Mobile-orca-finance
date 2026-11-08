import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LargePurchasePlansService } from './large-purchase-plans.service';
import { CreateLargePurchasePlanDto, UpdateLargePurchasePlanDto } from './large-purchase-plan.dto';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId/large-purchase-plans')
export class LargePurchasePlansController {
  constructor(private readonly plans: LargePurchasePlansService) {}
  @Get() list(@Req() r: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) p: string) { return this.plans.list(r.user.id, p); }
  @Get(':planId') detail(@Req() r: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) p: string, @Param('planId', ParseUUIDPipe) id: string) { return this.plans.detail(r.user.id, p, id); }
  @Post() create(@Req() r: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) p: string, @Body() dto: CreateLargePurchasePlanDto) { return this.plans.create(r.user.id, p, dto); }
  @Patch(':planId') update(@Req() r: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) p: string, @Param('planId', ParseUUIDPipe) id: string, @Body() dto: UpdateLargePurchasePlanDto) { return this.plans.update(r.user.id, p, id, dto); }
}
