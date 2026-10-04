import { IsISO8601, Matches, ValidateIf } from 'class-validator';

export class RuleQueryDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/)
  dataReferencia?: string;
}
