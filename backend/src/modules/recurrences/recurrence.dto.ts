import { IsBoolean, IsEnum, IsISO8601, IsString, IsUUID, Matches, ValidateIf } from 'class-validator';
import { FrequenciaRecorrencia, MetodoPagamento, TipoTransacao } from '../../generated/prisma/client';

export class CreateRecurrenceDto {
  @IsEnum(TipoTransacao)
  tipoTransacao!: TipoTransacao;
  @IsString()
  @Matches(/^\d{1,17}(?:\.\d{1,2})?$/)
  valor!: string;
  @IsString()
  @Matches(/\S/)
  descricao!: string;
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsUUID()
  categoriaId?: string | null;
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsUUID()
  subcategoriaId?: string | null;
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsEnum(MetodoPagamento)
  metodoPagamento?: MetodoPagamento | null;
  @IsEnum(FrequenciaRecorrencia)
  frequencia!: FrequenciaRecorrencia;
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/)
  proximaOcorrencia!: string;
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataTermino?: string | null;
  @ValidateIf((_, v) => v !== undefined)
  @IsBoolean()
  ativa?: boolean;
}

export class UpdateRecurrenceDto {
  @ValidateIf((_, v) => v !== undefined)
  @IsEnum(TipoTransacao)
  tipoTransacao?: TipoTransacao;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @Matches(/^\d{1,17}(?:\.\d{1,2})?$/)
  valor?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @Matches(/\S/)
  descricao?: string;
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsUUID()
  categoriaId?: string | null;
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsUUID()
  subcategoriaId?: string | null;
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsEnum(MetodoPagamento)
  metodoPagamento?: MetodoPagamento | null;
  @ValidateIf((_, v) => v !== undefined)
  @IsEnum(FrequenciaRecorrencia)
  frequencia?: FrequenciaRecorrencia;
  @ValidateIf((_, v) => v !== undefined)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/)
  proximaOcorrencia?: string;
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataTermino?: string | null;
  @ValidateIf((_, v) => v !== undefined)
  @IsBoolean()
  ativa?: boolean;
}
