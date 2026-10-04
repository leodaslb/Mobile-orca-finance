import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTagDto } from './dto/create-tag.dto';
import { TagsService } from './tags.service';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId/tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) perfilId: string) {
    return this.tags.list(request.user.id, perfilId);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('profileId', ParseUUIDPipe) perfilId: string,
    @Body() dto: CreateTagDto,
  ) {
    return this.tags.create(request.user.id, perfilId, dto.nome);
  }
}
