import { BadRequestException, Body, Controller, HttpCode, HttpException, Param, ParseUUIDPipe, PayloadTooLargeException, Post, Req, UnsupportedMediaTypeException, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { ConfirmImportDto } from './import.dto';
import { IMPORT_MULTIPART_LIMITS } from './csv-parser';
import { ImportsService } from './imports.service';

@UseGuards(JwtAuthGuard)
@Controller('profiles/:profileId/imports/transactions')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}
  @Post('preview') @HttpCode(200)
  preview(@Req() req: FastifyRequest & AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string) {
    return this.imports.preview(req.user.id, profile, async () => {
      if (!req.isMultipart()) throw new UnsupportedMediaTypeException('Envie multipart/form-data no campo file.');
      let buffer: Buffer | undefined;
      try {
        for await (const part of req.parts({ limits: IMPORT_MULTIPART_LIMITS })) {
          if (part.type !== 'file' || part.fieldname !== 'file' || buffer) throw new BadRequestException('Envie somente um CSV no campo file.');
          buffer = await part.toBuffer();
          if (part.file.truncated) throw new PayloadTooLargeException('CSV excede 5 MiB.');
        }
      } catch (error) {
        if (error instanceof HttpException) throw error;
        if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') throw new PayloadTooLargeException('CSV excede 5 MiB.');
        throw new BadRequestException('Multipart inválido.');
      }
      if (!buffer) throw new BadRequestException('Arquivo CSV obrigatório.');
      return buffer;
    });
  }
  @Post('confirm')
  confirm(@Req() req: AuthenticatedRequest, @Param('profileId', ParseUUIDPipe) profile: string, @Body() dto: ConfirmImportDto) {
    return this.imports.confirm(req.user.id, profile, dto);
  }
}
