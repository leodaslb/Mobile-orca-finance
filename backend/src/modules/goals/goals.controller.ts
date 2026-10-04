import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { GoalsService } from './goals.service';
import { ContributionDto, CreateGoalDto, UpdateGoalDto } from './dto/goal.dto';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId/goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Body() dto: CreateGoalDto) {
    return this.goals.create(req.user.id, profile, dto);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string) {
    return this.goals.list(req.user.id, profile);
  }

  @Get(':goalId')
  detail(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Param('goalId', ParseUUIDPipe) id: string) {
    return this.goals.detail(req.user.id, profile, id);
  }

  @Patch(':goalId')
  update(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('goalId', ParseUUIDPipe) id: string, @Body() dto: UpdateGoalDto) {
    return this.goals.update(req.user.id, profile, id, dto);
  }

  @Post(':goalId/contributions')
  contribute(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('goalId', ParseUUIDPipe) id: string, @Body() dto: ContributionDto) {
    return this.goals.contribute(req.user.id, profile, id, dto);
  }

  @Get(':goalId/contributions')
  contributions(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('goalId', ParseUUIDPipe) id: string) {
    return this.goals.contributions(req.user.id, profile, id);
  }
}
