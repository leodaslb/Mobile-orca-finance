import { IsNotEmpty, Matches, IsString, IsUUID } from 'class-validator';

export class CreateSubcategoryDto {
  @IsUUID()
  categoriaId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  nome!: string;
}
