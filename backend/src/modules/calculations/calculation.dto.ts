import { IsInt, IsNumber, IsString, Matches, Max, Min } from 'class-validator';

export class CompoundInterestDto {
  @IsString() @Matches(/^\d{1,17}(?:\.\d{1,2})?$/) valorInicial!: string;
  @IsNumber() @Min(-100) taxaPercentual!: number;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) quantidadePeriodos!: number;
}
export class OpportunityCostDto {
  @IsString() @Matches(/^\d{1,17}(?:\.\d{1,2})?$/) valorGastoHipotetico!: string;
  @IsNumber() @Min(-100) taxaRetornoPercentual!: number;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) quantidadePeriodos!: number;
}
