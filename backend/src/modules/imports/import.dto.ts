import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsISO8601, IsString, IsUUID, Matches, ValidateIf, ValidateNested } from 'class-validator';
import { TipoTransacao } from '../../generated/prisma/client';

export const IMPORT_MAX_ROWS = 1000; // Limite técnico de tamanho da transação atômica.
export class ImportRowDto {
  @IsEnum(TipoTransacao) tipo!: TipoTransacao;
  @IsString() @Matches(/^\d{1,17}(?:\.\d{1,2})?$/) valor!: string;
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/) dataHora!: string;
  @IsString() @Matches(/\S/) descricao!: string;
  @ValidateIf((_, value) => value !== undefined && value !== null) @IsUUID() categoriaId?: string | null;
}
export class ConfirmImportDto {
  @IsBoolean() confirmPossibleDuplicates!: boolean;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(IMPORT_MAX_ROWS)
  @ValidateNested({ each: true }) @Type(() => ImportRowDto) rows!: ImportRowDto[];
}
