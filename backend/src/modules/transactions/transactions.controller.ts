import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId/transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactions.create(request.user.id, profileId, dto);
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Query() filters: TransactionQueryDto,
  ) {
    return this.transactions.list(request.user.id, profileId, filters);
  }

  @Get(':transactionId')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
  ) {
    return this.transactions.get(request.user.id, profileId, transactionId);
  }

  @Patch(':transactionId')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactions.update(request.user.id, profileId, transactionId, dto);
  }
}
