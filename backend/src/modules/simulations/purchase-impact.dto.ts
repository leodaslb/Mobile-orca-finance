import { IsInt, IsISO8601, IsString, IsUUID, Matches, Max, Min, ValidateIf } from 'class-validator';

export class PurchaseImpactDto {
  @IsString() @Matches(/^\d{1,17}(?:\.\d{1,2})?$/) valor!: string;
  @IsInt() @Min(1) @Max(1200) parcelas!: number;
  @IsISO8601({ strict: true }) @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/) dataPrimeiraParcela!: string;
  @ValidateIf((_, v) => v !== undefined) @IsUUID() categoriaId?: string;
}
