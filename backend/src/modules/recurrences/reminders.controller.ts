import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CreateReminderDto, UpdateReminderDto } from './reminder.dto';
import { RemindersService } from './reminders.service';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId/reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}
  @Post()
  create(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Body() dto: CreateReminderDto) {
    return this.reminders.create(req.user.id, profile, dto);
  }
  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string) { return this.reminders.list(req.user.id, profile); }
  @Patch(':reminderId')
  update(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('reminderId', ParseUUIDPipe) id: string, @Body() dto: UpdateReminderDto) {
    return this.reminders.update(req.user.id, profile, id, dto);
  }
}
