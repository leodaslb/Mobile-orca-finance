import { ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsIn, IsString, IsUUID, Matches, ValidateIf } from 'class-validator';
import { CanalNotificacao, PeriodoRegra, TipoRegraGasto } from '../../../generated/prisma/client';

export class CreateSpendingRuleDto {
  @IsIn([TipoRegraGasto.LIMITE_DIARIO, TipoRegraGasto.LIMITE_CATEGORIA])
  tipo!: TipoRegraGasto;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID()
  categoriaId?: string | null;

  @IsString()
  @Matches(/^\d{1,17}(?:\.\d{1,2})?$/)
  valorLimite!: string;

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
  @IsIn([TipoRegraGasto.LIMITE_DIARIO, TipoRegraGasto.LIMITE_CATEGORIA])
  tipo?: TipoRegraGasto;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID()
  categoriaId?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^\d{1,17}(?:\.\d{1,2})?$/)
  valorLimite?: string;

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
