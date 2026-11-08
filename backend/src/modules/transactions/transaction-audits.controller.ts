import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { AuditQueryDto } from './dto/audit-query.dto';
import { TransactionAuditsService } from './transaction-audits.service';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId/transaction-audits')
export class TransactionAuditsController {
  constructor(private readonly audits: TransactionAuditsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Query() dto: AuditQueryDto) {
    return this.audits.list(req.user.id, profile, dto);
  }

  @Get(':auditId')
  detail(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('auditId', ParseUUIDPipe) id: string) {
    return this.audits.detail(req.user.id, profile, id);
  }
}
