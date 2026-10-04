import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  nome!: string;
}
