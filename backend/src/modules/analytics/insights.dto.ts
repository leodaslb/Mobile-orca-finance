import { IsISO8601, IsString, Matches, ValidateIf } from 'class-validator';

export class MetricsQueryDto {
  @ValidateIf((_, v) => v !== undefined) @IsISO8601({ strict: true }) @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/) startDate?: string;
  @ValidateIf((_, v) => v !== undefined) @IsISO8601({ strict: true }) @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/) endDate?: string;
}
export class CategorySuggestionDto {
  @IsString() @Matches(/\S/) descricao!: string;
}
