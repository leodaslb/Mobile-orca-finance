import { BadRequestException, Controller, Get, HttpException, Param, ParseUUIDPipe, PayloadTooLargeException, Post, Req, UnsupportedMediaTypeException, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReceiptsService } from './receipts.service';
import { RECEIPT_MULTIPART_LIMITS, ReceiptUpload } from './receipt-upload';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId/transactions/:transactionId/receipts')
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}
  @Post()
  create(@Req() req: FastifyRequest & AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string,
    @Param('transactionId', ParseUUIDPipe) id: string) {
    return this.receipts.create(req.user.id, profile, id, () => this.readFile(req));
  }

  private async readFile(req: FastifyRequest): Promise<ReceiptUpload> {
    if (!req.isMultipart()) throw new UnsupportedMediaTypeException('Envie multipart/form-data com um arquivo no campo file.');
    try {
      let file: ReceiptUpload | undefined;
      for await (const part of req.parts({ limits: RECEIPT_MULTIPART_LIMITS })) {
        if (part.type !== 'file' || part.fieldname !== 'file' || file) {
          throw new BadRequestException('Envie somente um arquivo no campo file, sem campos adicionais.');
        }
        file = { buffer: await part.toBuffer(), mimeType: part.mimetype };
        if (part.file.truncated) throw new PayloadTooLargeException('O recibo deve ter no máximo 5 MiB.');
      }
      if (!file) throw new BadRequestException('O arquivo de recibo é obrigatório.');
      return file;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new PayloadTooLargeException('O recibo deve ter no máximo 5 MiB.');
      }
      throw new BadRequestException('Multipart inválido: envie somente um arquivo JPEG ou PNG no campo file.');
    }
  }
  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Param('transactionId', ParseUUIDPipe) id: string) {
    return this.receipts.list(req.user.id, profile, id);
  }
}
