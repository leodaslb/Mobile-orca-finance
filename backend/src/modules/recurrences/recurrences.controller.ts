import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CreateRecurrenceDto, UpdateRecurrenceDto } from './recurrence.dto';
import { RecurrencesService } from './recurrences.service';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId/recurrences')
export class RecurrencesController {
  constructor(private readonly recurrences: RecurrencesService) {}
  @Post()
  create(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Body() dto: CreateRecurrenceDto) {
    return this.recurrences.create(req.user.id, profile, dto);
  }
  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string) { return this.recurrences.list(req.user.id, profile); }
  @Get(':recurrenceId')
  detail(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Param('recurrenceId', ParseUUIDPipe) id: string) {
    return this.recurrences.detail(req.user.id, profile, id);
  }
  @Patch(':recurrenceId')
  update(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('recurrenceId', ParseUUIDPipe) id: string, @Body() dto: UpdateRecurrenceDto) {
    return this.recurrences.update(req.user.id, profile, id, dto);
  }
}
