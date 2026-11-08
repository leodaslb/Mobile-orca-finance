import { ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsNumber, IsString, IsUUID, Matches, Max, Min, ValidateIf } from 'class-validator';
import { BaseCalculo, CanalNotificacao, PeriodoRegra, TipoRegraGasto } from '../../../generated/prisma/client';

export class CreateSpendingRuleDto {
  @IsEnum(TipoRegraGasto)
  tipo!: TipoRegraGasto;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID()
  categoriaId?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @Matches(/^\d{1,17}(?:\.\d{1,2})?$/)
  valorLimite?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(999.9999)
  percentualLimite?: number | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsEnum(BaseCalculo)
  baseCalculo?: BaseCalculo | null;

  @IsEnum(PeriodoRegra)
  periodo!: PeriodoRegra;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(CanalNotificacao, { each: true })
  canais!: CanalNotificacao[];

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  ativa?: boolean;
}

export class UpdateSpendingRuleDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(TipoRegraGasto)
  tipo?: TipoRegraGasto;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID()
  categoriaId?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @Matches(/^\d{1,17}(?:\.\d{1,2})?$/)
  valorLimite?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(999.9999)
  percentualLimite?: number | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsEnum(BaseCalculo)
  baseCalculo?: BaseCalculo | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(PeriodoRegra)
  periodo?: PeriodoRegra;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(CanalNotificacao, { each: true })
  canais?: CanalNotificacao[];

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  ativa?: boolean;
}
