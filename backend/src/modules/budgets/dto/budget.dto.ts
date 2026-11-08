import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsISO8601, IsString, Matches, ValidateIf, ValidateNested } from 'class-validator';
import { TipoOrcamento } from '../../../generated/prisma/client';
import { BudgetCategoryDto } from './monthly-budget.dto';

export class CreateBudgetDto {
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @Matches(/\S/)
  nome?: string | null;

  @IsEnum(TipoOrcamento)
  tipo!: TipoOrcamento;

  @IsISO8601({ strict: true })
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  dataInicio!: string;

  @IsISO8601({ strict: true })
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  dataFim!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetCategoryDto)
  categorias!: BudgetCategoryDto[];
}

export class UpdateBudgetDto {
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @Matches(/\S/)
  nome?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  dataInicio?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  dataFim?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  ativo?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetCategoryDto)
  categorias?: BudgetCategoryDto[];
}

export class BudgetQueryDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(TipoOrcamento)
  type?: TipoOrcamento;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  active?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
