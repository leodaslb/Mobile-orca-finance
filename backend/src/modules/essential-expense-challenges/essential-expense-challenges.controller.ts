import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EssentialExpenseChallengesService } from './essential-expense-challenges.service';
import { CreateEssentialExpenseChallengeDto, UpdateEssentialExpenseChallengeDto } from './challenge.dto';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId/essential-expense-challenges')
export class EssentialExpenseChallengesController {
  constructor(private readonly challenges: EssentialExpenseChallengesService) {}
  @Get('candidates')
  candidates(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string) {
    return this.challenges.candidates(req.user.id, profile);
  }
  @Post()
  create(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Body() dto: CreateEssentialExpenseChallengeDto) {
    return this.challenges.create(req.user.id, profile, dto);
  }
  @Patch(':challengeId')
  update(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Param('challengeId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEssentialExpenseChallengeDto) {
    return this.challenges.update(req.user.id, profile, id, dto);
  }
  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string) {
    return this.challenges.list(req.user.id, profile);
  }
  @Get(':challengeId')
  detail(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Param('challengeId', ParseUUIDPipe) id: string) {
    return this.challenges.detail(req.user.id, profile, id);
  }
  @Get(':challengeId/suggestions')
  suggestions(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Param('challengeId', ParseUUIDPipe) id: string) {
    return this.challenges.suggestions(req.user.id, profile, id);
  }
}
