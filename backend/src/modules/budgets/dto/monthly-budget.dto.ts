import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';

export class BudgetCategoryDto {
  @IsUUID()
  categoriaId!: string;

  @IsString()
  @Matches(/^\d{1,17}(?:\.\d{1,2})?$/)
  valorPlanejado!: string;
}

export class MonthlyBudgetDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BudgetCategoryDto)
  categorias!: BudgetCategoryDto[];
}
