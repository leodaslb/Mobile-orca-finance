import { Controller, Get, Param, ParseUUIDPipe, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { DashboardQueryDto, ExpenseReportQueryDto, ExportQueryDto } from './dto/analytics-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('reports/expenses')
  expenses(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Query() dto: ExpenseReportQueryDto) {
    return this.analytics.expenses(req.user.id, profile, dto);
  }

  @Get('exports/transactions')
  async export(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Query() dto: ExportQueryDto, @Res() reply: FastifyReply) {
    const file = await this.analytics.export(req.user.id, profile, dto);
    return reply.type(file.contentType).header('Content-Disposition', `attachment; filename="${file.filename}"`).send(file.buffer);
  }

  @Get('dashboard')
  dashboard(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Query() dto: DashboardQueryDto) {
    return this.analytics.dashboard(req.user.id, profile, dto);
  }
}
