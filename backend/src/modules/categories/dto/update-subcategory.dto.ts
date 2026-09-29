import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateSubcategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nome?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
