import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEnum, IsUUID, ValidateIf } from 'class-validator';
import { Essencialidade } from '../../generated/prisma/client';

export class CreateAutomationRuleDto {
  @ValidateIf((_, v) => v !== undefined && v !== null) @IsUUID() categoriaId?: string | null;
  @ValidateIf((_, v) => v !== undefined && v !== null) @IsUUID() subcategoriaId?: string | null;
  @Equals('essencialidade') atributoAlvo!: string;
  @IsEnum(Essencialidade) valorDestino!: Essencialidade;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() ativa?: boolean;
}
export class UpdateAutomationRuleDto {
  @ValidateIf((_, v) => v !== undefined && v !== null) @IsUUID() categoriaId?: string | null;
  @ValidateIf((_, v) => v !== undefined && v !== null) @IsUUID() subcategoriaId?: string | null;
  @ValidateIf((_, v) => v !== undefined) @Equals('essencialidade') atributoAlvo?: string;
  @ValidateIf((_, v) => v !== undefined) @IsEnum(Essencialidade) valorDestino?: Essencialidade;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() ativa?: boolean;
}
export class AutomationQueryDto {
  @ValidateIf((_, v) => v !== undefined)
  @Transform(({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean() active?: boolean;
}
