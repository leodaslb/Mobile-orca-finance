import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, Matches, Max, Min, ValidateIf } from 'class-validator';

export class ExpenseReportQueryDto {
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;
}

export class ExportQueryDto {
  @IsIn(['csv', 'xlsx'])
  format!: 'csv' | 'xlsx';

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
}

export class DashboardQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}
