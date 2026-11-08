import { IsISO8601, IsString, Matches, ValidateIf } from 'class-validator';

export class CreateLargePurchasePlanDto {
  @IsString() @Matches(/\S/) nome!: string;
  @IsString() @Matches(/^\d{1,17}(?:\.\d{1,2})?$/) valorTotal!: string;
  @ValidateIf((_, v) => v !== undefined && v !== null) @IsString() @Matches(/^\d{1,17}(?:\.\d{1,2})?$/) valorMensalPlanejado?: string | null;
  @IsISO8601({ strict: true }) @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/) dataInicio!: string;
}
export class UpdateLargePurchasePlanDto {
  @ValidateIf((_, v) => v !== undefined) @IsString() @Matches(/\S/) nome?: string;
  @ValidateIf((_, v) => v !== undefined) @IsString() @Matches(/^\d{1,17}(?:\.\d{1,2})?$/) valorTotal?: string;
  @ValidateIf((_, v) => v !== undefined && v !== null) @IsString() @Matches(/^\d{1,17}(?:\.\d{1,2})?$/) valorMensalPlanejado?: string | null;
  @ValidateIf((_, v) => v !== undefined) @IsISO8601({ strict: true }) @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/) dataInicio?: string;
}
