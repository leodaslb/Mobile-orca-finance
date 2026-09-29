import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profiles.service';

@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.profiles.list(request.user.id);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateProfileDto) {
    return this.profiles.create(request.user.id, dto.nome);
  }

  @Get(':profileId')
  get(@Req() request: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profileId: string) {
    return this.profiles.get(request.user.id, profileId);
  }

  @Patch(':profileId')
  rename(
    @Req() request: AuthenticatedRequest,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profiles.rename(request.user.id, profileId, dto.nome);
  }
}
