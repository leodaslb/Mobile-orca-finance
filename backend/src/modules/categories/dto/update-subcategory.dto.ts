import { IsBoolean, IsNotEmpty, Matches, IsOptional, IsString } from 'class-validator';

export class UpdateSubcategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  nome?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
