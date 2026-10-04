import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { BudgetsService } from './budgets.service';
import { MonthlyBudgetDto } from './dto/monthly-budget.dto';
import { QuotaDto } from './dto/quota.dto';
import { CreateSpendingRuleDto, UpdateSpendingRuleDto } from './dto/spending-rule.dto';
import { RuleQueryDto } from './dto/rule-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Put('budgets/monthly/:year/:month')
  putMonthly(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('year', ParseIntPipe) year: number, @Param('month', ParseIntPipe) month: number, @Body() dto: MonthlyBudgetDto) {
    return this.budgets.putMonthly(req.user.id, profile, year, month, dto);
  }

  @Get('budgets/monthly/:year/:month')
  getMonthly(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('year', ParseIntPipe) year: number, @Param('month', ParseIntPipe) month: number) {
    return this.budgets.getMonthly(req.user.id, profile, year, month);
  }

  @Put('free-spending-quota/:year/:month')
  putQuota(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('year', ParseIntPipe) year: number, @Param('month', ParseIntPipe) month: number, @Body() dto: QuotaDto) {
    return this.budgets.putQuota(req.user.id, profile, year, month, dto.valorLimite);
  }

  @Get('free-spending-quota/:year/:month')
  getQuota(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('year', ParseIntPipe) year: number, @Param('month', ParseIntPipe) month: number) {
    return this.budgets.getQuota(req.user.id, profile, year, month);
  }

  @Post('spending-rules')
  createRule(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Body() dto: CreateSpendingRuleDto) {
    return this.budgets.createRule(req.user.id, profile, dto);
  }

  @Get('spending-rules')
  listRules(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Query() dto: RuleQueryDto) {
    return this.budgets.listRules(req.user.id, profile, dto.dataReferencia ? new Date(dto.dataReferencia) : undefined);
  }

  @Patch('spending-rules/:ruleId')
  updateRule(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('ruleId', ParseUUIDPipe) id: string, @Body() dto: UpdateSpendingRuleDto) {
    return this.budgets.updateRule(req.user.id, profile, id, dto);
  }
}
