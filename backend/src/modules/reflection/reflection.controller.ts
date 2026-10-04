import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { ReflectionService } from './reflection.service';
import { CreateReflectionDto, UpdateReflectionDto } from './reflection.dto';
import { CreateTransactionDto } from '../transactions/dto/create-transaction.dto';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId/reflection-items')
export class ReflectionController {
  constructor(private readonly reflection: ReflectionService) {}
  @Delete(':itemId')
  @HttpCode(204)
  discard(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('itemId', ParseUUIDPipe) id: string) {
    return this.reflection.discard(req.user.id, profile, id);
  }
  @Post(':itemId/transactions')
  complete(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('itemId', ParseUUIDPipe) id: string, @Body() dto: CreateTransactionDto) {
    return this.reflection.complete(req.user.id, profile, id, dto);
  }
  @Post()
  create(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Body() dto: CreateReflectionDto) {
    return this.reflection.create(req.user.id, profile, dto);
  }
  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string) { return this.reflection.list(req.user.id, profile); }
  @Get(':itemId')
  detail(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Param('itemId', ParseUUIDPipe) id: string) {
    return this.reflection.detail(req.user.id, profile, id);
  }
  @Patch(':itemId')
  update(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('itemId', ParseUUIDPipe) id: string, @Body() dto: UpdateReflectionDto) {
    return this.reflection.update(req.user.id, profile, id, dto);
  }
}
