import { IsInt, IsString, Matches, Max, Min, ValidateIf } from 'class-validator';

export class CreateReflectionDto {
  @IsString()
  @Matches(/\S/)
  descricao!: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  duracaoHoras?: number;
}

export class UpdateReflectionDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/\S/)
  descricao?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  duracaoHoras?: number;
}
