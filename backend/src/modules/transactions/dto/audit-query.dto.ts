import { IsEnum, IsISO8601, IsUUID, Matches, ValidateIf } from 'class-validator';
import { OperacaoAuditoria } from '../../../generated/prisma/client';

export class AuditQueryDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  transactionId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(OperacaoAuditoria)
  operation?: OperacaoAuditoria;

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^(?!0000)(?:\d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))$/)
  from?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^(?!0000)(?:\d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))$/)
  to?: string;
}
