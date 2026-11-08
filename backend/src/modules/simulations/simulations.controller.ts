import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SimulationsService } from './simulations.service';
import { PurchaseImpactDto } from './purchase-impact.dto';
@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId/simulations')
export class SimulationsController {
  constructor(private readonly simulations: SimulationsService) {}
  @Post('purchase-impact') @HttpCode(200)
  purchase(@Req() r: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) p: string, @Body() dto: PurchaseImpactDto) { return this.simulations.purchase(r.user.id, p, dto); }
}
