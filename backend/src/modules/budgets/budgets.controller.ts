import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { BudgetsService } from './budgets.service';
import { MonthlyBudgetDto } from './dto/monthly-budget.dto';
import { QuotaDto } from './dto/quota.dto';
import { CreateSpendingRuleDto, UpdateSpendingRuleDto } from './dto/spending-rule.dto';
import { RuleQueryDto } from './dto/rule-query.dto';
import { BudgetQueryDto, CreateBudgetDto, UpdateBudgetDto } from './dto/budget.dto';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Post('budgets')
  createBudget(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Body() dto: CreateBudgetDto) {
    return this.budgets.createBudget(req.user.id, profile, dto);
  }

  @Get('budgets')
  listBudgets(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Query() dto: BudgetQueryDto) {
    return this.budgets.listBudgets(req.user.id, profile, dto);
  }

  @Get('budgets/:budgetId')
  getBudget(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('budgetId', ParseUUIDPipe) id: string) {
    return this.budgets.getBudget(req.user.id, profile, id);
  }

  @Patch('budgets/:budgetId')
  updateBudget(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('budgetId', ParseUUIDPipe) id: string, @Body() dto: UpdateBudgetDto) {
    return this.budgets.updateBudget(req.user.id, profile, id, dto);
  }

  @Put('budgets/:budgetId/transactions/:transactionId')
  @HttpCode(204)
  linkTransaction(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('budgetId', ParseUUIDPipe) id: string, @Param('transactionId', ParseUUIDPipe) transactionId: string) {
    return this.budgets.setBudgetTransaction(req.user.id, profile, id, transactionId, true);
  }

  @Delete('budgets/:budgetId/transactions/:transactionId')
  @HttpCode(204)
  unlinkTransaction(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('budgetId', ParseUUIDPipe) id: string, @Param('transactionId', ParseUUIDPipe) transactionId: string) {
    return this.budgets.setBudgetTransaction(req.user.id, profile, id, transactionId, false);
  }

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

  @Get('spending-rules/:ruleId')
  getRule(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('ruleId', ParseUUIDPipe) id: string, @Query() dto: RuleQueryDto) {
    return this.budgets.getRule(req.user.id, profile, id, dto.dataReferencia ? new Date(dto.dataReferencia) : undefined);
  }
}
