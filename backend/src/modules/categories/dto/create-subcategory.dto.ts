import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateSubcategoryDto {
  @IsUUID()
  categoriaId!: string;

  @IsString()
  @IsNotEmpty()
  nome!: string;
}
