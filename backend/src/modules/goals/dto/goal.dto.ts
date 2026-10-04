import { IsEnum, IsISO8601, IsString, Matches, ValidateIf } from 'class-validator';
import { FrequenciaSugestao } from '../../../generated/prisma/client';

export class CreateGoalDto {
  @IsString()
  @Matches(/\S/)
  nome!: string;

  @IsString()
  @Matches(/^\d{1,17}(?:\.\d{1,2})?$/)
  valorAlvo!: string;

  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataLimite!: string;

  @IsEnum(FrequenciaSugestao)
  frequenciaSugestao!: FrequenciaSugestao;
}

export class UpdateGoalDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/\S/)
  nome?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^\d{1,17}(?:\.\d{1,2})?$/)
  valorAlvo?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataLimite?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(FrequenciaSugestao)
  frequenciaSugestao?: FrequenciaSugestao;
}

export class ContributionDto {
  @IsString()
  @Matches(/^\d{1,17}(?:\.\d{1,2})?$/)
  valor!: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/)
  dataHora!: string;
}
