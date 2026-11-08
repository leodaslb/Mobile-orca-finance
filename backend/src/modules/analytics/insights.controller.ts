import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InsightsService } from './insights.service';
import { CategorySuggestionDto, MetricsQueryDto } from './insights.dto';
import { CashFlowService } from './cash-flow.service';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId')
export class InsightsController {
  constructor(private readonly insights: InsightsService, private readonly cashFlow: CashFlowService) {}
  @Get('metrics') metrics(@Req() r: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) p: string, @Query() q: MetricsQueryDto) { return this.insights.metrics(r.user.id, p, q); }
  @Get('analytics/spending-trends') trends(@Req() r: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) p: string) { return this.insights.trends(r.user.id, p); }
  @Post('category-suggestions') @HttpCode(200) suggest(@Req() r: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) p: string, @Body() dto: CategorySuggestionDto) { return this.insights.suggest(r.user.id, p, dto.descricao); }
  @Get('cash-flow/projection') projection(@Req() r: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) p: string) { return this.cashFlow.projection(r.user.id, p); }
}
