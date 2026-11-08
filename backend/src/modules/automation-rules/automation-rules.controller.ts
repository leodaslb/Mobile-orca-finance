import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { AutomationRulesService } from './automation-rules.service';
import { AutomationQueryDto, CreateAutomationRuleDto, UpdateAutomationRuleDto } from './automation-rule.dto';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId/automation-rules')
export class AutomationRulesController {
  constructor(private readonly rules: AutomationRulesService) {}
  @Get() list(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) p: string, @Query() q: AutomationQueryDto) { return this.rules.list(req.user.id, p, q.active); }
  @Get(':ruleId') detail(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) p: string, @Param('ruleId', ParseUUIDPipe) id: string) { return this.rules.detail(req.user.id, p, id); }
  @Post() create(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) p: string, @Body() dto: CreateAutomationRuleDto) { return this.rules.save(req.user.id, p, dto); }
  @Patch(':ruleId') update(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) p: string, @Param('ruleId', ParseUUIDPipe) id: string, @Body() dto: UpdateAutomationRuleDto) { return this.rules.save(req.user.id, p, dto, id); }
}
