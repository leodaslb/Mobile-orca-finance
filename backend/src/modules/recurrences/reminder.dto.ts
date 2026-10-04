import { IsBoolean, IsISO8601, IsUUID, Matches, ValidateIf } from 'class-validator';

export class CreateReminderDto {
  @ValidateIf((_, value) => value !== undefined && value !== null) @IsUUID()
  transacaoId?: string | null;
  @ValidateIf((_, value) => value !== undefined && value !== null) @IsUUID()
  recorrenciaId?: string | null;
  @IsISO8601({ strict: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  notificarEm!: string;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean()
  ativo?: boolean;
}
export class UpdateReminderDto {
  @ValidateIf((_, value) => value !== undefined && value !== null) @IsUUID()
  transacaoId?: string | null;
  @ValidateIf((_, value) => value !== undefined && value !== null) @IsUUID()
  recorrenciaId?: string | null;
  @ValidateIf((_, value) => value !== undefined) @IsISO8601({ strict: true }) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  notificarEm?: string;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean()
  ativo?: boolean;
}
